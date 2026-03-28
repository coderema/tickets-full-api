import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HomeService } from './home.service';
import { HomeController } from './home.controller';
import { Show } from '../../core/entities/show.entity';
import { ShowDate } from '../../core/entities/show-date.entity';
import { Booking } from '../../core/entities/booking.entity';
import { Ticket } from '../../core/entities/ticket.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Show, ShowDate, Booking, Ticket])],
  controllers: [HomeController],
  providers: [HomeService],
})
export class HomeModule {}
