import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { AuthGuard } from '../../core/guards/auth.guard';

@ApiTags('bookings')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  create(@Body() createBookingDto: CreateBookingDto, @Req() req: Request) {
    return this.bookingsService.create(createBookingDto, req['user'].username);
  }

  @Get()
  @ApiQuery({ name: 'pagination', required: false, type: Boolean })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiQuery({ name: 'cursor', required: false, type: Number })
  @ApiQuery({ name: 'orderBy', required: false, type: String })
  @ApiQuery({ name: 'orderDirection', required: false, enum: ['asc', 'desc'] })
  @ApiQuery({ name: 'fields', required: false, type: String, isArray: true })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'dateFrom', required: false, type: String })
  @ApiQuery({ name: 'dateTo', required: false, type: String })
  @ApiQuery({ name: 'showUuid', required: false, type: String })
  @ApiQuery({ name: 'showDateUuid', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: ['pending', 'confirmed', 'cancelled'] })
  findAll(
    @Query('pagination') pagination = 'true',
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 10,
    @Query('cursor') cursor?: number,
    @Query('orderBy') orderBy?: string,
    @Query('orderDirection') orderDirection?: 'asc' | 'desc',
    @Query('fields') fields?: string[],
    @Query('search') search?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('showUuid') showUuid?: string,
    @Query('showDateUuid') showDateUuid?: string,
    @Query('status') status?: string,
  ) {
    if (pagination === 'false') {
      return this.bookingsService.findAll({
        pagination: false,
        fields: fields as [string, ...string[]],
      });
    }

    return this.bookingsService.findAll(
      {
        pagination: true,
        page: { page: +page, pageSize: +pageSize, cursor: cursor ? +cursor : undefined, orderBy, orderDirection },
        fields,
      },
      { search, dateFrom, dateTo, showUuid, showDateUuid, status },
    );
  }

  @Get('count')
  count() {
    return this.bookingsService.count();
  }

  @Get(':id/:ticketId/ticket')
  ticket(@Param('id') id: string, @Param('ticketId') ticketId: string) {
    return this.bookingsService.generateTicketHtml(id, ticketId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.bookingsService.findOne(id);
  }

  @Patch(':id/confirm')
  confirmBooking(@Param('id') id: string) {
    return this.bookingsService.confirmBooking(id);
  }

  @Patch(':id/cancel')
  cancelBooking(@Param('id') id: string) {
    return this.bookingsService.cancelBooking(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateBookingDto: UpdateBookingDto) {
    return this.bookingsService.update(id, updateBookingDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.bookingsService.remove(id);
  }
}
