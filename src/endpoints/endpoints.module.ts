import { Module } from '@nestjs/common';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { BookingsModule } from './bookings/bookings.module';
import { ShowsModule } from './shows/shows.module';
import { HomeModule } from './home/home.module';
import { ReportsModule } from './reports/reports.module';
import { CustomersModule } from './customers/customers.module';
import { EmailTemplatesModule } from './email-templates/email-templates.module';
import { ScanModule } from './scan/scan.module';
import { PublicModule } from './public/public.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [UsersModule, AuthModule, BookingsModule, ShowsModule, HomeModule, ReportsModule, CustomersModule, EmailTemplatesModule, ScanModule, PublicModule, HealthModule]
})
export class EndpointsModule {}
