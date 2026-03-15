import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import axios from 'axios';
import * as crypto from 'crypto';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(private prisma: PrismaService) {}

  async trigger(tenantId: string, event: string, payload: any) {
    const webhooks = await this.prisma.webhook.findMany({
      where: { tenantId, isActive: true, events: { has: event } },
    });

    for (const webhook of webhooks) {
      this.dispatch(webhook, event, payload).catch((err) => {
        this.logger.error(`Webhook dispatch failed for ${webhook.id}: ${err.message}`);
      });
    }
  }

  private async dispatch(webhook: any, event: string, payload: any) {
    const body = JSON.stringify({
      event,
      timestamp: new Date().toISOString(),
      data: payload,
    });

    const signature = crypto
      .createHmac('sha256', webhook.secret)
      .update(body)
      .digest('hex');

    try {
      await axios.post(webhook.url, body, {
        headers: {
          'Content-Type': 'application/json',
          'X-CRM-Event': event,
          'X-CRM-Signature': `sha256=${signature}`,
          'X-CRM-Delivery': crypto.randomUUID(),
        },
        timeout: 10000,
      });
      this.logger.log(`Webhook ${webhook.id} delivered: ${event}`);
    } catch (err) {
      this.logger.warn(`Webhook ${webhook.id} failed: ${err.message}`);
    }
  }
}
