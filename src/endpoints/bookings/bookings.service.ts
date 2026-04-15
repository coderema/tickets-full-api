import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import * as Handlebars from 'handlebars';
import * as QRCode from 'qrcode';
import * as https from 'https';
import * as http from 'http';
import { Booking, BookingStatus, Payment, CashPayment, Ticket, TicketType, ShowDate } from '../../core/entities/schema.entity';
import { PaymentGateway, PaymentStatus } from '../../core/entities/enums';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { GetRequestParams, PageModel } from '../../core/models/page.model';
import { MailService } from '../../core/mail/mail.service';

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
    @InjectRepository(Ticket)
    private readonly ticketsRepository: Repository<Ticket>,
    @InjectRepository(TicketType)
    private readonly ticketTypesRepository: Repository<TicketType>,
    @InjectRepository(ShowDate)
    private readonly showDatesRepository: Repository<ShowDate>,
    @InjectRepository(Payment)
    private readonly paymentsRepository: Repository<Payment>,
    @InjectRepository(CashPayment)
    private readonly cashPaymentsRepository: Repository<CashPayment>,
    private readonly mailService: MailService,
    private readonly config: ConfigService,
  ) {}

  async create(createBookingDto: CreateBookingDto, receivedBy: string): Promise<Booking> {
    const showDate = await this.showDatesRepository.findOne({
      where: { uuid: createBookingDto.showDateUuid },
    });
    if (!showDate) throw new NotFoundException(`ShowDate #${createBookingDto.showDateUuid} not found`);

    const ticketTypeUuids = createBookingDto.tickets.map((t) => t.ticketTypeUuid);
    const ticketTypes = await this.ticketTypesRepository.findBy({ uuid: In(ticketTypeUuids) });
    const ticketTypeMap = new Map(ticketTypes.map((tt) => [tt.uuid, tt]));

    const missing = ticketTypeUuids.filter((uuid) => !ticketTypeMap.has(uuid));
    if (missing.length) throw new NotFoundException(`TicketType(s) not found: ${missing.join(', ')}`);

    const totalAmount = createBookingDto.tickets.reduce((sum, t) => sum + +t.unitPrice, 0);

    const booking = await this.bookingsRepository.save(
      this.bookingsRepository.create({
        showDateId: showDate.id,
        customerName: createBookingDto.customerName,
        customerEmail: createBookingDto.customerEmail,
        totalAmount,
        status: BookingStatus.CONFIRMED,
      }),
    );

    await this.ticketsRepository.save(
      createBookingDto.tickets.map((t) =>
        this.ticketsRepository.create({
          bookingId: booking.id,
          ticketTypeId: ticketTypeMap.get(t.ticketTypeUuid)!.id,
          holderName: t.holderName,
          unitPrice: t.unitPrice,
        }),
      ),
    );

    const payment = await this.paymentsRepository.save(
      this.paymentsRepository.create({
        bookingId: booking.id,
        amount: totalAmount,
        gateway: PaymentGateway.CASH,
        status: PaymentStatus.SUCCEEDED,
      }),
    );

    await this.cashPaymentsRepository.save(
      this.cashPaymentsRepository.create({
        paymentId: payment.id,
        receivedBy,
      }),
    );

    return booking;
  }

  async findAll(
    params: GetRequestParams,
    filters?: { search?: string; dateFrom?: string; dateTo?: string; showUuid?: string; showDateUuid?: string; status?: string },
  ): Promise<PageModel<Booking> | Partial<Booking>[]> {
    if (!params.pagination) {
      const query = this.bookingsRepository
        .createQueryBuilder('booking')
        .leftJoin('booking.showDate', 'showDate')
        .leftJoin('showDate.show', 'show');

      if (params.fields?.length) {
        query.select([
          ...params.fields.map((f) => `booking.${f}`),
          'showDate.date', 'showDate.time',
          'show.name',
        ]);
      }

      if (filters?.search) {
        query.andWhere(
          '(booking.customerName LIKE :search OR booking.customerEmail LIKE :search)',
          { search: `%${filters.search}%` },
        );
      }
      if (filters?.dateFrom) {
        query.andWhere('showDate.date >= :dateFrom', { dateFrom: filters.dateFrom });
      }
      if (filters?.dateTo) {
        query.andWhere('showDate.date <= :dateTo', { dateTo: filters.dateTo });
      }
      if (filters?.showUuid) {
        query.andWhere('show.uuid = :showUuid', { showUuid: filters.showUuid });
      }
      if (filters?.showDateUuid) {
        query.andWhere('showDate.uuid = :showDateUuid', { showDateUuid: filters.showDateUuid });
      }
      if (filters?.status) {
        query.andWhere('booking.status = :status', { status: filters.status });
      }

      return query.getMany();
    }

    const { page, pageSize, cursor, orderBy, orderDirection, filter } = params.page;
    const query = this.bookingsRepository
      .createQueryBuilder('booking')
      .leftJoinAndSelect('booking.showDate', 'showDate')
      .leftJoinAndSelect('showDate.show', 'show');

    if (params.fields?.length) {
      query.select([
        ...params.fields.map((f) => `booking.${f}`),
        'showDate.date', 'showDate.time',
        'show.name',
      ]);
    }

    if (filter) {
      Object.entries(filter).forEach(([key, value]) => {
        query.andWhere(`booking.${key} LIKE :${key}`, { [key]: `%${value}%` });
      });
    }

    if (filters?.search) {
      query.andWhere(
        '(booking.customerName LIKE :search OR booking.customerEmail LIKE :search)',
        { search: `%${filters.search}%` },
      );
    }

    if (filters?.dateFrom) {
      query.andWhere('showDate.date >= :dateFrom', { dateFrom: filters.dateFrom });
    }

    if (filters?.dateTo) {
      query.andWhere('showDate.date <= :dateTo', { dateTo: filters.dateTo });
    }

    if (filters?.showUuid) {
      query.andWhere('show.uuid = :showUuid', { showUuid: filters.showUuid });
    }

    if (filters?.showDateUuid) {
      query.andWhere('showDate.uuid = :showDateUuid', { showDateUuid: filters.showDateUuid });
    }

    if (filters?.status) {
      query.andWhere('booking.status = :status', { status: filters.status });
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
      relations: ['tickets', 'tickets.ticketType', 'payment', 'payment.cashPayment', 'showDate', 'showDate.show'],
    });
    if (!booking) throw new NotFoundException(`Booking #${uuid} not found`);
    return booking;
  }

  async update(uuid: string, updateBookingDto: UpdateBookingDto): Promise<Booking> {
    const booking = await this.findOne(uuid);
    Object.assign(booking, updateBookingDto);
    return this.bookingsRepository.save(booking);
  }

  async confirmBooking(uuid: string): Promise<Booking> {
    const booking = await this.bookingsRepository.findOne({
      where: { uuid },
      relations: ['showDate', 'showDate.show', 'tickets'],
    });
    if (!booking) throw new NotFoundException(`Booking #${uuid} not found`);
    if (booking.status === BookingStatus.CONFIRMED) {
      throw new BadRequestException('Booking is already confirmed.');
    }
    if (booking.status === BookingStatus.CANCELLED) {
      throw new BadRequestException('Cancelled bookings cannot be confirmed.');
    }
    booking.status = BookingStatus.CONFIRMED;
    await this.bookingsRepository.save(booking);

    const appUrl = this.config.get<string>('APP_URL') ?? '';
    const ticketLinksHtml = (booking.tickets ?? [])
      .map((t) => `<a href="${appUrl}/public/tickets/${booking.uuid}/${t.uuid}" style="display:block;margin:8px 0;padding:12px 16px;background:#1a1a1a;color:#ffffff;text-decoration:none;border-radius:4px;font-size:14px;font-weight:600">View ticket for ${t.holderName} &rarr;</a>`)
      .join('');

    await this.mailService.sendBookingConfirmed(booking.customerEmail, {
      customerName: booking.customerName,
      showName: booking.showDate.show.name,
      showDate: booking.showDate.date,
      showTime: booking.showDate.time,
      bookingUuid: booking.uuid,
      totalAmount: `$${Number(booking.totalAmount).toFixed(2)}`,
      ticketLinksHtml,
    });

    return booking;
  }

  async cancelBooking(uuid: string): Promise<Booking> {
    const booking = await this.bookingsRepository.findOne({
      where: { uuid },
      relations: ['showDate', 'showDate.show'],
    });
    if (!booking) throw new NotFoundException(`Booking #${uuid} not found`);
    if (booking.status === BookingStatus.CANCELLED) {
      throw new BadRequestException('Booking is already cancelled.');
    }

    booking.status = BookingStatus.CANCELLED;
    await this.bookingsRepository.save(booking);

    await this.mailService.sendBookingCancelled(booking.customerEmail, {
      customerName: booking.customerName,
      showName: booking.showDate.show.name,
      showDate: booking.showDate.date,
      showTime: booking.showDate.time,
      bookingUuid: booking.uuid,
      totalAmount: `$${Number(booking.totalAmount).toFixed(2)}`,
    });

    return booking;
  }

  async remove(uuid: string): Promise<void> {
    const booking = await this.findOne(uuid);
    await this.bookingsRepository.remove(booking);
  }

  async generateTicketHtml(bookingUuid: string, ticketUuid: string): Promise<{ ticket: string }> {
    const booking = await this.bookingsRepository.findOne({
      where: { uuid: bookingUuid },
      relations: ['tickets', 'tickets.ticketType', 'showDate', 'showDate.show', 'showDate.show.image'],
    });
    if (!booking) throw new NotFoundException(`Booking #${bookingUuid} not found`);

    const ticketRecord = booking.tickets.find((t) => t.uuid === ticketUuid);
    if (!ticketRecord) throw new NotFoundException(`Ticket #${ticketUuid} not found in booking #${bookingUuid}`);

    const show = booking.showDate.show;
    const showDateStr = [booking.showDate.date, booking.showDate.time].filter(Boolean).join(' ');
    const purchaseDate = booking.createdAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    const showImageUrl = show.image?.url ?? null;

    const [showImageBase64, qrDataUrl] = await Promise.all([
      showImageUrl ? fetchImageAsBase64(showImageUrl) : Promise.resolve(null),
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
        .where('booking.status != :cancelled', { cancelled: BookingStatus.CANCELLED })
        .select('COUNT(booking.id)', 'bookings')
        .addSelect('SUM(booking.totalAmount)', 'totalCash')
        .getRawOne(),
      this.bookingsRepository
        .createQueryBuilder('booking')
        .leftJoin('booking.tickets', 'ticket')
        .where('booking.status != :cancelled', { cancelled: BookingStatus.CANCELLED })
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
