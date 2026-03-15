import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MessagesService {
  constructor(private prisma: PrismaService) {}

  async findByTicket(ticketId: string, tenantId: string, includeInternal = false) {
    const ticket = await this.prisma.ticket.findFirst({ where: { id: ticketId, tenantId } });
    if (!ticket) throw new NotFoundException('Ticket not found');

    return this.prisma.message.findMany({
      where: {
        ticketId,
        tenantId,
        isInternal: includeInternal ? undefined : false,
      },
      orderBy: { createdAt: 'asc' },
      include: { author: { select: { id: true, name: true, role: true } } },
    });
  }

  async create(ticketId: string, tenantId: string, authorId: string, data: any) {
    const ticket = await this.prisma.ticket.findFirst({ where: { id: ticketId, tenantId } });
    if (!ticket) throw new NotFoundException('Ticket not found');

    const message = await this.prisma.message.create({
      data: {
        tenantId,
        ticketId,
        authorId,
        authorType: 'agent',
        content: data.content,
        isInternal: data.isInternal || false,
      },
      include: { author: { select: { id: true, name: true, role: true } } },
    });

    // Set first response timestamp if not set
    if (!ticket.firstResponseAt) {
      await this.prisma.ticket.update({
        where: { id: ticketId },
        data: { firstResponseAt: new Date() },
      });
    }

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId: authorId,
        action: 'message.created',
        resourceType: 'ticket',
        resourceId: ticketId,
      },
    });

    return message;
  }

  // For API key authenticated requests (customer messages)
  async createCustomerMessage(ticketId: string, tenantId: string, data: any) {
    const ticket = await this.prisma.ticket.findFirst({ where: { id: ticketId, tenantId } });
    if (!ticket) throw new NotFoundException('Ticket not found');

    return this.prisma.message.create({
      data: {
        tenantId,
        ticketId,
        authorType: 'customer',
        content: data.content,
        isInternal: false,
      },
    });
  }
}
