import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateShowDto {
  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiPropertyOptional()
  logoUrl?: string;

  @ApiPropertyOptional({ default: true })
  isActive?: boolean;
}
