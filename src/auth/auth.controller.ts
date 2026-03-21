import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { SignupDto } from './dto/signup.dto';
import { RefreshDto } from './dto/refresh.dto';
import { AuthService } from './auth.service';

@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Throttle({ short: { ttl: 60000, limit: 5 } })
  @Post('login')
  login(@Body() body: LoginDto) {
    return this.authService.login(body.email, body.password);
  }

  @Throttle({ short: { ttl: 60000, limit: 3 } })
  @Post('signup')
  signup(@Body() body: SignupDto) {
    return this.authService.signup(body.tenantName, body.email, body.password, body.firstName, body.lastName);
  }

  @Post('register')
  register(@Body() body: RegisterDto) {
    return this.authService.register(body.tenantId, body.email, body.password, body.firstName, body.lastName);
  }

  @Post('refresh')
  refresh(@Body() body: RefreshDto) {
    return this.authService.refresh(body.refreshToken);
  }
}
