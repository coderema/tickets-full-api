import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('email_templates')
export class EmailTemplate {
  @PrimaryColumn({ type: 'varchar', length: 50 })
  key: string;

  @Column({ length: 100 })
  name: string;

  @Column({ length: 255 })
  subject: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'simple-array' })
  variables: string[];

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
