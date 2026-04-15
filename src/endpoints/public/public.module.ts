import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PublicService } from './public.service';
import { PublicController } from './public.controller';
import { Show } from '../../core/entities/show.entity';
import { ShowDate } from '../../core/entities/show-date.entity';
import { TicketType } from '../../core/entities/ticket-type.entity';
import { Booking } from '../../core/entities/booking.entity';
import { Ticket } from '../../core/entities/ticket.entity';
import { Payment } from '../../core/entities/payment.entity';
import { StripeTransaction } from '../../core/entities/stripe-transaction.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Show, ShowDate, TicketType, Booking, Ticket, Payment, StripeTransaction])],
  controllers: [PublicController],
  providers: [PublicService],
})
export class PublicModule {}
