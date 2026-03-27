import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShowsService } from './shows.service';
import { ShowsController } from './shows.controller';
import { Show } from '../../core/entities/show.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Show])],
  controllers: [ShowsController],
  providers: [ShowsService],
})
export class ShowsModule {}
