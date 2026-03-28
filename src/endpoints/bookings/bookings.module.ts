import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import {
  Booking,
  Ticket,
  TicketType,
  Payment,
  ShowDate,
  CashPayment,
} from '../../core/entities/schema.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Booking, Ticket, TicketType, Payment, ShowDate, CashPayment])],
  controllers: [BookingsController],
  providers: [BookingsService],
})
export class BookingsModule {}
