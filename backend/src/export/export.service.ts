import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

// ─── ANONYMIZATION HELPERS ────────────────────────────────────────────────────

function maskEmail(email: string): string {
  if (!email) return '';
  const [local, domain] = email.split('@');
  const maskedLocal = local[0] + '*'.repeat(Math.max(local.length - 1, 2)) ;
  const domainParts = domain.split('.');
  const maskedDomain = domainParts[0][0] + '*'.repeat(Math.max(domainParts[0].length - 1, 2));
  return `${maskedLocal}@${maskedDomain}.${domainParts.slice(1).join('.')}`;
}

function maskPhone(phone: string): string {
  if (!phone) return '';
  return phone.replace(/.(?=.{4})/g, '*');
}

function hashInitials(name: string, salt: string): string {
  if (!name) return '';
  const hash = crypto.createHash('sha256').update(name + salt).digest('hex').substring(0, 8);
  const parts = name.trim().split(/\s+/);
  return parts.map((p) => p[0].toUpperCase()).join('.') + `.[${hash}]`;
}

function pseudonymize(value: string, salt: string): string {
  return crypto.createHash('sha256').update(value + salt).digest('hex').substring(0, 12);
}

// ─── EXPORT SERVICE ───────────────────────────────────────────────────────────

export type ExportLevel = 'full' | 'anonymized' | 'aggregate';

@Injectable()
export class ExportService {
  constructor(private prisma: PrismaService) {}

  async exportTickets(tenantId: string, userId: string, level: ExportLevel, filters: any = {}) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    const salt = tenant?.id || 'default-salt';

    const where: any = { tenantId };
    if (filters.status) where.status = filters.status;
    if (filters.priority) where.priority = filters.priority;
    if (filters.from) where.createdAt = { ...where.createdAt, gte: new Date(filters.from) };
    if (filters.to) where.createdAt = { ...where.createdAt, lte: new Date(filters.to) };

    const tickets = await this.prisma.ticket.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 10000,
      include: {
        assignee: { select: { name: true, email: true } },
        createdBy: { select: { name: true } },
        _count: { select: { messages: true } },
      },
    });

    // Log the export action
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: 'export.triggered',
        metadata: { level, count: tickets.length, filters },
      },
    });

    if (level === 'aggregate') {
      return this.buildAggregateExport(tickets);
    }

    return tickets.map((t) => this.mapTicket(t, level, salt));
  }

  private mapTicket(ticket: any, level: ExportLevel, salt: string): Record<string, any> {
    const base = {
      id: level === 'full' ? ticket.id : pseudonymize(ticket.id, salt),
      number: ticket.number,
      title: ticket.title,
      status: ticket.status,
      priority: ticket.priority,
      tags: ticket.tags.join(', '),
      messageCount: ticket._count.messages,
      createdAt: ticket.createdAt?.toISOString(),
      resolvedAt: ticket.resolvedAt?.toISOString() || '',
      closedAt: ticket.closedAt?.toISOString() || '',
      slaBreachAt: ticket.slaBreachAt?.toISOString() || '',
      firstResponseAt: ticket.firstResponseAt?.toISOString() || '',
    };

    if (level === 'full') {
      return {
        ...base,
        customerEmail: ticket.customerEmail || '',
        customerName: ticket.customerName || '',
        customerPhone: ticket.customerPhone || '',
        assigneeName: ticket.assignee?.name || 'Unassigned',
        assigneeEmail: ticket.assignee?.email || '',
        createdByName: ticket.createdBy?.name || '',
      };
    }

    // Anonymized
    return {
      ...base,
      customerEmail: ticket.customerEmail ? maskEmail(ticket.customerEmail) : '',
      customerName: ticket.customerName ? hashInitials(ticket.customerName, salt) : '',
      customerPhone: ticket.customerPhone ? maskPhone(ticket.customerPhone) : '',
      assigneeName: ticket.assignee?.name ? hashInitials(ticket.assignee.name, salt) : 'Unassigned',
      assigneeEmail: ticket.assignee?.email ? maskEmail(ticket.assignee.email) : '',
    };
  }

  private buildAggregateExport(tickets: any[]) {
    const byStatus: Record<string, number> = {};
    const byPriority: Record<string, number> = {};
    let totalResolutionMs = 0;
    let resolvedCount = 0;

    for (const t of tickets) {
      byStatus[t.status] = (byStatus[t.status] || 0) + 1;
      byPriority[t.priority] = (byPriority[t.priority] || 0) + 1;
      if (t.resolvedAt && t.createdAt) {
        totalResolutionMs += new Date(t.resolvedAt).getTime() - new Date(t.createdAt).getTime();
        resolvedCount++;
      }
    }

    return {
      totalTickets: tickets.length,
      byStatus,
      byPriority,
      averageResolutionHours: resolvedCount > 0
        ? Math.round(totalResolutionMs / resolvedCount / 3600000)
        : null,
      exportedAt: new Date().toISOString(),
    };
  }

  toCsv(data: Record<string, any>[]): string {
    if (!data.length) return '';
    const headers = Object.keys(data[0]);
    const rows = data.map((row) =>
      headers.map((h) => {
        const val = row[h] ?? '';
        return typeof val === 'string' && val.includes(',') ? `"${val}"` : String(val);
      }).join(','),
    );
    return [headers.join(','), ...rows].join('\n');
  }
}
