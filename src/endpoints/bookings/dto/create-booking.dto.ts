import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BookingStatus } from '../../../core/entities/schema.entity';

export class CreateBookingDto {
  @ApiProperty()
  showDateId: number;

  @ApiProperty()
  customerName: string;

  @ApiProperty()
  customerEmail: string;

  @ApiProperty()
  totalAmount: number;

  @ApiPropertyOptional({ enum: BookingStatus, default: BookingStatus.PENDING })
  status?: BookingStatus;
}
