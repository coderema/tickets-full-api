import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTicketTypeDto {
  @ApiProperty()
  name: string;

  @ApiProperty()
  price: number;

  @ApiPropertyOptional()
  description?: string;

  @ApiPropertyOptional({ default: true })
  isActive?: boolean;
}
