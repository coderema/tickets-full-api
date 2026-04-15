import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, UploadedFile, UseInterceptors, Res, NotFoundException, HttpCode } from '@nestjs/common';
import { ApiTags, ApiQuery, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { AuthGuard } from '../../core/guards/auth.guard';
import { ShowsService } from './shows.service';
import { CreateShowDto } from './dto/create-show.dto';
import { UpdateShowDto } from './dto/update-show.dto';
import { CreateShowDateDto } from './dto/create-show-date.dto';
import { UpdateShowDateDto } from './dto/update-show-date.dto';
import { CreateTicketTypeDto } from './dto/create-ticket-type.dto';
import { UpdateTicketTypeDto } from './dto/update-ticket-type.dto';

@Controller('shows/images')
export class ShowImagesController {
  @Get(':filename')
  serveImage(@Param('filename') filename: string, @Res() res: Response) {
    const filePath = path.join(process.env.HOME ?? '/home/kevin', 'assets', 'shows', 'images', filename);
    if (!fs.existsSync(filePath)) throw new NotFoundException('Image not found');
    res.sendFile(filePath);
  }
}

@ApiTags('shows')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('shows')
export class ShowsController {
  constructor(private readonly showsService: ShowsService) {}

  @Post()
  create(@Body() createShowDto: CreateShowDto) {
    return this.showsService.create(createShowDto);
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
      return this.showsService.findAll({
        pagination: false,
        fields: fields as [string, ...string[]],
      });
    }

    return this.showsService.findAll({
      pagination: true,
      page: { page: +page, pageSize: +pageSize, cursor: cursor ? +cursor : undefined, orderBy, orderDirection },
      fields,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.showsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateShowDto: UpdateShowDto) {
    return this.showsService.update(id, updateShowDto);
  }

  @Patch(':id/publish')
  publishShow(@Param('id') id: string) {
    return this.showsService.publishShow(id);
  }

  @Patch(':id/cancel')
  cancelShow(@Param('id') id: string) {
    return this.showsService.cancelShow(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.showsService.remove(id);
  }

  @Post(':id/logo')
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  uploadLogo(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.showsService.uploadLogo(id, file);
  }

  @Get(':id/dates/:dateId/attendance')
  getAttendance(@Param('id') id: string, @Param('dateId') dateId: string) {
    return this.showsService.getAttendance(id, dateId);
  }

  @Get(':id/dates/:dateId')
  findShowDate(@Param('id') id: string, @Param('dateId') dateId: string) {
    return this.showsService.findShowDate(id, dateId);
  }

  @Post(':id/duplicate')
  duplicate(@Param('id') id: string) {
    return this.showsService.duplicate(id);
  }

  @Post(':id/dates/bulk')
  createShowDatesBulk(
    @Param('id') id: string,
    @Body() body: { dates: Array<{ date: string; time?: string; capacity?: number; isActive: boolean }> },
  ) {
    return this.showsService.createShowDatesBulk(id, body.dates);
  }

  @Post(':id/dates')
  createShowDate(@Param('id') id: string, @Body() createShowDateDto: CreateShowDateDto) {
    return this.showsService.createShowDate(id, createShowDateDto);
  }

  @Patch(':id/dates/:dateId')
  updateShowDate(
    @Param('id') id: string,
    @Param('dateId') dateId: string,
    @Body() updateShowDateDto: UpdateShowDateDto,
  ) {
    return this.showsService.updateShowDate(id, dateId, updateShowDateDto);
  }

  @Patch(':id/dates/:dateId/publish')
  publishShowDate(@Param('id') id: string, @Param('dateId') dateId: string) {
    return this.showsService.publishShowDate(id, dateId);
  }

  @Patch(':id/dates/:dateId/cancel')
  cancelShowDate(@Param('id') id: string, @Param('dateId') dateId: string) {
    return this.showsService.cancelShowDate(id, dateId);
  }

  @Delete(':id/dates/:dateId')
  removeShowDate(@Param('id') id: string, @Param('dateId') dateId: string) {
    return this.showsService.removeShowDate(id, dateId);
  }

  @Get(':id/ticket-types')
  findTicketTypes(@Param('id') id: string) {
    return this.showsService.findTicketTypes(id);
  }

  @Post(':id/ticket-types')
  createTicketType(@Param('id') id: string, @Body() dto: CreateTicketTypeDto) {
    return this.showsService.createTicketType(id, dto);
  }

  @Patch(':id/ticket-types/:typeId')
  updateTicketType(@Param('id') id: string, @Param('typeId') typeId: string, @Body() dto: UpdateTicketTypeDto) {
    return this.showsService.updateTicketType(id, typeId, dto);
  }

  @Delete(':id/ticket-types/:typeId')
  removeTicketType(@Param('id') id: string, @Param('typeId') typeId: string) {
    return this.showsService.removeTicketType(id, typeId);
  }
}
