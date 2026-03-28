import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsString, IsEmail, IsNumber, IsPositive, IsArray, ValidateNested, ArrayMinSize, Matches } from 'class-validator';

export class CreateBookingTicketDto {
  @ApiProperty()
  @Matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  ticketTypeUuid: string;

  @ApiProperty()
  @IsString()
  holderName: string;

  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  unitPrice: number;
}

export class CreateBookingDto {
  @ApiProperty()
  @Matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  showDateUuid: string;

  @ApiProperty()
  @IsString()
  customerName: string;

  @ApiProperty()
  @IsEmail()
  customerEmail: string;

  @ApiProperty({ type: [CreateBookingTicketDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateBookingTicketDto)
  tickets: CreateBookingTicketDto[];
}
