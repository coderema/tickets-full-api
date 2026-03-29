import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../../../core/entities/enums';

export class UpdateUserDto {
  @ApiPropertyOptional()
  username?: string;

  @ApiPropertyOptional()
  name?: string;

  @ApiPropertyOptional()
  password?: string;

  @ApiPropertyOptional({ enum: UserRole })
  role?: UserRole;

  @ApiPropertyOptional()
  isActive?: boolean;
}
