import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShowsService } from './shows.service';
import { ShowsController, ShowImagesController } from './shows.controller';
import { Show } from '../../core/entities/show.entity';
import { ShowDate } from '../../core/entities/show-date.entity';
import { ShowImage } from '../../core/entities/show-image.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Show, ShowDate, ShowImage])],
  controllers: [ShowImagesController, ShowsController],
  providers: [ShowsService],
})
export class ShowsModule {}
