import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateShowDateDto {
  @ApiProperty()
  date: string;

  @ApiPropertyOptional()
  time?: string;

  @ApiPropertyOptional()
  capacity?: number;

  @ApiPropertyOptional()
  isActive?: boolean;
}
