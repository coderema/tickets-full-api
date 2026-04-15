import { Controller, Get, Post, Param, Body, Res } from '@nestjs/common';
import { Response } from 'express';
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

  @Get('tickets/:bookingUuid/:ticketUuid')
  async getTicket(
    @Param('bookingUuid') bookingUuid: string,
    @Param('ticketUuid') ticketUuid: string,
    @Res() res: Response,
  ) {
    const html = await this.publicService.getTicket(bookingUuid, ticketUuid);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }
}
