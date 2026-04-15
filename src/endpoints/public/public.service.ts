import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Stripe from 'stripe';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import * as Handlebars from 'handlebars';
import * as QRCode from 'qrcode';
import * as https from 'https';
import * as http from 'http';
import { Show } from '../../core/entities/show.entity';
import { ShowDate } from '../../core/entities/show-date.entity';
import { TicketType } from '../../core/entities/ticket-type.entity';
import { Booking } from '../../core/entities/booking.entity';
import { Ticket } from '../../core/entities/ticket.entity';
import { Payment } from '../../core/entities/payment.entity';
import { StripeTransaction } from '../../core/entities/stripe-transaction.entity';
import { ContentStatus, BookingStatus, PaymentGateway, PaymentStatus } from '../../core/entities/enums';
import { PublicBookingDto } from './dto/public-booking.dto';
import { MailService } from '../../core/mail/mail.service';

const compiledTemplate = Handlebars.compile(
  fs.readFileSync(path.join(__dirname, '..', 'bookings', 'templates', 'ticket.hbs'), 'utf8'),
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
export class PublicService {
  private readonly stripe: Stripe;

  constructor(
    @InjectRepository(Show)
    private readonly showsRepository: Repository<Show>,
    @InjectRepository(ShowDate)
    private readonly showDatesRepository: Repository<ShowDate>,
    @InjectRepository(TicketType)
    private readonly ticketTypesRepository: Repository<TicketType>,
    @InjectRepository(Booking)
    private readonly bookingsRepository: Repository<Booking>,
    @InjectRepository(Ticket)
    private readonly ticketsRepository: Repository<Ticket>,
    @InjectRepository(Payment)
    private readonly paymentsRepository: Repository<Payment>,
    @InjectRepository(StripeTransaction)
    private readonly stripeTransactionsRepository: Repository<StripeTransaction>,
    private readonly config: ConfigService,
    private readonly mailService: MailService,
  ) {
    this.stripe = new Stripe(this.config.get<string>('STRIPE_SECRET_KEY')!);
  }

  async getShow(uuid: string) {
    const show = await this.showsRepository.findOne({
      where: { uuid, status: ContentStatus.PUBLISHED },
    });
    if (!show) throw new NotFoundException('Show not found');

    const [showDates, ticketTypes] = await Promise.all([
      this.showDatesRepository
        .createQueryBuilder('showDate')
        .leftJoin('showDate.bookings', 'booking')
        .leftJoin('booking.tickets', 'ticket')
        .where('showDate.showId = :showId', { showId: show.id })
        .andWhere('showDate.status = :status', { status: ContentStatus.PUBLISHED })
        .select('showDate.uuid', 'uuid')
        .addSelect('showDate.date', 'date')
        .addSelect('showDate.time', 'time')
        .addSelect('showDate.capacity', 'capacity')
        .addSelect('COUNT(DISTINCT ticket.id)', 'soldCount')
        .groupBy('showDate.uuid')
        .addGroupBy('showDate.date')
        .addGroupBy('showDate.time')
        .addGroupBy('showDate.capacity')
        .orderBy('showDate.date', 'ASC')
        .addOrderBy('showDate.time', 'ASC')
        .getRawMany<{ uuid: string; date: string; time: string | null; capacity: string | null; soldCount: string }>(),

      this.ticketTypesRepository.find({
        where: { showId: show.id, isActive: true },
        order: { name: 'ASC' },
      }),
    ]);

    return {
      uuid: show.uuid,
      name: show.name,
      description: show.description,
      logoUrl: show.logoUrl,
      dates: showDates.map((d) => {
        const capacity = d.capacity !== null ? Number(d.capacity) : null;
        const soldCount = Number(d.soldCount);
        return {
          uuid: d.uuid,
          date: d.date,
          time: d.time,
          capacity,
          availableCapacity: capacity !== null ? capacity - soldCount : null,
        };
      }),
      ticketTypes: ticketTypes.map((tt) => ({
        uuid: tt.uuid,
        name: tt.name,
        price: Number(tt.price),
        description: tt.description,
      })),
    };
  }

  async createBooking(dto: PublicBookingDto): Promise<{ bookingUuid: string; tickets: string[] }> {
    // 1. Validate show date
    const showDate = await this.showDatesRepository.findOne({
      where: { uuid: dto.showDateUuid, status: ContentStatus.PUBLISHED },
      relations: ['show'],
    });
    if (!showDate) throw new NotFoundException('Show date not found or not available.');

    if (showDate.show.status !== ContentStatus.PUBLISHED) {
      throw new BadRequestException('Show is not available for booking.');
    }

    // 2. Resolve ticket types
    const ticketTypeUuids = [...new Set(dto.ticketData.map((t) => t.ticketTypeUuid))];
    const ticketTypes = await this.ticketTypesRepository.findBy(
      ticketTypeUuids.map((uuid) => ({ uuid, showId: showDate.show.id, isActive: true })),
    );
    const ticketTypeMap = new Map(ticketTypes.map((tt) => [tt.uuid, tt]));

    const missing = ticketTypeUuids.filter((uuid) => !ticketTypeMap.has(uuid));
    if (missing.length) throw new BadRequestException('One or more ticket types are invalid or unavailable.');

    // 3. Validate ticketData count matches requested amounts
    const requestedCounts = new Map<string, number>();
    for (const t of dto.tickets) requestedCounts.set(t.ticketTypeUuid, t.amount);
    const actualCounts = new Map<string, number>();
    for (const td of dto.ticketData) actualCounts.set(td.ticketTypeUuid, (actualCounts.get(td.ticketTypeUuid) ?? 0) + 1);
    for (const [uuid, amount] of requestedCounts) {
      if ((actualCounts.get(uuid) ?? 0) !== amount) {
        throw new BadRequestException('Ticket data count does not match requested amounts.');
      }
    }

    // 4. Capacity check
    if (showDate.capacity !== null) {
      const soldCount = await this.ticketsRepository
        .createQueryBuilder('ticket')
        .innerJoin('ticket.booking', 'booking')
        .where('booking.showDateId = :showDateId', { showDateId: showDate.id })
        .andWhere('booking.status = :status', { status: BookingStatus.CONFIRMED })
        .getCount();

      if (soldCount + dto.ticketData.length > showDate.capacity) {
        throw new BadRequestException('Not enough capacity available for this show date.');
      }
    }

    // 5. Calculate total
    const totalAmount = dto.ticketData.reduce(
      (sum, td) => sum + Number(ticketTypeMap.get(td.ticketTypeUuid)!.price),
      0,
    );

    // 6. Charge via Stripe
    let paymentIntent: Stripe.PaymentIntent;
    try {
      paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(totalAmount * 100),
        currency: 'usd',
        payment_method: dto.paymentMethodId,
        confirm: true,
        automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
        metadata: { showDateUuid: dto.showDateUuid, customerEmail: dto.email },
      });
    } catch (err) {
      throw new BadRequestException(`Payment failed: ${err.message}`);
    }

    if (paymentIntent.status !== 'succeeded') {
      throw new BadRequestException(`Payment not completed. Status: ${paymentIntent.status}`);
    }

    const pm = await this.stripe.paymentMethods.retrieve(dto.paymentMethodId);
    const card = pm.card;

    // 7. Persist booking
    const booking = await this.bookingsRepository.save(
      this.bookingsRepository.create({
        showDateId: showDate.id,
        customerName: dto.cardName,
        customerEmail: dto.email,
        totalAmount,
        status: BookingStatus.CONFIRMED,
      }),
    );

    const ticketInputs = dto.ticketData.map((td) => ({
      ticketTypeUuid: td.ticketTypeUuid,
      entity: this.ticketsRepository.create({
        bookingId: booking.id,
        ticketTypeId: ticketTypeMap.get(td.ticketTypeUuid)!.id,
        holderName: td.name,
        unitPrice: ticketTypeMap.get(td.ticketTypeUuid)!.price,
      }),
    }));
    const savedTickets = await this.ticketsRepository.save(ticketInputs.map((t) => t.entity));

    const payment = await this.paymentsRepository.save(
      this.paymentsRepository.create({
        bookingId: booking.id,
        amount: totalAmount,
        gateway: PaymentGateway.STRIPE,
        status: PaymentStatus.SUCCEEDED,
      }),
    );

    await this.stripeTransactionsRepository.save(
      this.stripeTransactionsRepository.create({
        paymentId: payment.id,
        paymentIntentId: paymentIntent.id,
        status: paymentIntent.status,
        cardLast4: card?.last4 ?? null,
        cardBrand: card?.brand ?? null,
        cardholderName: dto.cardName,
      }),
    );

    // 8. Generate ticket HTML for each ticket
    const showDateStr = [showDate.date, showDate.time].filter(Boolean).join(' ');
    const purchaseDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    const [showImageBase64, ...qrDataUrls] = await Promise.all([
      dto.logoUrl ? fetchImageAsBase64(dto.logoUrl).catch(() => null) : Promise.resolve(null),
      ...savedTickets.map((t) => QRCode.toDataURL(t.uuid, { width: 120, margin: 1 })),
    ]);

    const ticketHtmls = savedTickets.map((ticket, i) => {
      const tt = ticketTypeMap.get(ticketInputs[i].ticketTypeUuid);
      return compiledTemplate({
        tickets: [{
          id: ticket.uuid,
          name: ticket.holderName,
          type: tt?.name ?? '',
          price: Number(ticket.unitPrice).toFixed(2),
          qrDataUrl: qrDataUrls[i],
        }],
        bookingRef: booking.uuid,
        logoUrl: showDate.show.logoUrl ?? null,
        showTitle: showDate.show.name,
        showDate: showDateStr,
        showImageUrl: showImageBase64 ?? null,
        customerName: dto.cardName,
        purchaseDate,
      });
    });

    // 9. Send confirmation email
    await this.mailService.sendBookingConfirmed(
      dto.email,
      dto.cardName,
      showDate.show.name,
      showDate.date,
      showDate.time,
    );

    return { bookingUuid: booking.uuid, tickets: ticketHtmls };
  }
}
