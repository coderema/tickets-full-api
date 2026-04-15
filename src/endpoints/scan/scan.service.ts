import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ticket, Attendance, BookingStatus } from '../../core/entities/schema.entity';

export interface ScanTicketResult {
  valid: boolean;
  message: string;
  ticket?: {
    uuid: string;
    attendeeName: string;
    ticketType: string;
    showName: string;
    showDate: string;
    showTime: string | null;
    alreadyScanned: boolean;
    scannedAt: Date | null;
  };
}

@Injectable()
export class ScanService {
  constructor(
    @InjectRepository(Ticket)
    private readonly ticketsRepository: Repository<Ticket>,
    @InjectRepository(Attendance)
    private readonly attendanceRepository: Repository<Attendance>,
  ) {}

  async scanTicket(code: string, scannedBy?: string): Promise<ScanTicketResult> {
    const ticket = await this.ticketsRepository.findOne({
      where: { uuid: code },
      relations: ['booking', 'booking.showDate', 'booking.showDate.show', 'ticketType', 'attendance'],
    });

    if (!ticket) {
      return { valid: false, message: 'Ticket not found' };
    }

    if (ticket.booking.status === BookingStatus.CANCELLED) {
      return { valid: false, message: 'Booking is cancelled' };
    }

    const alreadyScanned = ticket.attendance !== null;

    const ticketInfo = {
      uuid: ticket.uuid,
      attendeeName: ticket.holderName,
      ticketType: ticket.ticketType.name,
      showName: ticket.booking.showDate.show.name,
      showDate: ticket.booking.showDate.date,
      showTime: ticket.booking.showDate.time,
      alreadyScanned,
      scannedAt: alreadyScanned ? ticket.attendance.scannedAt : null,
    };

    if (alreadyScanned) {
      return { valid: true, message: 'Already scanned', ticket: ticketInfo };
    }

    const attendance = this.attendanceRepository.create({
      ticketId: ticket.id,
      scannedBy: scannedBy ?? null,
    });
    await this.attendanceRepository.save(attendance);

    return { valid: true, message: 'Check-in successful', ticket: ticketInfo };
  }
}
