import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';
import { GetRequestParams, PageModel } from '../../core/models/page.model';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    console.log(createUserDto);
    const hash = await bcrypt.hash(createUserDto.password, 10);
    const user = this.usersRepository.create({ ...createUserDto, password: hash });
    return this.usersRepository.save(user);
  }

  async findAll(params: GetRequestParams): Promise<PageModel<User> | Partial<User>[]> {
    if (!params.pagination) {
      const query = this.usersRepository.createQueryBuilder('user');
      query.select(params.fields.map((f) => `user.${f}`));
      return query.getMany();
    }

    const { page, pageSize, cursor, orderBy, orderDirection, filter } = params.page;

    const query = this.usersRepository.createQueryBuilder('user');

    if (params.fields?.length) {
      query.select(params.fields.map((f) => `user.${f}`));
    }

    if (filter) {
      Object.entries(filter).forEach(([key, value]) => {
        query.andWhere(`user.${key} LIKE :${key}`, { [key]: `%${value}%` });
      });
    }

    if (orderBy) {
      query.orderBy(`user.${orderBy}`, orderDirection?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC');
    }

    if (cursor) {
      query.andWhere('user.id > :cursor', { cursor });
    }

    const total = await query.getCount();
    const data = await query
      .orderBy('user.id', 'ASC')
      .take(pageSize)
      .getMany();

    return {
      pageNumber: page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
      data,
    };
  }

  async findOne(id: number): Promise<User> {
    const user = await this.usersRepository.findOneBy({ id });
    if (!user) throw new NotFoundException(`User #${id} not found`);
    return user;
  }

  async update(id: number, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);
    if (updateUserDto.password) {
      updateUserDto.password = await bcrypt.hash(updateUserDto.password, 10);
    }
    Object.assign(user, updateUserDto);
    return this.usersRepository.save(user);
  }

  async remove(id: number): Promise<void> {
    const user = await this.findOne(id);
    await this.usersRepository.remove(user);
  }
}
