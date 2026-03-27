import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import {
  Booking,
  Ticket,
  Payment,
  ShowDate,
} from '../../core/entities/schema.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Booking, Ticket, Payment, ShowDate])],
  controllers: [BookingsController],
  providers: [BookingsService],
})
export class BookingsModule {}
