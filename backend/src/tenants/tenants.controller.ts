import { Controller, Get, Patch, Post, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { TenantsService } from './tenants.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('tenants')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get('settings')
  getSettings(@CurrentUser() user: any) {
    return this.tenantsService.getSettings(user.tenantId);
  }

  @Patch('settings')
  @Roles(UserRole.ADMIN)
  updateSettings(@CurrentUser() user: any, @Body() body: any) {
    return this.tenantsService.updateSettings(user.tenantId, body);
  }

  // ─── API KEYS ─────────────────────────────────────────────────────────────
  @Get('api-keys')
  @Roles(UserRole.ADMIN)
  listApiKeys(@CurrentUser() user: any) {
    return this.tenantsService.listApiKeys(user.tenantId);
  }

  @Post('api-keys')
  @Roles(UserRole.ADMIN)
  createApiKey(@CurrentUser() user: any, @Body() body: { name: string; scopes: string[] }) {
    return this.tenantsService.createApiKey(user.tenantId, body.name, body.scopes);
  }

  @Delete('api-keys/:id')
  @Roles(UserRole.ADMIN)
  revokeApiKey(@Param('id') id: string, @CurrentUser() user: any) {
    return this.tenantsService.revokeApiKey(id, user.tenantId);
  }

  // ─── SLA ──────────────────────────────────────────────────────────────────
  @Get('sla')
  listSla(@CurrentUser() user: any) {
    return this.tenantsService.listSlaProfiles(user.tenantId);
  }

  @Patch('sla/:id')
  @Roles(UserRole.ADMIN)
  updateSla(@Param('id') id: string, @CurrentUser() user: any, @Body() body: any) {
    return this.tenantsService.updateSlaProfile(id, user.tenantId, body);
  }

  // ─── WEBHOOKS ─────────────────────────────────────────────────────────────
  @Get('webhooks')
  @Roles(UserRole.ADMIN)
  listWebhooks(@CurrentUser() user: any) {
    return this.tenantsService.listWebhooks(user.tenantId);
  }

  @Post('webhooks')
  @Roles(UserRole.ADMIN)
  createWebhook(@CurrentUser() user: any, @Body() body: any) {
    return this.tenantsService.createWebhook(user.tenantId, body);
  }

  @Patch('webhooks/:id')
  @Roles(UserRole.ADMIN)
  updateWebhook(@Param('id') id: string, @CurrentUser() user: any, @Body() body: any) {
    return this.tenantsService.updateWebhook(id, user.tenantId, body);
  }

  @Delete('webhooks/:id')
  @Roles(UserRole.ADMIN)
  deleteWebhook(@Param('id') id: string, @CurrentUser() user: any) {
    return this.tenantsService.deleteWebhook(id, user.tenantId);
  }

  // ─── CUSTOM FIELDS ────────────────────────────────────────────────────────
  @Get('custom-fields')
  listCustomFields(@CurrentUser() user: any) {
    return this.tenantsService.listCustomFields(user.tenantId);
  }

  @Post('custom-fields')
  @Roles(UserRole.ADMIN)
  createCustomField(@CurrentUser() user: any, @Body() body: any) {
    return this.tenantsService.createCustomField(user.tenantId, body);
  }

  @Patch('custom-fields/:id')
  @Roles(UserRole.ADMIN)
  updateCustomField(@Param('id') id: string, @CurrentUser() user: any, @Body() body: any) {
    return this.tenantsService.updateCustomField(id, user.tenantId, body);
  }

  // ─── AUDIT LOGS ───────────────────────────────────────────────────────────
  @Get('audit-logs')
  @Roles(UserRole.ADMIN)
  getAuditLogs(@CurrentUser() user: any, @Query() query: any) {
    return this.tenantsService.getAuditLogs(user.tenantId, query);
  }
}
