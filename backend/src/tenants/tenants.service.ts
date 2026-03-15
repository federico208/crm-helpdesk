import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class TenantsService {
  constructor(private prisma: PrismaService) {}

  async getSettings(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { slaProfiles: true, customFields: { where: { isActive: true }, orderBy: { order: 'asc' } } },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  async updateSettings(tenantId: string, data: any) {
    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: { name: data.name, settings: data.settings },
      select: { id: true, name: true, slug: true, settings: true, plan: true },
    });
  }

  // ─── API KEYS ─────────────────────────────────────────────────────────────
  async listApiKeys(tenantId: string) {
    return this.prisma.apiKey.findMany({
      where: { tenantId },
      select: { id: true, name: true, keyPrefix: true, scopes: true, isActive: true, lastUsedAt: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createApiKey(tenantId: string, name: string, scopes: string[]) {
    const rawKey = `crm_${crypto.randomBytes(20).toString('hex')}`;
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const keyPrefix = rawKey.substring(0, 12);

    await this.prisma.apiKey.create({
      data: { tenantId, name, keyHash, keyPrefix, scopes },
    });

    return { key: rawKey, keyPrefix, name, scopes, message: 'Save this key — it will not be shown again' };
  }

  async revokeApiKey(id: string, tenantId: string) {
    const key = await this.prisma.apiKey.findFirst({ where: { id, tenantId } });
    if (!key) throw new NotFoundException('API key not found');
    await this.prisma.apiKey.update({ where: { id }, data: { isActive: false } });
    return { message: 'API key revoked' };
  }

  async validateApiKey(rawKey: string): Promise<{ tenantId: string; scopes: string[] } | null> {
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const key = await this.prisma.apiKey.findUnique({
      where: { keyHash },
      select: { tenantId: true, scopes: true, isActive: true, expiresAt: true },
    });

    if (!key || !key.isActive) return null;
    if (key.expiresAt && key.expiresAt < new Date()) return null;

    await this.prisma.apiKey.update({ where: { keyHash }, data: { lastUsedAt: new Date() } });
    return { tenantId: key.tenantId, scopes: key.scopes };
  }

  // ─── SLA PROFILES ─────────────────────────────────────────────────────────
  async listSlaProfiles(tenantId: string) {
    return this.prisma.slaProfile.findMany({ where: { tenantId }, orderBy: { priority: 'asc' } });
  }

  async updateSlaProfile(id: string, tenantId: string, data: any) {
    const profile = await this.prisma.slaProfile.findFirst({ where: { id, tenantId } });
    if (!profile) throw new NotFoundException('SLA profile not found');
    return this.prisma.slaProfile.update({ where: { id }, data });
  }

  // ─── WEBHOOKS ─────────────────────────────────────────────────────────────
  async listWebhooks(tenantId: string) {
    return this.prisma.webhook.findMany({
      where: { tenantId },
      select: { id: true, name: true, url: true, events: true, isActive: true, createdAt: true },
    });
  }

  async createWebhook(tenantId: string, data: any) {
    const secret = crypto.randomBytes(24).toString('hex');
    return this.prisma.webhook.create({
      data: { tenantId, name: data.name, url: data.url, events: data.events, secret },
      select: { id: true, name: true, url: true, events: true, secret: true, isActive: true },
    });
  }

  async updateWebhook(id: string, tenantId: string, data: any) {
    const hook = await this.prisma.webhook.findFirst({ where: { id, tenantId } });
    if (!hook) throw new NotFoundException('Webhook not found');
    return this.prisma.webhook.update({
      where: { id },
      data: { name: data.name, url: data.url, events: data.events, isActive: data.isActive },
      select: { id: true, name: true, url: true, events: true, isActive: true },
    });
  }

  async deleteWebhook(id: string, tenantId: string) {
    const hook = await this.prisma.webhook.findFirst({ where: { id, tenantId } });
    if (!hook) throw new NotFoundException('Webhook not found');
    await this.prisma.webhook.delete({ where: { id } });
    return { message: 'Webhook deleted' };
  }

  // ─── CUSTOM FIELDS ────────────────────────────────────────────────────────
  async listCustomFields(tenantId: string) {
    return this.prisma.ticketFieldDefinition.findMany({
      where: { tenantId, isActive: true },
      orderBy: { order: 'asc' },
    });
  }

  async createCustomField(tenantId: string, data: any) {
    return this.prisma.ticketFieldDefinition.create({
      data: { tenantId, ...data },
    });
  }

  async updateCustomField(id: string, tenantId: string, data: any) {
    return this.prisma.ticketFieldDefinition.update({
      where: { id },
      data,
    });
  }

  // ─── AUDIT LOGS ───────────────────────────────────────────────────────────
  async getAuditLogs(tenantId: string, query: any = {}) {
    const { page = 1, limit = 50, action, userId } = query;
    const skip = (page - 1) * limit;
    const where: any = { tenantId };
    if (action) where.action = { contains: action };
    if (userId) where.userId = userId;

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { name: true, email: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { logs, total };
  }
}
