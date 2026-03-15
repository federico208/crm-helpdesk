import { Controller, Post, Get, Body, Headers, UnauthorizedException, Param } from '@nestjs/common';
import { ApiTags, ApiSecurity, ApiOperation } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { TenantsService } from '../tenants/tenants.service';
import { TicketsService } from '../tickets/tickets.service';
import { MessagesService } from '../messages/messages.service';
import * as crypto from 'crypto';

// Guard for API key auth
async function validateApiKey(rawKey: string | undefined, tenantsService: TenantsService) {
  if (!rawKey) throw new UnauthorizedException('X-API-Key header required');
  const result = await tenantsService.validateApiKey(rawKey);
  if (!result) throw new UnauthorizedException('Invalid or revoked API key');
  return result;
}

@ApiTags('api-integration')
@ApiSecurity('api-key')
@Controller('v1')
export class ApiIntegrationController {
  constructor(
    private prisma: PrismaService,
    private tenantsService: TenantsService,
    private ticketsService: TicketsService,
    private messagesService: MessagesService,
  ) {}

  @Post('tickets')
  @ApiOperation({ summary: 'Create a ticket via API key (external integration)' })
  async createTicket(
    @Headers('x-api-key') apiKey: string,
    @Body() body: any,
  ) {
    const { tenantId } = await validateApiKey(apiKey, this.tenantsService);

    // Use a system user (first admin) as creator
    const adminUser = await this.prisma.user.findFirst({
      where: { tenantId, role: 'ADMIN', isActive: true },
    });
    if (!adminUser) throw new UnauthorizedException('Tenant not configured');

    return this.ticketsService.create(tenantId, adminUser.id, {
      title: body.title,
      description: body.description || body.title,
      priority: body.priority || 'MEDIUM',
      customerEmail: body.customerEmail,
      customerName: body.customerName,
      customerPhone: body.customerPhone,
      tags: body.tags || [],
      customFields: body.customFields || {},
    });
  }

  @Get('tickets')
  @ApiOperation({ summary: 'List tickets via API key' })
  async listTickets(
    @Headers('x-api-key') apiKey: string,
  ) {
    const { tenantId } = await validateApiKey(apiKey, this.tenantsService);
    return this.ticketsService.findAll(tenantId, { limit: 50 });
  }

  @Get('tickets/:id')
  @ApiOperation({ summary: 'Get a ticket via API key' })
  async getTicket(
    @Headers('x-api-key') apiKey: string,
    @Param('id') id: string,
  ) {
    const { tenantId } = await validateApiKey(apiKey, this.tenantsService);
    return this.ticketsService.findOne(id, tenantId);
  }

  @Post('tickets/:id/messages')
  @ApiOperation({ summary: 'Add a customer message to a ticket' })
  async addMessage(
    @Headers('x-api-key') apiKey: string,
    @Param('id') ticketId: string,
    @Body() body: { content: string },
  ) {
    const { tenantId } = await validateApiKey(apiKey, this.tenantsService);
    return this.messagesService.createCustomerMessage(ticketId, tenantId, body);
  }
}
