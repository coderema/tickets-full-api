import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import type { Show } from './show.entity';

@Entity('show_images')
export class ShowImage {
  @PrimaryGeneratedColumn({ unsigned: true })
  id: number;

  @Column({ type: 'char', length: 36, unique: true })
  uuid: string;

  @Column({ name: 'show_id', unsigned: true, unique: true })
  showId: number;

  @Column({ length: 255 })
  filename: string;

  @Column({ length: 512 })
  url: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToOne('Show', (show: Show) => show.image)
  @JoinColumn({ name: 'show_id' })
  show: Show;
}
