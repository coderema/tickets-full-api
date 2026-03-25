import {
  Column,
  Entity,
  ManyToOne,
  JoinColumn,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Booking } from './booking.entity';
import { TicketType } from './booking-ticket.entity';

@Entity('ticket_holders')
export class TicketHolder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'booking_id', type: 'char', length: 36 })
  bookingId: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'enum', enum: ['adult', 'senior', 'children'] })
  type: TicketType;

  @ManyToOne(() => Booking, (booking) => booking.holders, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'booking_id' })
  booking: Booking;
}
