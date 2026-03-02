import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  async login(email: string, tenantId: string | null) {
    const payload = {
      sub: email,
      tenantId,
      scope: ['read:analytics', 'write:connectors']
    };

    return {
      accessToken: await this.jwtService.signAsync(payload, { expiresIn: '15m' }),
      refreshToken: await this.jwtService.signAsync(payload, { expiresIn: '7d' }),
      tokenType: 'Bearer'
    };
  }
}
