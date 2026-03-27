import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  BeforeInsert,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import type { Booking } from './booking.entity';
import type { TicketType } from './ticket-type.entity';
import type { Attendance } from './attendance.entity';

@Entity('tickets')
export class Ticket {
  @PrimaryGeneratedColumn({ unsigned: true })
  id: number;

  @Column({ type: 'char', length: 36, unique: true })
  uuid: string;

  @Column({ name: 'booking_id', unsigned: true })
  bookingId: number;

  @Column({ name: 'ticket_type_id', unsigned: true })
  ticketTypeId: number;

  @Column({ name: 'holder_name', length: 255 })
  holderName: string;

  @Column({ name: 'unit_price', type: 'decimal', precision: 8, scale: 2 })
  unitPrice: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne('Booking', (b: Booking) => b.tickets, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'booking_id' })
  booking: Booking;

  @ManyToOne('TicketType', (tt: TicketType) => tt.tickets)
  @JoinColumn({ name: 'ticket_type_id' })
  ticketType: TicketType;

  @OneToOne('Attendance', (a: Attendance) => a.ticket)
  attendance: Attendance;

  @BeforeInsert()
  generateUuid() {
    if (!this.uuid) this.uuid = uuidv4();
  }
}
