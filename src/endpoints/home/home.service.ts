import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Show } from '../../core/entities/show.entity';
import { ShowDate } from '../../core/entities/show-date.entity';
import { Booking } from '../../core/entities/booking.entity';
import { Ticket } from '../../core/entities/ticket.entity';
import { ContentStatus } from '../../core/entities/enums';

@Injectable()
export class HomeService {
  constructor(
    @InjectRepository(Show)
    private readonly showsRepository: Repository<Show>,
    @InjectRepository(ShowDate)
    private readonly showDatesRepository: Repository<ShowDate>,
    @InjectRepository(Booking)
    private readonly bookingsRepository: Repository<Booking>,
    @InjectRepository(Ticket)
    private readonly ticketsRepository: Repository<Ticket>,
  ) {}

  async getStats() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const today = now.toISOString().split('T')[0];

    const [revenueStats, bookingStats, ticketStats, activeShows, upcomingDates, recentBookings] =
      await Promise.all([
        this.bookingsRepository
          .createQueryBuilder('b')
          .select('COALESCE(SUM(b.totalAmount), 0)', 'total')
          .addSelect('COALESCE(SUM(CASE WHEN b.createdAt >= :startOfMonth THEN b.totalAmount ELSE 0 END), 0)', 'thisMonth')
          .setParameter('startOfMonth', startOfMonth)
          .getRawOne<{ total: string; thisMonth: string }>(),

        this.bookingsRepository
          .createQueryBuilder('b')
          .select('COUNT(b.id)', 'total')
          .addSelect('SUM(CASE WHEN b.createdAt >= :startOfMonth THEN 1 ELSE 0 END)', 'thisMonth')
          .addSelect("SUM(CASE WHEN b.status = 'confirmed' THEN 1 ELSE 0 END)", 'confirmed')
          .addSelect("SUM(CASE WHEN b.status = 'pending' THEN 1 ELSE 0 END)", 'pending')
          .addSelect("SUM(CASE WHEN b.status = 'cancelled' THEN 1 ELSE 0 END)", 'cancelled')
          .setParameter('startOfMonth', startOfMonth)
          .getRawOne<{ total: string; thisMonth: string; confirmed: string; pending: string; cancelled: string }>(),

        this.ticketsRepository
          .createQueryBuilder('t')
          .select('COUNT(t.id)', 'total')
          .addSelect('SUM(CASE WHEN t.createdAt >= :startOfMonth THEN 1 ELSE 0 END)', 'thisMonth')
          .setParameter('startOfMonth', startOfMonth)
          .getRawOne<{ total: string; thisMonth: string }>(),

        this.showsRepository
          .createQueryBuilder('s')
          .where('s.status = :status', { status: ContentStatus.PUBLISHED })
          .getCount(),

        this.showDatesRepository
          .createQueryBuilder('sd')
          .leftJoinAndSelect('sd.show', 'show')
          .loadRelationCountAndMap('sd.bookingCount', 'sd.bookings')
          .where('sd.date >= :today', { today })
          .andWhere('sd.status = :status', { status: ContentStatus.PUBLISHED })
          .orderBy('sd.date', 'ASC')
          .addOrderBy('sd.time', 'ASC')
          .take(5)
          .getMany(),

        this.bookingsRepository
          .createQueryBuilder('b')
          .leftJoinAndSelect('b.showDate', 'showDate')
          .leftJoinAndSelect('showDate.show', 'show')
          .select(['b.id', 'b.uuid', 'b.customerName', 'b.totalAmount', 'b.status', 'b.createdAt', 'showDate.date', 'showDate.time', 'show.name'])
          .orderBy('b.createdAt', 'DESC')
          .take(8)
          .getMany(),
      ]);

    if (upcomingDates.length) {
      const ids = upcomingDates.map((sd) => sd.id);
      const ticketCounts = await this.showDatesRepository
        .createQueryBuilder('sd')
        .select('sd.id', 'id')
        .addSelect('COUNT(t.id)', 'ticketCount')
        .innerJoin('sd.bookings', 'b')
        .innerJoin('b.tickets', 't')
        .where('sd.id IN (:...ids)', { ids })
        .groupBy('sd.id')
        .getRawMany<{ id: number; ticketCount: string }>();

      const ticketCountMap = new Map(ticketCounts.map((r) => [+r.id, +r.ticketCount]));
      upcomingDates.forEach((sd) => {
        (sd as any).ticketCount = ticketCountMap.get(sd.id) ?? 0;
      });
    }

    return {
      revenue: {
        total: +(revenueStats?.total ?? 0),
        thisMonth: +(revenueStats?.thisMonth ?? 0),
      },
      bookings: {
        total: +(bookingStats?.total ?? 0),
        thisMonth: +(bookingStats?.thisMonth ?? 0),
        confirmed: +(bookingStats?.confirmed ?? 0),
        pending: +(bookingStats?.pending ?? 0),
        cancelled: +(bookingStats?.cancelled ?? 0),
      },
      tickets: {
        total: +(ticketStats?.total ?? 0),
        thisMonth: +(ticketStats?.thisMonth ?? 0),
      },
      activeShows,
      upcomingDates: upcomingDates.map((sd) => ({
        uuid: sd.uuid,
        date: sd.date,
        time: sd.time,
        capacity: sd.capacity,
        bookingCount: (sd as any).bookingCount,
        ticketCount: (sd as any).ticketCount,
        show: {
          uuid: sd.show.uuid,
          name: sd.show.name,
          logoUrl: sd.show.logoUrl,
        },
      })),
      recentBookings,
    };
  }
}
