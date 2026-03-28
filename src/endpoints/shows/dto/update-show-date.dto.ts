import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateShowDateDto {
  @ApiPropertyOptional()
  date?: string;

  @ApiPropertyOptional()
  time?: string;

  @ApiPropertyOptional()
  capacity?: number;

  @ApiPropertyOptional()
  isActive?: boolean;
}
