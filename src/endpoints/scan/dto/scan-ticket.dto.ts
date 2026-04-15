import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class ScanTicketDto {
  @ApiProperty()
  @IsString()
  code: string;
}
