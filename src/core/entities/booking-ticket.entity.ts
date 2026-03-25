import {
  Column,
  Entity,
  ManyToOne,
  JoinColumn,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Booking } from './booking.entity';

export type TicketType = 'adult' | 'senior' | 'children';

@Entity('booking_tickets')
export class BookingTicket {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'booking_id', type: 'char', length: 36 })
  bookingId: string;

  @Column({ type: 'enum', enum: ['adult', 'senior', 'children'] })
  type: TicketType;

  @Column({ type: 'smallint', unsigned: true })
  amount: number;

  @Column({ name: 'unit_price', type: 'decimal', precision: 6, scale: 2 })
  unitPrice: number;

  @ManyToOne(() => Booking, (booking) => booking.tickets, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'booking_id' })
  booking: Booking;
}
