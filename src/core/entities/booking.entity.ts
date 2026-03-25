import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { BookingTicket } from './booking-ticket.entity';
import { TicketHolder } from './ticket-holder.entity';

@Entity('bookings')
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'show_date', type: 'varchar', length: 50 })
  showDate: string;

  @Column({ name: 'total_amount', type: 'decimal', precision: 10, scale: 2 })
  totalAmount: number;

  @Column({ name: 'stripe_pi_id', type: 'varchar', length: 100 })
  stripePiId: string;

  @Column({ name: 'pi_status', type: 'varchar', length: 50, default: 'created' })
  piStatus: string;

  @Column({ name: 'card_last4', type: 'char', length: 4, nullable: true })
  cardLast4: string | null;

  @Column({ name: 'card_name', type: 'varchar', length: 255, nullable: true })
  cardName: string | null;

  @Column({ name: 'customer_email', type: 'varchar', length: 255, nullable: true })
  customerEmail: string | null;

  @Column({ name: 'logo_url', type: 'text', nullable: true })
  logoUrl: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt: Date;

  @OneToMany(() => BookingTicket, (ticket) => ticket.booking)
  tickets: BookingTicket[];

  @OneToMany(() => TicketHolder, (holder) => holder.booking)
  holders: TicketHolder[];
}
