import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../../../core/entities/enums';

export class CreateUserDto {
  @ApiProperty()
  username: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  password: string;

  @ApiPropertyOptional({ enum: UserRole, default: UserRole.ADMIN })
  role?: UserRole;
}
