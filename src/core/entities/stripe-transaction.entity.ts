import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  BeforeInsert,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import type { Payment } from './payment.entity';

@Entity('stripe_transactions')
export class StripeTransaction {
  @PrimaryGeneratedColumn({ unsigned: true })
  id: number;

  @Column({ type: 'char', length: 36, unique: true })
  uuid: string;

  @Column({ name: 'payment_id', unsigned: true })
  paymentId: number;

  @Column({ name: 'payment_intent_id', length: 100, unique: true })
  paymentIntentId: string;

  @Column({ length: 50 })
  status: string;

  @Column({ name: 'card_last4', type: 'char', length: 4, nullable: true })
  cardLast4: string | null;

  @Column({ name: 'card_brand', type: 'varchar', length: 50, nullable: true })
  cardBrand: string | null;

  @Column({ name: 'cardholder_name', type: 'varchar', length: 255, nullable: true })
  cardholderName: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToOne('Payment', (p: Payment) => p.stripeTransaction, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'payment_id' })
  payment: Payment;

  @BeforeInsert()
  generateUuid() {
    if (!this.uuid) this.uuid = uuidv4();
  }
}
