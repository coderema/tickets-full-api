import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly transporter: nodemailer.Transporter;
  private readonly from: string;
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly config: ConfigService) {
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

  async sendShowCancelled(to: string, customerName: string, showName: string): Promise<void> {
    await this.send(to, `Show Cancelled: ${showName}`, `
      <p>Dear ${customerName},</p>
      <p>We regret to inform you that <strong>${showName}</strong> has been cancelled.</p>
      <p>Please contact us regarding your refund.</p>
    `);
  }

  async sendShowDateCancelled(to: string, customerName: string, showName: string, date: string, time: string | null): Promise<void> {
    const when = time ? `${date} at ${time}` : date;
    await this.send(to, `Show Date Cancelled: ${showName}`, `
      <p>Dear ${customerName},</p>
      <p>The <strong>${showName}</strong> performance on <strong>${when}</strong> has been cancelled.</p>
      <p>Please contact us regarding your refund.</p>
    `);
  }

  async sendBookingCancelled(to: string, customerName: string, showName: string, date: string, time: string | null): Promise<void> {
    const when = time ? `${date} at ${time}` : date;
    await this.send(to, `Booking Cancelled: ${showName}`, `
      <p>Dear ${customerName},</p>
      <p>Your booking for <strong>${showName}</strong> on <strong>${when}</strong> has been cancelled.</p>
      <p>Please contact us if you have any questions.</p>
    `);
  }

  async sendShowDateUpdated(to: string, customerName: string, showName: string, date: string, time: string | null, capacity: number | null): Promise<void> {
    const when = time ? `${date} at ${time}` : date;
    await this.send(to, `Show Date Updated: ${showName}`, `
      <p>Dear ${customerName},</p>
      <p>Your booking for <strong>${showName}</strong> has been updated.</p>
      <p>New details: <strong>${when}</strong>${capacity ? ` — capacity: ${capacity}` : ''}</p>
      <p>Your booking remains valid. Please contact us if you have any questions.</p>
    `);
  }

  private async send(to: string, subject: string, html: string): Promise<void> {
    try {
      await this.transporter.sendMail({ from: this.from, to, subject, html });
    } catch (err) {
      this.logger.error(`Failed to send email to ${to}: ${err.message}`);
    }
  }
}
