import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShowsService } from './shows.service';
import { ShowsController, ShowImagesController } from './shows.controller';
import { Show } from '../../core/entities/show.entity';
import { ShowDate } from '../../core/entities/show-date.entity';
import { ShowImage } from '../../core/entities/show-image.entity';
import { TicketType } from '../../core/entities/ticket-type.entity';
import { Ticket } from '../../core/entities/ticket.entity';
import { Attendance } from '../../core/entities/attendance.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Show, ShowDate, ShowImage, TicketType, Ticket, Attendance])],
  controllers: [ShowImagesController, ShowsController],
  providers: [ShowsService],
})
export class ShowsModule {}
