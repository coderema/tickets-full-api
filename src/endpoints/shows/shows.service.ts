import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Show } from '../../core/entities/show.entity';
import { CreateShowDto } from './dto/create-show.dto';
import { UpdateShowDto } from './dto/update-show.dto';

@Injectable()
export class ShowsService {
  constructor(
    @InjectRepository(Show)
    private readonly showsRepository: Repository<Show>,
  ) {}

  create(createShowDto: CreateShowDto): Promise<Show> {
    const show = this.showsRepository.create(createShowDto);
    return this.showsRepository.save(show);
  }

  findAll(): Promise<Show[]> {
    return this.showsRepository.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(uuid: string): Promise<Show> {
    const show = await this.showsRepository.findOne({
      where: { uuid },
      relations: ['showDates'],
      order: { showDates: { date: 'ASC' } },
    });
    if (!show) throw new NotFoundException(`Show #${uuid} not found`);
    return show;
  }

  async update(uuid: string, updateShowDto: UpdateShowDto): Promise<Show> {
    const show = await this.findOne(uuid);
    Object.assign(show, updateShowDto);
    return this.showsRepository.save(show);
  }

  async remove(uuid: string): Promise<void> {
    const show = await this.findOne(uuid);
    await this.showsRepository.remove(show);
  }
}
