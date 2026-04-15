import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScanService } from './scan.service';
import { ScanController } from './scan.controller';
import { Ticket, Attendance } from '../../core/entities/schema.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Ticket, Attendance])],
  controllers: [ScanController],
  providers: [ScanService],
})
export class ScanModule {}
