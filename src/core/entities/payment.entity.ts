import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { PaymentGateway, PaymentStatus } from './enums';
import type { Booking } from './booking.entity';
import type { StripeTransaction } from './stripe-transaction.entity';
import type { CashPayment } from './cash-payment.entity';

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn({ unsigned: true })
  id: number;

  @Column({ type: 'char', length: 36, unique: true })
  uuid: string;

  @Column({ name: 'booking_id', unsigned: true })
  bookingId: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'enum', enum: PaymentGateway })
  gateway: PaymentGateway;

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.PENDING })
  status: PaymentStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToOne('Booking', (b: Booking) => b.payment)
  @JoinColumn({ name: 'booking_id' })
  booking: Booking;

  @OneToOne('StripeTransaction', (s: StripeTransaction) => s.payment, { cascade: true })
  stripeTransaction: StripeTransaction;

  @OneToOne('CashPayment', (c: CashPayment) => c.payment, { cascade: true })
  cashPayment: CashPayment;

  @BeforeInsert()
  generateUuid() {
    if (!this.uuid) this.uuid = uuidv4();
  }
}
