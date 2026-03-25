import { Controller, Post, Get, Body, Headers, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Get('refresh')
  @ApiBearerAuth()
  refresh(@Headers('authorization') authorization: string) {
    const token = authorization?.split(' ')[1];
    if (!token) throw new UnauthorizedException('Missing refresh token');
    return this.authService.refresh(token);
  }
}
