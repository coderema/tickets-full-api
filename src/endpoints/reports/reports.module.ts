import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { Booking } from '../../core/entities/booking.entity';
import { ShowDate } from '../../core/entities/show-date.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Booking, ShowDate])],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
