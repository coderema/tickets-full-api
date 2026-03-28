import { Injectable, NotFoundException, BadRequestException, UnprocessableEntityException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Show } from '../../core/entities/show.entity';
import { ShowDate } from '../../core/entities/show-date.entity';
import { ShowImage } from '../../core/entities/show-image.entity';
import { ContentStatus } from '../../core/entities/enums';
import { BookingStatus } from '../../core/entities/enums';
import { MailService } from '../../core/mail/mail.service';
import { CreateShowDto } from './dto/create-show.dto';
import { UpdateShowDto } from './dto/update-show.dto';
import { CreateShowDateDto } from './dto/create-show-date.dto';
import { UpdateShowDateDto } from './dto/update-show-date.dto';
import { GetRequestParams, PageModel } from '../../core/models/page.model';

@Injectable()
export class ShowsService {
  constructor(
    @InjectRepository(Show)
    private readonly showsRepository: Repository<Show>,
    @InjectRepository(ShowDate)
    private readonly showDatesRepository: Repository<ShowDate>,
    @InjectRepository(ShowImage)
    private readonly showImagesRepository: Repository<ShowImage>,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
  ) {}

  create(createShowDto: CreateShowDto): Promise<Show> {
    const show = this.showsRepository.create(createShowDto);
    return this.showsRepository.save(show);
  }

  async findAll(params: GetRequestParams): Promise<PageModel<Show> | Partial<Show>[]> {
    if (!params.pagination) {
      const query = this.showsRepository.createQueryBuilder('show');
      query.select(params.fields.map((f) => `show.${f}`));
      return query.getMany();
    }

    const { page, pageSize, cursor, orderBy, orderDirection, filter } = params.page;

    const query = this.showsRepository.createQueryBuilder('show');

    if (params.fields?.length) {
      query.select(params.fields.map((f) => `show.${f}`));
    }

    if (filter) {
      Object.entries(filter).forEach(([key, value]) => {
        query.andWhere(`show.${key} LIKE :${key}`, { [key]: `%${value}%` });
      });
    }

    if (orderBy) {
      query.orderBy(`show.${orderBy}`, orderDirection?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC');
    }

    if (cursor) {
      query.andWhere('show.id > :cursor', { cursor });
    }

    const total = await query.getCount();
    const data = await query
      .orderBy('show.id', 'ASC')
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

  async findOne(uuid: string): Promise<Show> {
    const show = await this.showsRepository
      .createQueryBuilder('show')
      .leftJoinAndSelect('show.showDates', 'showDate')
      .loadRelationCountAndMap('showDate.bookingCount', 'showDate.bookings')
      .where('show.uuid = :uuid', { uuid })
      .orderBy('showDate.date', 'ASC')
      .getOne();

    if (!show) throw new NotFoundException(`Show #${uuid} not found`);

    if (show.showDates?.length) {
      const ids = show.showDates.map((sd) => sd.id);
      const rows = await this.showDatesRepository
        .createQueryBuilder('sd')
        .select('sd.id', 'id')
        .addSelect('COUNT(t.id)', 'ticketCount')
        .innerJoin('sd.bookings', 'b')
        .innerJoin('b.tickets', 't')
        .where('sd.id IN (:...ids)', { ids })
        .groupBy('sd.id')
        .getRawMany<{ id: number; ticketCount: string }>();

      const ticketCountMap = new Map(rows.map((r) => [+r.id, +r.ticketCount]));
      show.showDates.forEach((sd) => {
        (sd as any).ticketCount = ticketCountMap.get(sd.id) ?? 0;
      });
    }

    return show;
  }

  async update(uuid: string, updateShowDto: UpdateShowDto): Promise<Show> {
    const show = await this.findOne(uuid);
    Object.assign(show, updateShowDto);
    return this.showsRepository.save(show);
  }

  async uploadLogo(showUuid: string, file: Express.Multer.File): Promise<{ url: string }> {
    const show = await this.showsRepository.findOne({ where: { uuid: showUuid } });
    if (!show) throw new NotFoundException(`Show #${showUuid} not found`);

    const imageUuid = uuidv4();
    const ext = path.extname(file.originalname);
    const filename = `${imageUuid}${ext}`;
    const uploadDir = path.join(process.env.HOME ?? '/home/kevin', 'assets', 'shows', 'images');

    fs.mkdirSync(uploadDir, { recursive: true });
    fs.writeFileSync(path.join(uploadDir, filename), file.buffer);

    const baseUrl = this.configService.get<string>('APP_URL') ?? 'http://localhost:3000';
    const url = `${baseUrl}/shows/images/${filename}`;

    const existing = await this.showImagesRepository.findOne({ where: { showId: show.id } });
    if (existing) {
      const oldPath = path.join(uploadDir, existing.filename);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      existing.uuid = imageUuid;
      existing.filename = filename;
      existing.url = url;
      await this.showImagesRepository.save(existing);
    } else {
      const image = this.showImagesRepository.create({
        uuid: imageUuid,
        showId: show.id,
        filename,
        url,
      });
      await this.showImagesRepository.save(image);
    }

    await this.showsRepository.update(show.id, { logoUrl: url });

    return { url };
  }

  async remove(uuid: string): Promise<void> {
    const show = await this.findOne(uuid);
    if (show.status !== ContentStatus.DRAFT) {
      throw new BadRequestException(`Only draft shows can be deleted. Use the cancel endpoint instead.`);
    }
    await this.showsRepository.remove(show);
  }

  async cancelShow(uuid: string): Promise<Show> {
    const show = await this.showsRepository.findOne({
      where: { uuid },
      relations: ['showDates', 'showDates.bookings'],
    });
    if (!show) throw new NotFoundException(`Show #${uuid} not found`);
    if (show.status === ContentStatus.CANCELED) {
      throw new BadRequestException('Show is already cancelled.');
    }
    if (show.status === ContentStatus.DRAFT) {
      throw new BadRequestException('Draft shows cannot be cancelled. Delete it instead.');
    }

    show.status = ContentStatus.CANCELED;
    await this.showsRepository.save(show);

    const emailPromises: Promise<void>[] = [];
    for (const showDate of show.showDates) {
      for (const booking of showDate.bookings ?? []) {
        emailPromises.push(
          this.mailService.sendShowCancelled(booking.customerEmail, booking.customerName, show.name),
        );
      }
    }
    await Promise.all(emailPromises);

    return show;
  }

  async findShowDate(showUuid: string, dateUuid: string): Promise<ShowDate> {
    const showDate = await this.showDatesRepository.findOne({
      where: { uuid: dateUuid, show: { uuid: showUuid } },
      relations: ['show', 'bookings', 'bookings.tickets'],
    });
    if (!showDate) throw new NotFoundException(`ShowDate #${dateUuid} not found`);
    return showDate;
  }

  async createShowDate(showUuid: string, dto: CreateShowDateDto): Promise<ShowDate> {
    const show = await this.showsRepository.findOne({ where: { uuid: showUuid } });
    if (!show) throw new NotFoundException(`Show #${showUuid} not found`);
    const showDate = this.showDatesRepository.create({ ...dto, showId: show.id });
    return this.showDatesRepository.save(showDate);
  }

  async updateShowDate(showUuid: string, dateUuid: string, dto: UpdateShowDateDto): Promise<ShowDate> {
    const showDate = await this.showDatesRepository.findOne({
      where: { uuid: dateUuid, show: { uuid: showUuid } },
      relations: ['show', 'bookings'],
    });
    if (!showDate) throw new NotFoundException(`ShowDate #${dateUuid} not found`);

    if (dto.capacity !== undefined) {
      const confirmedCount = await this.showDatesRepository
        .createQueryBuilder('sd')
        .innerJoin('sd.bookings', 'b')
        .where('sd.id = :id', { id: showDate.id })
        .andWhere('b.status = :status', { status: BookingStatus.CONFIRMED })
        .getCount();

      if (dto.capacity < confirmedCount) {
        throw new UnprocessableEntityException(
          `Capacity cannot be set below the number of confirmed bookings (${confirmedCount}).`,
        );
      }
    }

    const isPublished = showDate.status === ContentStatus.PUBLISHED;
    const hasScheduleChange = (
      (dto.date !== undefined && dto.date !== showDate.date) ||
      (dto.time !== undefined && dto.time !== showDate.time) ||
      (dto.capacity !== undefined && dto.capacity !== showDate.capacity)
    );

    Object.assign(showDate, dto);
    const saved = await this.showDatesRepository.save(showDate);

    if (isPublished && hasScheduleChange) {
      const emailPromises = (showDate.bookings ?? []).map((booking) =>
        this.mailService.sendShowDateUpdated(
          booking.customerEmail,
          booking.customerName,
          showDate.show.name,
          saved.date,
          saved.time,
          saved.capacity,
        ),
      );
      await Promise.all(emailPromises);
    }

    return saved;
  }

  async removeShowDate(showUuid: string, dateUuid: string): Promise<void> {
    const showDate = await this.showDatesRepository.findOne({
      where: { uuid: dateUuid, show: { uuid: showUuid } },
    });
    if (!showDate) throw new NotFoundException(`ShowDate #${dateUuid} not found`);
    if (showDate.status !== ContentStatus.DRAFT) {
      throw new BadRequestException(`Only draft show dates can be deleted. Use the cancel endpoint instead.`);
    }
    await this.showDatesRepository.remove(showDate);
  }

  async cancelShowDate(showUuid: string, dateUuid: string): Promise<ShowDate> {
    const showDate = await this.showDatesRepository.findOne({
      where: { uuid: dateUuid, show: { uuid: showUuid } },
      relations: ['show', 'bookings'],
    });
    if (!showDate) throw new NotFoundException(`ShowDate #${dateUuid} not found`);
    if (showDate.status === ContentStatus.CANCELED) {
      throw new BadRequestException('Show date is already cancelled.');
    }
    if (showDate.status === ContentStatus.DRAFT) {
      throw new BadRequestException('Draft show dates cannot be cancelled. Delete it instead.');
    }

    showDate.status = ContentStatus.CANCELED;
    await this.showDatesRepository.save(showDate);

    const emailPromises = (showDate.bookings ?? []).map((booking) =>
      this.mailService.sendShowDateCancelled(
        booking.customerEmail,
        booking.customerName,
        showDate.show.name,
        showDate.date,
        showDate.time,
      ),
    );
    await Promise.all(emailPromises);

    return showDate;
  }
}
