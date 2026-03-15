import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TicketStatus, Priority } from '@prisma/client';

// Valid state machine transitions
const ALLOWED_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  OPEN: [TicketStatus.IN_PROGRESS, TicketStatus.CLOSED],
  IN_PROGRESS: [TicketStatus.PENDING_CUSTOMER, TicketStatus.RESOLVED, TicketStatus.CLOSED],
  PENDING_CUSTOMER: [TicketStatus.IN_PROGRESS, TicketStatus.RESOLVED, TicketStatus.CLOSED],
  RESOLVED: [TicketStatus.CLOSED, TicketStatus.OPEN],
  CLOSED: [TicketStatus.OPEN],
};

@Injectable()
export class TicketsService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string, query: any = {}) {
    const {
      status, priority, assigneeId, search, tags,
      page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc',
    } = query;
    const skip = (page - 1) * limit;

    const where: any = { tenantId };
    if (status) where.status = Array.isArray(status) ? { in: status } : status;
    if (priority) where.priority = priority;
    if (assigneeId) where.assigneeId = assigneeId === 'unassigned' ? null : assigneeId;
    if (tags) where.tags = { hasSome: Array.isArray(tags) ? tags : [tags] };
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { customerName: { contains: search, mode: 'insensitive' } },
        { customerEmail: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [tickets, total] = await Promise.all([
      this.prisma.ticket.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { [sortBy]: sortOrder },
        include: {
          assignee: { select: { id: true, name: true, email: true } },
          createdBy: { select: { id: true, name: true } },
          _count: { select: { messages: true } },
        },
      }),
      this.prisma.ticket.count({ where }),
    ]);

    return {
      tickets,
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / Number(limit)),
    };
  }

  async findOne(id: string, tenantId: string) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id, tenantId },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true } },
        messages: {
          orderBy: { createdAt: 'asc' },
          include: { author: { select: { id: true, name: true, role: true } } },
        },
      },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    return ticket;
  }

  async findByNumber(number: number, tenantId: string) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { number, tenantId },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true } },
        messages: {
          orderBy: { createdAt: 'asc' },
          include: { author: { select: { id: true, name: true, role: true } } },
        },
      },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    return ticket;
  }

  async create(tenantId: string, userId: string, data: any) {
    return this.prisma.$transaction(async (tx) => {
      const counter = await tx.tenantCounter.update({
        where: { tenantId },
        data: { ticketCounter: { increment: 1 } },
      });

      // Calculate SLA breach time
      const slaProfile = await tx.slaProfile.findFirst({
        where: { tenantId, priority: data.priority || Priority.MEDIUM },
      });

      let slaBreachAt: Date | undefined;
      if (slaProfile) {
        slaBreachAt = new Date(Date.now() + slaProfile.resolutionHours * 60 * 60 * 1000);
      }

      const ticket = await tx.ticket.create({
        data: {
          tenantId,
          number: counter.ticketCounter,
          title: data.title,
          description: data.description,
          status: TicketStatus.OPEN,
          priority: data.priority || Priority.MEDIUM,
          createdById: userId,
          assigneeId: data.assigneeId || null,
          customerEmail: data.customerEmail || null,
          customerName: data.customerName || null,
          customerPhone: data.customerPhone || null,
          tags: data.tags || [],
          customFields: data.customFields || {},
          slaBreachAt,
        },
        include: {
          assignee: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true } },
        },
      });

      // Create initial message from description
      await tx.message.create({
        data: {
          tenantId,
          ticketId: ticket.id,
          authorId: userId,
          authorType: 'agent',
          content: data.description,
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          userId,
          action: 'ticket.created',
          resourceType: 'ticket',
          resourceId: ticket.id,
          metadata: { number: ticket.number, title: ticket.title },
        },
      });

      return ticket;
    });
  }

  async update(id: string, tenantId: string, userId: string, data: any) {
    const ticket = await this.prisma.ticket.findFirst({ where: { id, tenantId } });
    if (!ticket) throw new NotFoundException('Ticket not found');

    // Optimistic locking
    if (data.version && data.version !== ticket.version) {
      throw new ConflictException('Ticket was modified by another user. Please refresh and retry.');
    }

    // Validate status transition
    if (data.status && data.status !== ticket.status) {
      const allowed = ALLOWED_TRANSITIONS[ticket.status];
      if (!allowed.includes(data.status)) {
        throw new BadRequestException(
          `Cannot transition from ${ticket.status} to ${data.status}. Allowed: ${allowed.join(', ')}`,
        );
      }
    }

    const updateData: any = { version: { increment: 1 } };
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.assigneeId !== undefined) updateData.assigneeId = data.assigneeId;
    if (data.customerEmail !== undefined) updateData.customerEmail = data.customerEmail;
    if (data.customerName !== undefined) updateData.customerName = data.customerName;
    if (data.tags !== undefined) updateData.tags = data.tags;
    if (data.customFields !== undefined) updateData.customFields = data.customFields;

    if (data.status !== undefined) {
      updateData.status = data.status;
      if (data.status === TicketStatus.RESOLVED && !ticket.resolvedAt) {
        updateData.resolvedAt = new Date();
      }
      if (data.status === TicketStatus.CLOSED && !ticket.closedAt) {
        updateData.closedAt = new Date();
      }
    }

    const updated = await this.prisma.ticket.update({
      where: { id },
      data: updateData,
      include: {
        assignee: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: 'ticket.updated',
        resourceType: 'ticket',
        resourceId: id,
        metadata: { changes: data },
      },
    });

    return updated;
  }

  async assign(id: string, tenantId: string, assigneeId: string | null, userId: string) {
    const ticket = await this.prisma.ticket.findFirst({ where: { id, tenantId } });
    if (!ticket) throw new NotFoundException('Ticket not found');

    if (assigneeId) {
      const agent = await this.prisma.user.findFirst({ where: { id: assigneeId, tenantId } });
      if (!agent) throw new NotFoundException('Agent not found');
    }

    const updated = await this.prisma.ticket.update({
      where: { id },
      data: {
        assigneeId,
        status: assigneeId && ticket.status === TicketStatus.OPEN ? TicketStatus.IN_PROGRESS : ticket.status,
        version: { increment: 1 },
      },
      include: { assignee: { select: { id: true, name: true } } },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId, userId,
        action: 'ticket.assigned',
        resourceType: 'ticket',
        resourceId: id,
        metadata: { assigneeId },
      },
    });

    return updated;
  }

  async getStats(tenantId: string) {
    const [byStatus, byPriority, overdue, unassigned] = await Promise.all([
      this.prisma.ticket.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: { _all: true },
      }),
      this.prisma.ticket.groupBy({
        by: ['priority'],
        where: { tenantId, status: { notIn: [TicketStatus.CLOSED, TicketStatus.RESOLVED] } },
        _count: { _all: true },
      }),
      this.prisma.ticket.count({
        where: {
          tenantId,
          slaBreachAt: { lt: new Date() },
          status: { notIn: [TicketStatus.CLOSED, TicketStatus.RESOLVED] },
        },
      }),
      this.prisma.ticket.count({
        where: { tenantId, assigneeId: null, status: { not: TicketStatus.CLOSED } },
      }),
    ]);

    return { byStatus, byPriority, overdue, unassigned };
  }
}
