import { Injectable, NotFoundException, BadRequestException, UnprocessableEntityException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Show } from '../../core/entities/show.entity';
import { ShowDate } from '../../core/entities/show-date.entity';
import { ShowImage } from '../../core/entities/show-image.entity';
import { TicketType } from '../../core/entities/ticket-type.entity';
import { Ticket } from '../../core/entities/ticket.entity';
import { Attendance } from '../../core/entities/attendance.entity';
import { ContentStatus } from '../../core/entities/enums';
import { BookingStatus } from '../../core/entities/enums';
import { MailService } from '../../core/mail/mail.service';
import { CreateShowDto } from './dto/create-show.dto';
import { UpdateShowDto } from './dto/update-show.dto';
import { CreateShowDateDto } from './dto/create-show-date.dto';
import { UpdateShowDateDto } from './dto/update-show-date.dto';
import { CreateTicketTypeDto } from './dto/create-ticket-type.dto';
import { UpdateTicketTypeDto } from './dto/update-ticket-type.dto';
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
    @InjectRepository(TicketType)
    private readonly ticketTypesRepository: Repository<TicketType>,
    @InjectRepository(Ticket)
    private readonly ticketsRepository: Repository<Ticket>,
    @InjectRepository(Attendance)
    private readonly attendanceRepository: Repository<Attendance>,
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
      .leftJoinAndSelect('show.ticketTypes', 'ticketType')
      .loadRelationCountAndMap('showDate.bookingCount', 'showDate.bookings')
      .where('show.uuid = :uuid', { uuid })
      .orderBy('showDate.date', 'ASC')
      .addOrderBy('ticketType.name', 'ASC')
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
    const show = await this.showsRepository.findOne({ where: { uuid } });
    if (!show) throw new NotFoundException(`Show #${uuid} not found`);
    if (show.status !== ContentStatus.DRAFT) {
      throw new BadRequestException(`Only draft shows can be deleted. Use the cancel endpoint instead.`);
    }

    const image = await this.showImagesRepository.findOne({ where: { showId: show.id } });
    if (image) {
      const filePath = path.join(process.env.HOME ?? '/home/kevin', 'assets', 'shows', 'images', image.filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      await this.showImagesRepository.remove(image);
    }

    await this.showsRepository.remove(show);
  }

  async publishShow(uuid: string): Promise<Show> {
    const show = await this.showsRepository.findOne({
      where: { uuid },
      relations: ['showDates', 'ticketTypes'],
    });
    if (!show) throw new NotFoundException(`Show #${uuid} not found`);
    if (show.status === ContentStatus.PUBLISHED) {
      throw new BadRequestException('Show is already published.');
    }
    if (show.status === ContentStatus.CANCELED) {
      throw new BadRequestException('Cancelled shows cannot be published.');
    }
    if (!show.showDates?.length) {
      throw new BadRequestException('Cannot publish a show with no dates.');
    }
    if (!show.ticketTypes?.length) {
      throw new BadRequestException('Cannot publish a show with no ticket types.');
    }
    show.status = ContentStatus.PUBLISHED;
    return this.showsRepository.save(show);
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

    const showDateIds = show.showDates.map((sd) => sd.id);
    if (showDateIds.length) {
      await this.showDatesRepository.update(
        { id: In(showDateIds) },
        { status: ContentStatus.CANCELED },
      );
    }

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

  private isPastDate(date: string): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(date) < today;
  }

  async createShowDate(showUuid: string, dto: CreateShowDateDto): Promise<ShowDate> {
    const show = await this.showsRepository.findOne({ where: { uuid: showUuid } });
    if (!show) throw new NotFoundException(`Show #${showUuid} not found`);
    if (show.status === ContentStatus.CANCELED) {
      throw new BadRequestException('Cannot add dates to a cancelled show.');
    }
    if (this.isPastDate(dto.date)) {
      throw new BadRequestException('Cannot create a show date in the past.');
    }
    const showDate = this.showDatesRepository.create({ ...dto, showId: show.id });
    return this.showDatesRepository.save(showDate);
  }

  async updateShowDate(showUuid: string, dateUuid: string, dto: UpdateShowDateDto): Promise<ShowDate> {
    const showDate = await this.showDatesRepository.findOne({
      where: { uuid: dateUuid, show: { uuid: showUuid } },
      relations: ['show', 'bookings'],
    });
    if (!showDate) throw new NotFoundException(`ShowDate #${dateUuid} not found`);
    if (showDate.show.status === ContentStatus.CANCELED) {
      throw new BadRequestException('Cannot update a show date of a cancelled show.');
    }
    if (this.isPastDate(showDate.date)) {
      throw new BadRequestException('Cannot update a show date that has already passed.');
    }
    if (dto.date !== undefined && this.isPastDate(dto.date)) {
      throw new BadRequestException('Cannot reschedule a show date to a date in the past.');
    }

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
      relations: ['show'],
    });
    if (!showDate) throw new NotFoundException(`ShowDate #${dateUuid} not found`);
    if (showDate.show.status === ContentStatus.CANCELED) {
      throw new BadRequestException('Cannot delete a show date of a cancelled show.');
    }
    if (this.isPastDate(showDate.date)) {
      throw new BadRequestException('Cannot delete a show date that has already passed.');
    }
    if (showDate.status !== ContentStatus.DRAFT) {
      throw new BadRequestException(`Only draft show dates can be deleted. Use the cancel endpoint instead.`);
    }
    await this.showDatesRepository.remove(showDate);
  }

  async publishShowDate(showUuid: string, dateUuid: string): Promise<ShowDate> {
    const showDate = await this.showDatesRepository.findOne({
      where: { uuid: dateUuid, show: { uuid: showUuid } },
      relations: ['show'],
    });
    if (!showDate) throw new NotFoundException(`ShowDate #${dateUuid} not found`);
    if (showDate.show.status === ContentStatus.CANCELED) {
      throw new BadRequestException('Cannot publish a show date of a cancelled show.');
    }
    if (showDate.status === ContentStatus.PUBLISHED) {
      throw new BadRequestException('Show date is already published.');
    }
    if (showDate.status === ContentStatus.CANCELED) {
      throw new BadRequestException('Cancelled show dates cannot be published.');
    }
    if (this.isPastDate(showDate.date)) {
      throw new BadRequestException('Cannot publish a show date that has already passed.');
    }
    showDate.status = ContentStatus.PUBLISHED;
    return this.showDatesRepository.save(showDate);
  }

  async findTicketTypes(showUuid: string): Promise<TicketType[]> {
    const show = await this.showsRepository.findOne({ where: { uuid: showUuid } });
    if (!show) throw new NotFoundException(`Show #${showUuid} not found`);
    return this.ticketTypesRepository.find({
      where: { showId: show.id },
      order: { name: 'ASC' },
    });
  }

  async createTicketType(showUuid: string, dto: CreateTicketTypeDto): Promise<TicketType> {
    const show = await this.showsRepository.findOne({ where: { uuid: showUuid } });
    if (!show) throw new NotFoundException(`Show #${showUuid} not found`);
    if (show.status === ContentStatus.CANCELED) {
      throw new BadRequestException(`Cannot add ticket types to a cancelled show.`);
    }
    const ticketType = this.ticketTypesRepository.create({ ...dto, showId: show.id });
    return this.ticketTypesRepository.save(ticketType);
  }

  async updateTicketType(showUuid: string, typeUuid: string, dto: UpdateTicketTypeDto): Promise<TicketType> {
    const ticketType = await this.ticketTypesRepository.findOne({
      where: { uuid: typeUuid, show: { uuid: showUuid } },
      relations: ['show'],
    });
    if (!ticketType) throw new NotFoundException(`TicketType #${typeUuid} not found`);
    if (ticketType.show.status === ContentStatus.CANCELED) {
      throw new BadRequestException(`Cannot update ticket types of a cancelled show.`);
    }
    if (ticketType.show.status === ContentStatus.PUBLISHED && dto.price !== undefined && +dto.price !== +ticketType.price) {
      throw new BadRequestException(`Cannot change the price of a ticket type once the show is published. Create a new ticket type instead.`);
    }
    Object.assign(ticketType, dto);
    return this.ticketTypesRepository.save(ticketType);
  }

  async removeTicketType(showUuid: string, typeUuid: string): Promise<void> {
    const ticketType = await this.ticketTypesRepository.findOne({
      where: { uuid: typeUuid, show: { uuid: showUuid } },
      relations: ['show', 'tickets'],
    });
    if (!ticketType) throw new NotFoundException(`TicketType #${typeUuid} not found`);
    if (ticketType.show.status === ContentStatus.CANCELED) {
      throw new BadRequestException(`Cannot delete ticket types from a cancelled show.`);
    }
    if (ticketType.tickets?.length > 0) {
      throw new BadRequestException(`Cannot delete a ticket type that has tickets issued against it.`);
    }
    await this.ticketTypesRepository.remove(ticketType);
  }

  async duplicate(uuid: string): Promise<Show> {
    const source = await this.showsRepository.findOne({
      where: { uuid },
      relations: ['ticketTypes'],
    });
    if (!source) throw new NotFoundException(`Show #${uuid} not found`);

    const newShow = await this.showsRepository.save(
      this.showsRepository.create({
        name: `${source.name} (Copy)`,
        description: source.description,
        status: ContentStatus.DRAFT,
      }),
    );

    if (source.ticketTypes?.length) {
      await this.ticketTypesRepository.save(
        source.ticketTypes.map((tt) =>
          this.ticketTypesRepository.create({
            showId: newShow.id,
            name: tt.name,
            price: tt.price,
            description: tt.description,
            isActive: tt.isActive,
          }),
        ),
      );
    }

    return this.findOne(newShow.uuid);
  }

  async createShowDatesBulk(
    showUuid: string,
    dates: Array<{ date: string; time?: string; capacity?: number; isActive: boolean }>,
  ): Promise<ShowDate[]> {
    const show = await this.showsRepository.findOne({ where: { uuid: showUuid } });
    if (!show) throw new NotFoundException(`Show #${showUuid} not found`);
    if (show.status === ContentStatus.CANCELED) {
      throw new BadRequestException('Cannot add dates to a cancelled show.');
    }

    const pastDate = dates.find((d) => this.isPastDate(d.date));
    if (pastDate) {
      throw new BadRequestException(`Cannot create a show date in the past: ${pastDate.date}.`);
    }

    const showDates = this.showDatesRepository.create(
      dates.map((d) => ({ ...d, showId: show.id })),
    );
    return this.showDatesRepository.save(showDates);
  }

  async getAttendance(showUuid: string, dateUuid: string): Promise<{
    ticketUuid: string;
    holderName: string;
    ticketType: string;
    checkedIn: boolean;
    scannedAt: Date | null;
    bookingUuid: string;
    customerName: string;
  }[]> {
    const showDate = await this.showDatesRepository.findOne({
      where: { uuid: dateUuid, show: { uuid: showUuid } },
    });
    if (!showDate) throw new NotFoundException(`ShowDate #${dateUuid} not found`);

    const rows = await this.ticketsRepository
      .createQueryBuilder('ticket')
      .innerJoin('ticket.booking', 'booking')
      .innerJoin('ticket.ticketType', 'ticketType')
      .leftJoin('ticket.attendance', 'attendance')
      .where('booking.showDateId = :showDateId', { showDateId: showDate.id })
      .andWhere('booking.status = :status', { status: BookingStatus.CONFIRMED })
      .select('ticket.uuid', 'ticketUuid')
      .addSelect('ticket.holderName', 'holderName')
      .addSelect('ticketType.name', 'ticketType')
      .addSelect('attendance.scannedAt', 'scannedAt')
      .addSelect('booking.uuid', 'bookingUuid')
      .addSelect('booking.customerName', 'customerName')
      .orderBy('booking.customerName', 'ASC')
      .addOrderBy('ticket.holderName', 'ASC')
      .getRawMany<{
        ticketUuid: string;
        holderName: string;
        ticketType: string;
        scannedAt: Date | null;
        bookingUuid: string;
        customerName: string;
      }>();

    return rows.map((r) => ({
      ticketUuid: r.ticketUuid,
      holderName: r.holderName,
      ticketType: r.ticketType,
      checkedIn: r.scannedAt !== null,
      scannedAt: r.scannedAt ?? null,
      bookingUuid: r.bookingUuid,
      customerName: r.customerName,
    }));
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
    if (this.isPastDate(showDate.date)) {
      throw new BadRequestException('Cannot cancel a show date that has already passed.');
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
