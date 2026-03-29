import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { AuthGuard } from '../../core/guards/auth.guard';

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('revenue-by-show')
  revenueByShow() {
    return this.reportsService.revenueByShow();
  }

  @Get('sales-over-time')
  @ApiQuery({ name: 'period', required: false, enum: ['day', 'week', 'month'] })
  @ApiQuery({ name: 'from', required: false, type: String })
  @ApiQuery({ name: 'to', required: false, type: String })
  salesOverTime(
    @Query('period') period: 'day' | 'week' | 'month' = 'day',
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reportsService.salesOverTime(period, from, to);
  }

  @Get('capacity')
  capacity() {
    return this.reportsService.capacity();
  }
}
