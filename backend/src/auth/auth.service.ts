import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto, TwoFactorDto, RefreshTokenDto } from './dto/login.dto';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  // ─── REGISTER ─────────────────────────────────────────────────────────────
  async register(dto: RegisterDto) {
    const existingTenant = await this.prisma.tenant.findUnique({
      where: { slug: dto.companySlug },
    });
    if (existingTenant) {
      throw new ConflictException('Company slug already taken');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const result = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: dto.companyName,
          slug: dto.companySlug,
          settings: { timezone: 'Europe/Rome', language: 'it' },
        },
      });

      await tx.tenantCounter.create({ data: { tenantId: tenant.id } });

      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: dto.email.toLowerCase(),
          passwordHash,
          name: dto.name,
          role: UserRole.ADMIN,
        },
      });

      // Create default SLA profiles
      await tx.slaProfile.createMany({
        data: [
          { tenantId: tenant.id, name: 'Urgente', priority: 'URGENT', firstResponseHours: 1, resolutionHours: 4 },
          { tenantId: tenant.id, name: 'Alto', priority: 'HIGH', firstResponseHours: 2, resolutionHours: 8 },
          { tenantId: tenant.id, name: 'Medio', priority: 'MEDIUM', firstResponseHours: 8, resolutionHours: 24 },
          { tenantId: tenant.id, name: 'Basso', priority: 'LOW', firstResponseHours: 24, resolutionHours: 72 },
        ],
      });

      return { tenant, user };
    });

    const tokens = await this.generateTokens(result.user);

    await this.prisma.auditLog.create({
      data: {
        tenantId: result.tenant.id,
        userId: result.user.id,
        action: 'user.registered',
        resourceType: 'user',
        resourceId: result.user.id,
      },
    });

    return {
      ...tokens,
      user: this.sanitizeUser(result.user),
      tenant: { id: result.tenant.id, name: result.tenant.name, slug: result.tenant.slug },
    };
  }

  // ─── LOGIN ────────────────────────────────────────────────────────────────
  async login(dto: LoginDto, ip?: string) {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email.toLowerCase() },
      include: { tenant: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      await this.prisma.auditLog.create({
        data: {
          tenantId: user.tenantId,
          userId: user.id,
          action: 'user.login_failed',
          ipAddress: ip,
        },
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    // 2FA check
    if (user.twoFactorEnabled) {
      const tempToken = this.jwtService.sign(
        { sub: user.id, type: 'temp_2fa' },
        { secret: this.config.get('JWT_SECRET'), expiresIn: '5m' },
      );
      return { requiresTwoFactor: true, tempToken };
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = await this.generateTokens(user);

    await this.prisma.auditLog.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        action: 'user.login',
        ipAddress: ip,
      },
    });

    return {
      ...tokens,
      user: this.sanitizeUser(user),
      tenant: { id: user.tenant.id, name: user.tenant.name, slug: user.tenant.slug },
    };
  }

  // ─── 2FA VALIDATE ─────────────────────────────────────────────────────────
  async validateTwoFactor(dto: TwoFactorDto) {
    let payload: any;
    try {
      payload = this.jwtService.verify(dto.tempToken, {
        secret: this.config.get('JWT_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired temp token');
    }

    if (payload.type !== 'temp_2fa') {
      throw new UnauthorizedException('Invalid token type');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { tenant: true },
    });

    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      throw new UnauthorizedException('2FA not configured');
    }

    const isValid = authenticator.verify({ token: dto.otpCode, secret: user.twoFactorSecret });
    if (!isValid) {
      throw new UnauthorizedException('Invalid OTP code');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = await this.generateTokens(user);
    return {
      ...tokens,
      user: this.sanitizeUser(user),
      tenant: { id: user.tenant.id, name: user.tenant.name, slug: user.tenant.slug },
    };
  }

  // ─── REFRESH ──────────────────────────────────────────────────────────────
  async refresh(dto: RefreshTokenDto) {
    const tokenHash = crypto.createHash('sha256').update(dto.refreshToken).digest('hex');

    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: { include: { tenant: true } } },
    });

    if (!stored || stored.isRevoked || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Token rotation: revoke old, issue new
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { isRevoked: true },
    });

    const tokens = await this.generateTokens(stored.user);
    return tokens;
  }

  // ─── LOGOUT ───────────────────────────────────────────────────────────────
  async logout(userId: string, refreshToken?: string) {
    if (refreshToken) {
      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      await this.prisma.refreshToken.updateMany({
        where: { tokenHash, userId },
        data: { isRevoked: true },
      });
    } else {
      // Revoke all tokens for user
      await this.prisma.refreshToken.updateMany({
        where: { userId },
        data: { isRevoked: true },
      });
    }
    return { message: 'Logged out successfully' };
  }

  // ─── 2FA SETUP ────────────────────────────────────────────────────────────
  async setup2FA(userId: string, tenantId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
    });
    if (!user) throw new NotFoundException('User not found');

    const secret = authenticator.generateSecret();
    const otpAuthUrl = authenticator.keyuri(user.email, 'CRM Helpdesk', secret);
    const qrCode = await QRCode.toDataURL(otpAuthUrl);

    // Store secret temporarily (not enabled yet)
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecret: secret },
    });

    return { qrCode, secret, otpAuthUrl };
  }

  // ─── 2FA ENABLE ───────────────────────────────────────────────────────────
  async enable2FA(userId: string, tenantId: string, otpCode: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
    });
    if (!user || !user.twoFactorSecret) {
      throw new BadRequestException('Run 2FA setup first');
    }

    const isValid = authenticator.verify({ token: otpCode, secret: user.twoFactorSecret });
    if (!isValid) throw new BadRequestException('Invalid OTP code');

    // Generate recovery codes
    const recoveryCodes = Array.from({ length: 8 }, () =>
      crypto.randomBytes(4).toString('hex').toUpperCase().match(/.{4}/g)!.join('-'),
    );
    const hashedCodes = await Promise.all(recoveryCodes.map((c) => bcrypt.hash(c, 10)));

    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: true, recoveryCodes: hashedCodes },
    });

    await this.prisma.auditLog.create({
      data: { tenantId, userId, action: 'user.2fa_enabled' },
    });

    return { message: '2FA enabled', recoveryCodes };
  }

  // ─── 2FA DISABLE ──────────────────────────────────────────────────────────
  async disable2FA(userId: string, tenantId: string, otpCode: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
    });
    if (!user || !user.twoFactorEnabled) {
      throw new BadRequestException('2FA is not enabled');
    }

    const isValid = authenticator.verify({ token: otpCode, secret: user.twoFactorSecret });
    if (!isValid) throw new BadRequestException('Invalid OTP code');

    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: false, twoFactorSecret: null, recoveryCodes: [] },
    });

    await this.prisma.auditLog.create({
      data: { tenantId, userId, action: 'user.2fa_disabled' },
    });

    return { message: '2FA disabled' };
  }

  // ─── HELPERS ──────────────────────────────────────────────────────────────
  private async generateTokens(user: any) {
    const payload = {
      sub: user.id,
      tenantId: user.tenantId,
      email: user.email,
      role: user.role,
      name: user.name,
    };

    const accessToken = this.jwtService.sign(payload);

    const refreshToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return { accessToken, refreshToken };
  }

  private sanitizeUser(user: any) {
    const { passwordHash, twoFactorSecret, recoveryCodes, ...safe } = user;
    return safe;
  }
}
