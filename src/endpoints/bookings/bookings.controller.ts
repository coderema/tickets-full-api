import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
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
  create(@Body() createBookingDto: CreateBookingDto) {
    return this.bookingsService.create(createBookingDto);
  }

  @Get()
  @ApiQuery({ name: 'pagination', required: false, type: Boolean })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiQuery({ name: 'cursor', required: false, type: Number })
  @ApiQuery({ name: 'orderBy', required: false, type: String })
  @ApiQuery({ name: 'orderDirection', required: false, enum: ['asc', 'desc'] })
  @ApiQuery({ name: 'fields', required: false, type: String, isArray: true })
  findAll(
    @Query('pagination') pagination = 'true',
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 10,
    @Query('cursor') cursor?: number,
    @Query('orderBy') orderBy?: string,
    @Query('orderDirection') orderDirection?: 'asc' | 'desc',
    @Query('fields') fields?: string[],
  ) {
    if (pagination === 'false') {
      return this.bookingsService.findAll({
        pagination: false,
        fields: fields as [string, ...string[]],
      });
    }

    return this.bookingsService.findAll({
      pagination: true,
      page: { page: +page, pageSize: +pageSize, cursor: cursor ? +cursor : undefined, orderBy, orderDirection },
      fields,
    });
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

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateBookingDto: UpdateBookingDto) {
    return this.bookingsService.update(id, updateBookingDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.bookingsService.remove(id);
  }
}
