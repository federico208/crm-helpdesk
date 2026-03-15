import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { MessagesService } from './messages.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('messages')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tickets/:ticketId/messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get()
  findAll(
    @Param('ticketId') ticketId: string,
    @CurrentUser() user: any,
    @Query('includeInternal') includeInternal: string,
  ) {
    return this.messagesService.findByTicket(
      ticketId,
      user.tenantId,
      includeInternal === 'true',
    );
  }

  @Post()
  create(
    @Param('ticketId') ticketId: string,
    @CurrentUser() user: any,
    @Body() body: { content: string; isInternal?: boolean },
  ) {
    return this.messagesService.create(ticketId, user.tenantId, user.id, body);
  }
}
