import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PublicService } from './public.service';
import { PublicBookingDto } from './dto/public-booking.dto';

@ApiTags('public')
@Controller('public')
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @Get('show/:id')
  getShow(@Param('id') id: string) {
    return this.publicService.getShow(id);
  }

  @Post('bookings')
  createBooking(@Body() dto: PublicBookingDto) {
    return this.publicService.createBooking(dto);
  }
}
