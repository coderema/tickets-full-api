import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '../../core/guards/auth.guard';
import { HomeService } from './home.service';

@ApiTags('home')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('home')
export class HomeController {
  constructor(private readonly homeService: HomeService) {}

  @Get('stats')
  getStats() {
    return this.homeService.getStats();
  }
}
