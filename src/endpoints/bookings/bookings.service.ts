import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import * as Handlebars from 'handlebars';
import * as QRCode from 'qrcode';
import * as https from 'https';
import * as http from 'http';
import { Booking } from '../../core/entities/schema.entity';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { GetRequestParams, PageModel } from '../../core/models/page.model';

const compiledTemplate = Handlebars.compile(
  fs.readFileSync(path.join(__dirname, 'templates', 'ticket.hbs'), 'utf8'),
);

function fetchImageAsBase64(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const b64 = Buffer.concat(chunks).toString('base64');
        const mime = res.headers['content-type'] ?? 'image/jpeg';
        resolve(`data:${mime};base64,${b64}`);
      });
      res.on('error', reject);
    }).on('error', reject);
  });
}

@Injectable()
export class BookingsService {
  constructor(
    @InjectRepository(Booking)
    private readonly bookingsRepository: Repository<Booking>,
  ) {}

  create(createBookingDto: CreateBookingDto): Promise<Booking> {
    const booking = this.bookingsRepository.create(createBookingDto);
    return this.bookingsRepository.save(booking);
  }

  async findAll(params: GetRequestParams): Promise<PageModel<Booking> | Partial<Booking>[]> {
    if (!params.pagination) {
      const query = this.bookingsRepository.createQueryBuilder('booking');
      query.select(params.fields.map((f) => `booking.${f}`));
      return query.getMany();
    }

    const { page, pageSize, cursor, orderBy, orderDirection, filter } = params.page;
    const query = this.bookingsRepository.createQueryBuilder('booking');

    if (params.fields?.length) {
      query.select(params.fields.map((f) => `booking.${f}`));
    }

    if (filter) {
      Object.entries(filter).forEach(([key, value]) => {
        query.andWhere(`booking.${key} LIKE :${key}`, { [key]: `%${value}%` });
      });
    }

    if (cursor) {
      query.andWhere('booking.createdAt > :cursor', { cursor });
    }

    if (orderBy) {
      query.orderBy(`booking.${orderBy}`, orderDirection?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC');
    }

    const total = await query.getCount();
    const data = await query
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getMany();

    return { pageNumber: page, pageSize, total, totalPages: Math.ceil(total / pageSize), data };
  }

  async findOne(uuid: string): Promise<Booking> {
    const booking = await this.bookingsRepository.findOne({
      where: { uuid },
      relations: ['tickets', 'tickets.ticketType', 'payment', 'showDate'],
    });
    if (!booking) throw new NotFoundException(`Booking #${uuid} not found`);
    return booking;
  }

  async update(uuid: string, updateBookingDto: UpdateBookingDto): Promise<Booking> {
    const booking = await this.findOne(uuid);
    Object.assign(booking, updateBookingDto);
    return this.bookingsRepository.save(booking);
  }

  async remove(uuid: string): Promise<void> {
    const booking = await this.findOne(uuid);
    await this.bookingsRepository.remove(booking);
  }

  async generateTicketHtml(bookingUuid: string, ticketUuid: string): Promise<{ ticket: string }> {
    const booking = await this.bookingsRepository.findOne({
      where: { uuid: bookingUuid },
      relations: ['tickets', 'tickets.ticketType', 'showDate', 'showDate.show'],
    });
    if (!booking) throw new NotFoundException(`Booking #${bookingUuid} not found`);

    const ticketRecord = booking.tickets.find((t) => t.uuid === ticketUuid);
    if (!ticketRecord) throw new NotFoundException(`Ticket #${ticketUuid} not found in booking #${bookingUuid}`);

    const show = booking.showDate.show;
    const showDateStr = [booking.showDate.date, booking.showDate.time].filter(Boolean).join(' ');
    const purchaseDate = booking.createdAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    const showImageUrl = 'https://fineartsguild.org/wp-content/uploads/2026/02/ecef77dd-1.png';

    const [showImageBase64, qrDataUrl] = await Promise.all([
      fetchImageAsBase64(showImageUrl),
      QRCode.toDataURL(ticketRecord.uuid, { width: 120, margin: 1 }),
    ]);

    const tickets = [{
      id: ticketRecord.uuid,
      name: ticketRecord.holderName,
      type: ticketRecord.ticketType?.name ?? '',
      price: Number(ticketRecord.unitPrice).toFixed(2),
      qrDataUrl,
    }];

    const html = compiledTemplate({
      tickets,
      bookingRef: booking.uuid,
      logoUrl: show.logoUrl ?? null,
      showTitle: show.name,
      showDate: showDateStr,
      showImageUrl: showImageBase64,
      customerName: booking.customerName,
      purchaseDate,
    });

    return { ticket: html };
  }

  async count(): Promise<{ bookings: number; totalCash: number; ticketsSold: number }> {
    const [bookingStats, ticketStats] = await Promise.all([
      this.bookingsRepository
        .createQueryBuilder('booking')
        .select('COUNT(booking.id)', 'bookings')
        .addSelect('SUM(booking.totalAmount)', 'totalCash')
        .getRawOne(),
      this.bookingsRepository
        .createQueryBuilder('booking')
        .leftJoin('booking.tickets', 'ticket')
        .select('COUNT(ticket.id)', 'ticketsSold')
        .getRawOne(),
    ]);

    return {
      bookings: Number(bookingStats.bookings),
      totalCash: Number(bookingStats.totalCash ?? 0),
      ticketsSold: Number(ticketStats.ticketsSold ?? 0),
    };
  }
}
