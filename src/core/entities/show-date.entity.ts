import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  BeforeInsert,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import type { Show } from './show.entity';
import type { Booking } from './booking.entity';

@Entity('show_dates')
export class ShowDate {
  @PrimaryGeneratedColumn({ unsigned: true })
  id: number;

  @Column({ type: 'char', length: 36, unique: true })
  uuid: string;

  @Column({ name: 'show_id', unsigned: true })
  showId: number;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'time', nullable: true })
  time: string | null;

  @Column({ type: 'smallint', unsigned: true, nullable: true })
  capacity: number | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne('Show', (show: Show) => show.showDates, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'show_id' })
  show: Show;

  @OneToMany('Booking', (b: Booking) => b.showDate)
  bookings: Booking[];

  @BeforeInsert()
  generateUuid() {
    if (!this.uuid) this.uuid = uuidv4();
  }
}
