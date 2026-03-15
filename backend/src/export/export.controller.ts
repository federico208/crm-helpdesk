import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { ExportService, ExportLevel } from './export.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('export')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('export')
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  @Get('tickets')
  @Roles(UserRole.AGENT)
  async exportTickets(
    @CurrentUser() user: any,
    @Query('level') level: ExportLevel = 'anonymized',
    @Query('format') format: 'csv' | 'json' = 'csv',
    @Query('status') status: string,
    @Query('priority') priority: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Res() res: Response,
  ) {
    // Enforce level restrictions by role
    const effectiveLevel: ExportLevel =
      user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN
        ? level
        : level === 'full' ? 'anonymized' : level;

    const data = await this.exportService.exportTickets(
      user.tenantId,
      user.id,
      effectiveLevel,
      { status, priority, from, to },
    );

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `tickets-${effectiveLevel}-${timestamp}`;

    if (format === 'json' || effectiveLevel === 'aggregate') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
      return res.send(JSON.stringify(data, null, 2));
    }

    const csv = this.exportService.toCsv(data as any[]);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
    return res.send(csv);
  }
}
