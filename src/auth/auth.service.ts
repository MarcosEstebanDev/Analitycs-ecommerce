import { Injectable, UnauthorizedException, ConflictException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../database/services';
import { TenantService } from '../database/services';
import { UserRole } from '../database/entities';
import { TenantPlan } from '../database/entities';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly userService: UserService,
    private readonly tenantService: TenantService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.userService.findByEmail(email);
    if (!user || !user.isActive) throw new UnauthorizedException('Credenciales inválidas');

    const valid = await this.userService.validatePassword(user, password);
    if (!valid) throw new UnauthorizedException('Credenciales inválidas');

    const payload = {
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId,
      role: user.role,
    };

    return {
      accessToken: await this.jwtService.signAsync(payload, { expiresIn: '15m' }),
      refreshToken: await this.jwtService.signAsync(payload, { expiresIn: '7d' }),
      tokenType: 'Bearer',
      tenantId: user.tenantId,
    };
  }

  async register(tenantId: string, email: string, password: string, firstName?: string, lastName?: string) {
    const tenant = await this.tenantService.findById(tenantId);
    if (!tenant) throw new NotFoundException('Tenant not found');

    const existing = await this.userService.findByEmail(email);
    if (existing) throw new ConflictException('Email already in use');

    const user = await this.userService.create(
      tenantId,
      email,
      password,
      UserRole.ADMIN,
      firstName,
      lastName,
    );

    const payload = {
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId,
      role: user.role,
    };

    return {
      accessToken: await this.jwtService.signAsync(payload, { expiresIn: '15m' }),
      refreshToken: await this.jwtService.signAsync(payload, { expiresIn: '7d' }),
      tokenType: 'Bearer',
      tenantId: user.tenantId,
    };
  }

  async signup(tenantName: string, email: string, password: string, firstName?: string, lastName?: string) {
    const slug = tenantName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const existingTenant = await this.tenantService.findBySlug(slug);
    if (existingTenant) throw new ConflictException('Ya existe una cuenta con ese nombre de empresa');

    const existingUser = await this.userService.findByEmail(email);
    if (existingUser) throw new ConflictException('Email ya registrado');

    const tenant = await this.tenantService.create(tenantName, slug, TenantPlan.FREE);
    const user = await this.userService.create(tenant.id, email, password, UserRole.ADMIN, firstName, lastName);

    const payload = { sub: user.id, email: user.email, tenantId: user.tenantId, role: user.role };
    return {
      accessToken: await this.jwtService.signAsync(payload, { expiresIn: '15m' }),
      refreshToken: await this.jwtService.signAsync(payload, { expiresIn: '7d' }),
      tokenType: 'Bearer',
      tenantId: user.tenantId,
    };
  }

  async refresh(token: string) {
    try {
      const payload = await this.jwtService.verifyAsync(token);
      const user = await this.userService.findByEmail(payload.email);
      if (!user || !user.isActive) throw new UnauthorizedException('Token inválido');

      const newPayload = { sub: user.id, email: user.email, tenantId: user.tenantId, role: user.role };
      return {
        accessToken: await this.jwtService.signAsync(newPayload, { expiresIn: '15m' }),
        tokenType: 'Bearer',
      };
    } catch {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }
  }
}

