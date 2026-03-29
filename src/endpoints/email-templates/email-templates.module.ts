import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailTemplatesService } from './email-templates.service';
import { EmailTemplatesController } from './email-templates.controller';
import { EmailTemplate } from '../../core/entities/email-template.entity';

@Module({
  imports: [TypeOrmModule.forFeature([EmailTemplate])],
  controllers: [EmailTemplatesController],
  providers: [EmailTemplatesService],
})
export class EmailTemplatesModule {}
