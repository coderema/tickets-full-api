import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailTemplate } from '../../core/entities/email-template.entity';

const DEFAULTS: Omit<EmailTemplate, 'updatedAt'>[] = [
  {
    key: 'booking_confirmation',
    name: 'Booking Confirmation',
    subject: 'Booking Confirmed: {{showName}}',
    body: `<p>Dear {{customerName}},</p>
<p>Your booking for <strong>{{showName}}</strong> on <strong>{{showDate}}{{showTime}}</strong> has been confirmed.</p>
<p>Booking reference: <strong>{{bookingUuid}}</strong></p>
<p>Total amount: <strong>{{totalAmount}}</strong></p>
<p>Your tickets are ready to view and print:</p>
{{ticketLinksHtml}}
<p>Thank you for your booking!</p>`,
    variables: ['customerName', 'showName', 'showDate', 'showTime', 'bookingUuid', 'totalAmount', 'ticketLinksHtml'],
  },
  {
    key: 'booking_cancellation',
    name: 'Booking Cancellation',
    subject: 'Booking Cancelled: {{showName}}',
    body: `<p>Dear {{customerName}},</p>
<p>Your booking for <strong>{{showName}}</strong> on <strong>{{showDate}}{{showTime}}</strong> has been cancelled.</p>
<p>Booking reference: <strong>{{bookingUuid}}</strong></p>
<p>Total amount: <strong>{{totalAmount}}</strong></p>
<p>Please contact us if you have any questions.</p>`,
    variables: ['customerName', 'showName', 'showDate', 'showTime', 'bookingUuid', 'totalAmount'],
  },
  {
    key: 'show_cancellation',
    name: 'Show Cancellation',
    subject: 'Show Cancelled: {{showName}}',
    body: `<p>Dear {{customerName}},</p>
<p>We regret to inform you that <strong>{{showName}}</strong> has been cancelled.</p>
<p>Please contact us regarding your refund.</p>`,
    variables: ['customerName', 'showName'],
  },
  {
    key: 'show_date_cancellation',
    name: 'Show Date Cancellation',
    subject: 'Show Date Cancelled: {{showName}}',
    body: `<p>Dear {{customerName}},</p>
<p>The <strong>{{showName}}</strong> performance on <strong>{{showDate}}{{showTime}}</strong> has been cancelled.</p>
<p>Please contact us regarding your refund.</p>`,
    variables: ['customerName', 'showName', 'showDate', 'showTime'],
  },
  {
    key: 'show_date_updated',
    name: 'Show Date Updated',
    subject: 'Show Date Updated: {{showName}}',
    body: `<p>Dear {{customerName}},</p>
<p>Your booking for <strong>{{showName}}</strong> has been updated.</p>
<p>New details: <strong>{{showDate}}{{showTime}}</strong>{{capacity}}</p>
<p>Your booking remains valid. Please contact us if you have any questions.</p>`,
    variables: ['customerName', 'showName', 'showDate', 'showTime', 'capacity'],
  },
];

@Injectable()
export class EmailTemplatesService implements OnModuleInit {
  constructor(
    @InjectRepository(EmailTemplate)
    private readonly repo: Repository<EmailTemplate>,
  ) {}

  async onModuleInit() {
    for (const defaults of DEFAULTS) {
      const exists = await this.repo.findOne({ where: { key: defaults.key } });
      if (!exists) {
        await this.repo.save(this.repo.create(defaults));
      }
    }
  }

  findAll(): Promise<EmailTemplate[]> {
    return this.repo.find({ order: { key: 'ASC' } });
  }

  async findOne(key: string): Promise<EmailTemplate> {
    const template = await this.repo.findOne({ where: { key } });
    if (!template) throw new NotFoundException(`Email template '${key}' not found`);
    return template;
  }

  async update(key: string, dto: { subject?: string; body?: string }): Promise<EmailTemplate> {
    const template = await this.findOne(key);
    Object.assign(template, dto);
    return this.repo.save(template);
  }

  async preview(key: string, dto: { subject: string; body: string }): Promise<{ html: string }> {
    const template = await this.findOne(key);
    const sampleValues: Record<string, string> = {
      customerName: 'Jane Smith',
      customerEmail: 'jane@example.com',
      showName: template.name.replace('Booking ', '').replace('Show ', ''),
      showDate: '2026-06-15',
      showTime: ' at 19:30',
      bookingUuid: 'abc123-preview',
      totalAmount: '$45.00',
      capacity: ' — capacity: 200',
      ticketLinksHtml: '<a href="#" style="display:block;margin:8px 0">View ticket for Jane Smith</a>',
    };

    const render = (str: string) =>
      str.replace(/\{\{(\w+)\}\}/g, (_, k) => sampleValues[k] ?? `{{${k}}}`);

    const renderedSubject = render(dto.subject);
    const renderedBody = render(dto.body);

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${renderedSubject}</title>
<style>body{font-family:sans-serif;max-width:600px;margin:40px auto;padding:0 20px}
.subject{background:#f5f5f5;padding:12px 16px;border-radius:4px;margin-bottom:24px;font-weight:600}</style>
</head>
<body>
<div class="subject">Subject: ${renderedSubject}</div>
${renderedBody}
</body>
</html>`;

    return { html };
  }
}
