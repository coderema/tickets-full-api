import { Module } from '@nestjs/common';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { BookingsModule } from './bookings/bookings.module';
import { ShowsModule } from './shows/shows.module';

@Module({
  imports: [UsersModule, AuthModule, BookingsModule, ShowsModule]
})
export class EndpointsModule {}
