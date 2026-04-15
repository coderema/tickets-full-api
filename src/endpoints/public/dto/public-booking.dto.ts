import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsString, IsEmail, IsArray, ValidateNested, ArrayMinSize, IsInt, IsPositive, Matches } from 'class-validator';

export class BookingTicketSummaryDto {
  @ApiProperty()
  @Matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  ticketTypeUuid: string;

  @ApiProperty()
  @IsInt()
  @IsPositive()
  amount: number;
}

export class BookingTicketDataDto {
  @ApiProperty()
  @Matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  uuid: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @Matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  ticketTypeUuid: string;
}

export class PublicBookingDto {
  @ApiProperty()
  @Matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  showDateUuid: string;

  @ApiProperty({ type: [BookingTicketSummaryDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BookingTicketSummaryDto)
  tickets: BookingTicketSummaryDto[];

  @ApiProperty({ type: [BookingTicketDataDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BookingTicketDataDto)
  ticketData: BookingTicketDataDto[];

  @ApiProperty()
  @IsString()
  paymentMethodId: string;

  @ApiProperty()
  @IsString()
  cardName: string;

  @ApiProperty()
  @IsEmail()
  email: string;

}
