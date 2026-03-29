import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomersService } from './customers.service';
import { CustomersController } from './customers.controller';
import { Booking } from '../../core/entities/booking.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Booking])],
  controllers: [CustomersController],
  providers: [CustomersService],
})
export class CustomersModule {}
