import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { TenantsModule } from './tenants/tenants.module';
import { TicketsModule } from './tickets/tickets.module';
import { MessagesModule } from './messages/messages.module';
import { ExportModule } from './export/export.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { PrismaService } from './prisma/prisma.service';
import { TenantsService } from './tenants/tenants.service';
import { TicketsService } from './tickets/tickets.service';
import { MessagesService } from './messages/messages.service';
import { ApiIntegrationController } from './webhooks/api-integration.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    UsersModule,
    TenantsModule,
    TicketsModule,
    MessagesModule,
    ExportModule,
    AnalyticsModule,
    WebhooksModule,
  ],
  controllers: [ApiIntegrationController],
  providers: [PrismaService, TenantsService, TicketsService, MessagesService],
})
export class AppModule {}
