import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  OneToOne,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { ContentStatus } from './enums';
import type { ShowDate } from './show-date.entity';
import type { TicketType } from './ticket-type.entity';
import type { ShowImage } from './show-image.entity';

@Entity('shows')
export class Show {
  @PrimaryGeneratedColumn({ unsigned: true })
  id: number;

  @Column({ type: 'char', length: 36, unique: true })
  uuid: string;

  @Column({ length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'logo_url', type: 'text', nullable: true })
  logoUrl: string | null;

  @Column({ type: 'enum', enum: ContentStatus, default: ContentStatus.DRAFT })
  status: ContentStatus;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany('ShowDate', (sd: ShowDate) => sd.show)
  showDates: ShowDate[];

  @OneToMany('TicketType', (tt: TicketType) => tt.show)
  ticketTypes: TicketType[];

  @OneToOne('ShowImage', (img: ShowImage) => img.show)
  image: ShowImage;

  @BeforeInsert()
  generateUuid() {
    if (!this.uuid) this.uuid = uuidv4();
  }
}
