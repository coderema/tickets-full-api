import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as nodemailer from 'nodemailer';
import { EmailTemplate } from '../entities/email-template.entity';

@Injectable()
export class MailService {
  private readonly transporter: nodemailer.Transporter;
  private readonly from: string;
  private readonly logger = new Logger(MailService.name);

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(EmailTemplate)
    private readonly templatesRepo: Repository<EmailTemplate>,
  ) {
    this.transporter = nodemailer.createTransport({
      host: config.get<string>('MAIL_HOST'),
      port: config.get<number>('MAIL_PORT') ?? 587,
      secure: config.get<string>('MAIL_SECURE') === 'true',
      auth: {
        user: config.get<string>('MAIL_USER'),
        pass: config.get<string>('MAIL_PASS'),
      },
    });
    this.from = config.get<string>('MAIL_FROM') ?? 'noreply@tickets.local';
  }

  async sendBookingConfirmed(to: string, vars: {
    customerName: string;
    showName: string;
    showDate: string;
    showTime: string | null;
    bookingUuid: string;
    totalAmount: string;
    ticketLinksHtml: string;
  }): Promise<void> {
    await this.renderAndSend('booking_confirmation', to, {
      ...vars,
      showTime: vars.showTime ? ` at ${vars.showTime}` : '',
    });
  }

  async sendBookingCancelled(to: string, vars: {
    customerName: string;
    showName: string;
    showDate: string;
    showTime: string | null;
    bookingUuid: string;
    totalAmount: string;
  }): Promise<void> {
    await this.renderAndSend('booking_cancellation', to, {
      ...vars,
      showTime: vars.showTime ? ` at ${vars.showTime}` : '',
    });
  }

  async sendShowCancelled(to: string, vars: {
    customerName: string;
    showName: string;
  }): Promise<void> {
    await this.renderAndSend('show_cancellation', to, vars);
  }

  async sendShowDateCancelled(to: string, vars: {
    customerName: string;
    showName: string;
    showDate: string;
    showTime: string | null;
  }): Promise<void> {
    await this.renderAndSend('show_date_cancellation', to, {
      ...vars,
      showTime: vars.showTime ? ` at ${vars.showTime}` : '',
    });
  }

  async sendShowDateUpdated(to: string, vars: {
    customerName: string;
    showName: string;
    showDate: string;
    showTime: string | null;
    capacity: number | null;
  }): Promise<void> {
    await this.renderAndSend('show_date_updated', to, {
      ...vars,
      showTime: vars.showTime ? ` at ${vars.showTime}` : '',
      capacity: vars.capacity !== null ? ` — capacity: ${vars.capacity}` : '',
    });
  }

  private async renderAndSend(key: string, to: string, vars: Record<string, string>): Promise<void> {
    const template = await this.templatesRepo.findOne({ where: { key } });
    if (!template) {
      this.logger.warn(`Email template '${key}' not found, skipping send to ${to}`);
      return;
    }
    const render = (str: string) =>
      str.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '');
    await this.send(to, render(template.subject), render(template.body));
  }

  private async send(to: string, subject: string, html: string): Promise<void> {
    try {
      await this.transporter.sendMail({ from: this.from, to, subject, html });
    } catch (err) {
      this.logger.error(`Failed to send email to ${to}: ${err.message}`);
    }
  }
}
