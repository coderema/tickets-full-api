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
import type { Ticket } from './ticket.entity';

@Entity('attendance')
export class Attendance {
  @PrimaryGeneratedColumn({ unsigned: true })
  id: number;

  @Column({ type: 'char', length: 36, unique: true })
  uuid: string;

  @Column({ name: 'ticket_id', unsigned: true })
  ticketId: number;

  @CreateDateColumn({ name: 'scanned_at' })
  scannedAt: Date;

  @Column({ name: 'scanned_by', type: 'varchar', length: 255, nullable: true })
  scannedBy: string | null;

  @OneToOne('Ticket', (t: Ticket) => t.attendance)
  @JoinColumn({ name: 'ticket_id' })
  ticket: Ticket;

  @BeforeInsert()
  generateUuid() {
    if (!this.uuid) this.uuid = uuidv4();
  }
}
