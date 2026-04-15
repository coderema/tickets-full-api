import { Controller, Post, Body, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ScanService } from './scan.service';
import { ScanTicketDto } from './dto/scan-ticket.dto';
import { Roles } from '../../core/decorators/roles.decorator';
import { UserRole } from '../../core/entities/enums';

@ApiTags('scan')
@ApiBearerAuth()
// @UseGuards(AuthGuard, RolesGuard)
@Controller('scan')
export class ScanController {
  constructor(private readonly scanService: ScanService) {}

  @Post('ticket')
  @Roles(UserRole.SCANNER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  scanTicket(@Body() dto: ScanTicketDto, @Req() req: Request) {
    return this.scanService.scanTicket(dto.code, req['user']?.username);
  }
}
