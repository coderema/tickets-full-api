import { Controller, Get, Patch, Post, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { EmailTemplatesService } from './email-templates.service';
import { AuthGuard } from '../../core/guards/auth.guard';

@ApiTags('email-templates')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('email-templates')
export class EmailTemplatesController {
  constructor(private readonly emailTemplatesService: EmailTemplatesService) {}

  @Get()
  findAll() {
    return this.emailTemplatesService.findAll();
  }

  @Get(':key')
  findOne(@Param('key') key: string) {
    return this.emailTemplatesService.findOne(key);
  }

  @Patch(':key')
  update(@Param('key') key: string, @Body() dto: { subject?: string; body?: string }) {
    return this.emailTemplatesService.update(key, dto);
  }

  @Post(':key/preview')
  preview(@Param('key') key: string, @Body() dto: { subject: string; body: string }) {
    return this.emailTemplatesService.preview(key, dto);
  }
}
