import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string, query: any = {}) {
    const { search, role, isActive, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: any = { tenantId };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (role) where.role = role;
    if (isActive !== undefined) where.isActive = isActive === 'true';

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, name: true, email: true, role: true,
          isActive: true, twoFactorEnabled: true,
          lastLoginAt: true, createdAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { users, total, page: Number(page), limit: Number(limit) };
  }

  async findOne(id: string, tenantId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId },
      select: {
        id: true, name: true, email: true, role: true,
        isActive: true, twoFactorEnabled: true,
        lastLoginAt: true, createdAt: true, updatedAt: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async create(tenantId: string, data: any, createdByRole: UserRole) {
    if (data.role === UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Cannot create super admin');
    }
    if (data.role === UserRole.ADMIN && createdByRole !== UserRole.ADMIN && createdByRole !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only admins can create admin users');
    }

    const existing = await this.prisma.user.findFirst({
      where: { tenantId, email: data.email.toLowerCase() },
    });
    if (existing) throw new ConflictException('Email already in use');

    const passwordHash = await bcrypt.hash(data.password, 12);

    return this.prisma.user.create({
      data: {
        tenantId,
        email: data.email.toLowerCase(),
        passwordHash,
        name: data.name,
        role: data.role || UserRole.AGENT,
      },
      select: {
        id: true, name: true, email: true, role: true,
        isActive: true, createdAt: true,
      },
    });
  }

  async update(id: string, tenantId: string, data: any, updaterRole: UserRole) {
    const user = await this.prisma.user.findFirst({ where: { id, tenantId } });
    if (!user) throw new NotFoundException('User not found');

    if (user.role === UserRole.ADMIN && updaterRole !== UserRole.ADMIN && updaterRole !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Cannot modify admin users');
    }

    const updateData: any = {};
    if (data.name) updateData.name = data.name;
    if (data.role) updateData.role = data.role;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.password) updateData.passwordHash = await bcrypt.hash(data.password, 12);

    return this.prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true, name: true, email: true, role: true,
        isActive: true, updatedAt: true,
      },
    });
  }

  async remove(id: string, tenantId: string, requesterId: string) {
    if (id === requesterId) throw new ForbiddenException('Cannot delete yourself');

    const user = await this.prisma.user.findFirst({ where: { id, tenantId } });
    if (!user) throw new NotFoundException('User not found');

    // Soft delete
    return this.prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: { id: true, name: true, isActive: true },
    });
  }
}
