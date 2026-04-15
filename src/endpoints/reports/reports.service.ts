import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booking } from '../../core/entities/booking.entity';
import { ShowDate } from '../../core/entities/show-date.entity';
import { ContentStatus } from '../../core/entities/enums';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Booking)
    private readonly bookingsRepository: Repository<Booking>,
    @InjectRepository(ShowDate)
    private readonly showDatesRepository: Repository<ShowDate>,
  ) {}

  async revenueByShow(): Promise<
    { showName: string; totalRevenue: number; bookingCount: number; ticketCount: number }[]
  > {
    const rows = await this.bookingsRepository
      .createQueryBuilder('booking')
      .innerJoin('booking.showDate', 'showDate')
      .innerJoin('showDate.show', 'show')
      .leftJoin(
        (qb) =>
          qb
            .select('t.booking_id', 'bookingId')
            .addSelect('COUNT(t.id)', 'ticketCount')
            .from('tickets', 't')
            .groupBy('t.booking_id'),
        'tc',
        'tc.bookingId = booking.id',
      )
      .select('show.name', 'showName')
      .addSelect('SUM(booking.totalAmount)', 'totalRevenue')
      .addSelect('COUNT(booking.id)', 'bookingCount')
      .addSelect('SUM(COALESCE(tc.ticketCount, 0))', 'ticketCount')
      .groupBy('show.uuid')
      .addGroupBy('show.name')
      .orderBy('totalRevenue', 'DESC')
      .getRawMany<{
        showName: string;
        totalRevenue: string;
        bookingCount: string;
        ticketCount: string;
      }>();

    return rows.map((r) => ({
      showName: r.showName,
      totalRevenue: Number(r.totalRevenue),
      bookingCount: Number(r.bookingCount),
      ticketCount: Number(r.ticketCount),
    }));
  }

  async salesOverTime(
    period: 'day' | 'week' | 'month',
    from?: string,
    to?: string,
  ): Promise<{ label: string; bookingCount: number; revenue: number }[]> {
    const query = this.bookingsRepository
      .createQueryBuilder('booking')
      .innerJoin('booking.showDate', 'showDate');

    if (from) query.andWhere('showDate.date >= :from', { from });
    if (to) query.andWhere('showDate.date <= :to', { to });

    if (period === 'week') {
      query
        .select("DATE_FORMAT(MIN(showDate.date), '%Y-%m-%d')", 'label')
        .addSelect('SUM(booking.totalAmount)', 'revenue')
        .addSelect('COUNT(booking.id)', 'bookingCount')
        .groupBy('YEARWEEK(showDate.date, 1)')
        .orderBy('YEARWEEK(showDate.date, 1)', 'ASC');
    } else if (period === 'month') {
      query
        .select("DATE_FORMAT(showDate.date, '%Y-%m')", 'label')
        .addSelect('SUM(booking.totalAmount)', 'revenue')
        .addSelect('COUNT(booking.id)', 'bookingCount')
        .groupBy("DATE_FORMAT(showDate.date, '%Y-%m')")
        .orderBy("DATE_FORMAT(showDate.date, '%Y-%m')", 'ASC');
    } else {
      query
        .select('showDate.date', 'label')
        .addSelect('SUM(booking.totalAmount)', 'revenue')
        .addSelect('COUNT(booking.id)', 'bookingCount')
        .groupBy('showDate.date')
        .orderBy('showDate.date', 'ASC');
    }

    const rows = await query.getRawMany<{ label: string; revenue: string; bookingCount: string }>();

    return rows.map((r) => ({
      label: r.label,
      revenue: Number(r.revenue),
      bookingCount: Number(r.bookingCount),
    }));
  }

  async capacity(): Promise<
    { showName: string; dateLabel: string; totalCapacity: number | null; soldCount: number; fillPct: number | null; status: string }[]
  > {
    const rows = await this.showDatesRepository
      .createQueryBuilder('showDate')
      .innerJoin('showDate.show', 'show')
      .leftJoin('showDate.bookings', 'booking')
      .leftJoin('booking.tickets', 'ticket')
      .where('showDate.status != :canceled', { canceled: ContentStatus.CANCELED })
      .select('show.name', 'showName')
      .addSelect(
        "CONCAT(showDate.date, CASE WHEN showDate.time IS NOT NULL THEN CONCAT(' ', showDate.time) ELSE '' END)",
        'dateLabel',
      )
      .addSelect('showDate.capacity', 'totalCapacity')
      .addSelect('COUNT(DISTINCT ticket.id)', 'soldCount')
      .addSelect('showDate.status', 'status')
      .groupBy('showDate.uuid')
      .addGroupBy('show.name')
      .addGroupBy('showDate.date')
      .addGroupBy('showDate.time')
      .addGroupBy('showDate.capacity')
      .addGroupBy('showDate.status')
      .orderBy('showDate.date', 'ASC')
      .addOrderBy('showDate.time', 'ASC')
      .getRawMany<{
        showName: string;
        dateLabel: string;
        totalCapacity: string | null;
        soldCount: string;
        status: string;
      }>();

    return rows.map((r) => {
      const cap = r.totalCapacity !== null ? Number(r.totalCapacity) : null;
      const sold = Number(r.soldCount);
      return {
        showName: r.showName,
        dateLabel: r.dateLabel,
        totalCapacity: cap,
        soldCount: sold,
        fillPct: cap !== null && cap > 0 ? Math.round((sold / cap) * 100) : null,
        status: r.status,
      };
    });
  }
}
