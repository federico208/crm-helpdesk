import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { TicketsService } from './tickets.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('tickets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get()
  findAll(@CurrentUser() user: any, @Query() query: any) {
    return this.ticketsService.findAll(user.tenantId, query);
  }

  @Get('stats')
  getStats(@CurrentUser() user: any) {
    return this.ticketsService.getStats(user.tenantId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.ticketsService.findOne(id, user.tenantId);
  }

  @Post()
  @Roles(UserRole.AGENT)
  create(@CurrentUser() user: any, @Body() body: any) {
    return this.ticketsService.create(user.tenantId, user.id, body);
  }

  @Patch(':id')
  @Roles(UserRole.AGENT)
  update(@Param('id') id: string, @CurrentUser() user: any, @Body() body: any) {
    return this.ticketsService.update(id, user.tenantId, user.id, body);
  }

  @Patch(':id/assign')
  @Roles(UserRole.AGENT)
  assign(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() body: { assigneeId: string | null },
  ) {
    return this.ticketsService.assign(id, user.tenantId, body.assigneeId, user.id);
  }
}
