import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('kpi')
  getKpi(@CurrentUser() user: any, @Query('days') days: number = 30) {
    return this.analyticsService.getKpi(user.tenantId, Number(days));
  }

  @Get('trend')
  getTrend(@CurrentUser() user: any, @Query('days') days: number = 30) {
    return this.analyticsService.getTicketTrend(user.tenantId, Number(days));
  }
}
