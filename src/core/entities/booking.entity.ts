import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { BookingStatus } from './enums';
import type { ShowDate } from './show-date.entity';
import type { Ticket } from './ticket.entity';
import type { Payment } from './payment.entity';

@Entity('bookings')
export class Booking {
  @PrimaryGeneratedColumn({ unsigned: true })
  id: number;

  @Column({ type: 'char', length: 36, unique: true })
  uuid: string;

  @Column({ name: 'show_date_id', unsigned: true })
  showDateId: number;

  @Column({ name: 'customer_name', length: 255 })
  customerName: string;

  @Column({ name: 'customer_email', length: 255 })
  customerEmail: string;

  @Column({ name: 'total_amount', type: 'decimal', precision: 10, scale: 2 })
  totalAmount: number;

  @Column({ type: 'enum', enum: BookingStatus, default: BookingStatus.PENDING })
  status: BookingStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne('ShowDate', (sd: ShowDate) => sd.bookings)
  @JoinColumn({ name: 'show_date_id' })
  showDate: ShowDate;

  @OneToMany('Ticket', (t: Ticket) => t.booking, { cascade: true })
  tickets: Ticket[];

  @OneToOne('Payment', (p: Payment) => p.booking)
  payment: Payment;

  @BeforeInsert()
  generateUuid() {
    if (!this.uuid) this.uuid = uuidv4();
  }
}

export { BookingStatus };
