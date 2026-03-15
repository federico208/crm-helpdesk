import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TicketStatus } from '@prisma/client';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getKpi(tenantId: string, days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [
      totalOpen,
      totalResolved,
      totalClosed,
      overdue,
      created,
      avgResolutionMs,
      byAssignee,
      createdVsResolved,
    ] = await Promise.all([
      // Open tickets
      this.prisma.ticket.count({
        where: { tenantId, status: { in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.PENDING_CUSTOMER] } },
      }),

      // Resolved in period
      this.prisma.ticket.count({
        where: { tenantId, status: TicketStatus.RESOLVED, resolvedAt: { gte: since } },
      }),

      // Closed in period
      this.prisma.ticket.count({
        where: { tenantId, status: TicketStatus.CLOSED, closedAt: { gte: since } },
      }),

      // Overdue (SLA breached)
      this.prisma.ticket.count({
        where: {
          tenantId,
          slaBreachAt: { lt: new Date() },
          status: { notIn: [TicketStatus.RESOLVED, TicketStatus.CLOSED] },
        },
      }),

      // Created in period
      this.prisma.ticket.count({
        where: { tenantId, createdAt: { gte: since } },
      }),

      // Average resolution time (ms) for tickets resolved in period
      this.prisma.$queryRaw<any[]>`
        SELECT AVG(EXTRACT(EPOCH FROM ("resolvedAt" - "createdAt")) * 1000) as avg_ms
        FROM "Ticket"
        WHERE "tenantId" = ${tenantId}
          AND "resolvedAt" IS NOT NULL
          AND "resolvedAt" >= ${since}
      `,

      // Tickets by assignee (open)
      this.prisma.ticket.groupBy({
        by: ['assigneeId'],
        where: {
          tenantId,
          status: { in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS] },
          assigneeId: { not: null },
        },
        _count: { _all: true },
      }),

      // Daily created vs resolved (last 14 days)
      this.prisma.$queryRaw<any[]>`
        SELECT
          DATE("createdAt") as date,
          COUNT(*) FILTER (WHERE status != 'CLOSED') as created,
          COUNT(*) FILTER (WHERE "resolvedAt" IS NOT NULL AND "resolvedAt" >= ${since}) as resolved
        FROM "Ticket"
        WHERE "tenantId" = ${tenantId}
          AND "createdAt" >= ${new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)}
        GROUP BY DATE("createdAt")
        ORDER BY date ASC
      `,
    ]);

    // Enrich assignee stats with user names
    const assigneeIds = byAssignee.map((a) => a.assigneeId).filter(Boolean);
    const agents = assigneeIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: assigneeIds } },
          select: { id: true, name: true },
        })
      : [];

    const agentMap = Object.fromEntries(agents.map((a) => [a.id, a.name]));
    const byAssigneeEnriched = byAssignee.map((a) => ({
      agentId: a.assigneeId,
      agentName: agentMap[a.assigneeId] || 'Unknown',
      ticketCount: a._count._all,
    }));

    const avgResolutionHours = avgResolutionMs[0]?.avg_ms
      ? Math.round(Number(avgResolutionMs[0].avg_ms) / 3600000)
      : null;

    return {
      period: { days, since: since.toISOString() },
      tickets: {
        open: totalOpen,
        resolvedInPeriod: totalResolved,
        closedInPeriod: totalClosed,
        createdInPeriod: created,
        overdue,
      },
      sla: {
        overdueCount: overdue,
        overduePercent: totalOpen > 0 ? Math.round((overdue / totalOpen) * 100) : 0,
      },
      performance: {
        avgResolutionHours,
      },
      byAssignee: byAssigneeEnriched,
      trend: createdVsResolved.map((r) => ({
        date: r.date,
        created: Number(r.created),
        resolved: Number(r.resolved),
      })),
    };
  }

  async getTicketTrend(tenantId: string, days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const data = await this.prisma.$queryRaw<any[]>`
      SELECT
        DATE("createdAt") as date,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE priority = 'URGENT') as urgent,
        COUNT(*) FILTER (WHERE priority = 'HIGH') as high,
        COUNT(*) FILTER (WHERE priority = 'MEDIUM') as medium,
        COUNT(*) FILTER (WHERE priority = 'LOW') as low
      FROM "Ticket"
      WHERE "tenantId" = ${tenantId}
        AND "createdAt" >= ${since}
      GROUP BY DATE("createdAt")
      ORDER BY date ASC
    `;

    return data.map((r) => ({
      date: r.date,
      total: Number(r.total),
      urgent: Number(r.urgent),
      high: Number(r.high),
      medium: Number(r.medium),
      low: Number(r.low),
    }));
  }
}
