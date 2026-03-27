import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '../../core/guards/auth.guard';
import { ShowsService } from './shows.service';
import { CreateShowDto } from './dto/create-show.dto';
import { UpdateShowDto } from './dto/update-show.dto';

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
  findAll() {
    return this.showsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.showsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateShowDto: UpdateShowDto) {
    return this.showsService.update(id, updateShowDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.showsService.remove(id);
  }
}
