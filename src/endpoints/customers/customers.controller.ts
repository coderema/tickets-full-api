import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { CustomersService } from './customers.service';
import { AuthGuard } from '../../core/guards/auth.guard';

@ApiTags('customers')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  findAll(
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 20,
    @Query('search') search?: string,
  ) {
    return this.customersService.findAll(+page, +pageSize, search);
  }

  @Get(':email')
  findOne(@Param('email') email: string) {
    return this.customersService.findOne(decodeURIComponent(email));
  }
}
