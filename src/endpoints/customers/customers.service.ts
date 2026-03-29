import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booking } from '../../core/entities/booking.entity';

export interface CustomerSummary {
  customerEmail: string;
  customerName: string;
  totalSpent: number;
  totalBookings: number;
  confirmed: number;
  pending: number;
  cancelled: number;
  lastBookingAt: Date | null;
}

export interface CustomerDetail extends CustomerSummary {
  bookings: {
    uuid: string;
    status: string;
    totalAmount: number;
    createdAt: Date;
    showName: string;
    showDate: string;
    showTime: string | null;
  }[];
}

export interface PagedCustomers {
  pageNumber: number;
  pageSize: number;
  total: number;
  totalPages: number;
  data: CustomerSummary[];
}

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Booking)
    private readonly bookingsRepository: Repository<Booking>,
  ) {}

  async findAll(page: number, pageSize: number, search?: string): Promise<PagedCustomers> {
    const qb = this.bookingsRepository
      .createQueryBuilder('booking')
      .select('booking.customerEmail', 'customerEmail')
      .addSelect('MAX(booking.customerName)', 'customerName')
      .addSelect('SUM(booking.totalAmount)', 'totalSpent')
      .addSelect('COUNT(booking.id)', 'totalBookings')
      .addSelect("SUM(CASE WHEN booking.status = 'confirmed' THEN 1 ELSE 0 END)", 'confirmed')
      .addSelect("SUM(CASE WHEN booking.status = 'pending' THEN 1 ELSE 0 END)", 'pending')
      .addSelect("SUM(CASE WHEN booking.status = 'cancelled' THEN 1 ELSE 0 END)", 'cancelled')
      .addSelect('MAX(booking.createdAt)', 'lastBookingAt')
      .groupBy('booking.customerEmail');

    if (search) {
      qb.andWhere(
        '(booking.customerName LIKE :search OR booking.customerEmail LIKE :search)',
        { search: `%${search}%` },
      );
    }

    // Count distinct emails for pagination
    const countQb = this.bookingsRepository
      .createQueryBuilder('booking')
      .select('COUNT(DISTINCT booking.customerEmail)', 'count');

    if (search) {
      countQb.andWhere(
        '(booking.customerName LIKE :search OR booking.customerEmail LIKE :search)',
        { search: `%${search}%` },
      );
    }

    const [countResult, rows] = await Promise.all([
      countQb.getRawOne<{ count: string }>(),
      qb
        .orderBy('booking.customerEmail', 'ASC')
        .limit(pageSize)
        .offset((page - 1) * pageSize)
        .getRawMany<{
          customerEmail: string;
          customerName: string;
          totalSpent: string;
          totalBookings: string;
          confirmed: string;
          pending: string;
          cancelled: string;
          lastBookingAt: Date | null;
        }>(),
    ]);

    const total = Number(countResult?.count ?? 0);

    return {
      pageNumber: page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
      data: rows.map((r) => ({
        customerEmail: r.customerEmail,
        customerName: r.customerName,
        totalSpent: Number(r.totalSpent),
        totalBookings: Number(r.totalBookings),
        confirmed: Number(r.confirmed),
        pending: Number(r.pending),
        cancelled: Number(r.cancelled),
        lastBookingAt: r.lastBookingAt ?? null,
      })),
    };
  }

  async findOne(email: string): Promise<CustomerDetail> {
    const [summaryRow, bookings] = await Promise.all([
      this.bookingsRepository
        .createQueryBuilder('booking')
        .select('booking.customerEmail', 'customerEmail')
        .addSelect('MAX(booking.customerName)', 'customerName')
        .addSelect('SUM(booking.totalAmount)', 'totalSpent')
        .addSelect('COUNT(booking.id)', 'totalBookings')
        .addSelect("SUM(CASE WHEN booking.status = 'confirmed' THEN 1 ELSE 0 END)", 'confirmed')
        .addSelect("SUM(CASE WHEN booking.status = 'pending' THEN 1 ELSE 0 END)", 'pending')
        .addSelect("SUM(CASE WHEN booking.status = 'cancelled' THEN 1 ELSE 0 END)", 'cancelled')
        .addSelect('MAX(booking.createdAt)', 'lastBookingAt')
        .where('booking.customerEmail = :email', { email })
        .groupBy('booking.customerEmail')
        .getRawOne<{
          customerEmail: string;
          customerName: string;
          totalSpent: string;
          totalBookings: string;
          confirmed: string;
          pending: string;
          cancelled: string;
          lastBookingAt: Date | null;
        }>(),

      this.bookingsRepository
        .createQueryBuilder('booking')
        .leftJoin('booking.showDate', 'showDate')
        .leftJoin('showDate.show', 'show')
        .select('booking.uuid', 'uuid')
        .addSelect('booking.status', 'status')
        .addSelect('booking.totalAmount', 'totalAmount')
        .addSelect('booking.createdAt', 'createdAt')
        .addSelect('show.name', 'showName')
        .addSelect('showDate.date', 'showDate')
        .addSelect('showDate.time', 'showTime')
        .where('booking.customerEmail = :email', { email })
        .orderBy('booking.createdAt', 'DESC')
        .getRawMany<{
          uuid: string;
          status: string;
          totalAmount: string;
          createdAt: Date;
          showName: string;
          showDate: string;
          showTime: string | null;
        }>(),
    ]);

    if (!summaryRow) throw new NotFoundException(`Customer ${email} not found`);

    return {
      customerEmail: summaryRow.customerEmail,
      customerName: summaryRow.customerName,
      totalSpent: Number(summaryRow.totalSpent),
      totalBookings: Number(summaryRow.totalBookings),
      confirmed: Number(summaryRow.confirmed),
      pending: Number(summaryRow.pending),
      cancelled: Number(summaryRow.cancelled),
      lastBookingAt: summaryRow.lastBookingAt ?? null,
      bookings: bookings.map((b) => ({
        uuid: b.uuid,
        status: b.status,
        totalAmount: Number(b.totalAmount),
        createdAt: b.createdAt,
        showName: b.showName,
        showDate: b.showDate,
        showTime: b.showTime,
      })),
    };
  }
}
