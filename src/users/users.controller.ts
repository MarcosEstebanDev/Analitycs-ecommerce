import {
  Body, Controller, Delete, Get, NotFoundException, UnauthorizedException,
  Param, Post, Put, Patch, Req, ConflictException, UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserService } from '../database/services';
import { TenantService } from '../database/services';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private readonly userService: UserService,
    private readonly tenantService: TenantService,
  ) {}

  // ── /me routes ──────────────────────────────────────────────────────────────

  @Get('me')
  async getMe(@Req() req: Request) {
    const { userId, tenantId } = req.user!;
    const user = await this.userService.findById(userId, tenantId);
    if (!user) throw new NotFoundException('User not found');
    const { passwordHash: _, ...result } = user;
    return { success: true, data: result };
  }

  @Patch('me')
  async updateMe(@Req() req: Request, @Body() body: { firstName?: string; lastName?: string }) {
    const { userId, tenantId } = req.user!;
    const user = await this.userService.update(userId, tenantId, {
      firstName: body.firstName,
      lastName: body.lastName,
    });
    if (!user) throw new NotFoundException('User not found');
    const { passwordHash: _, ...result } = user;
    return { success: true, data: result };
  }

  @Patch('me/password')
  async changePassword(
    @Req() req: Request,
    @Body() body: { currentPassword: string; newPassword: string },
  ) {
    const { userId, tenantId } = req.user!;
    const user = await this.userService.findById(userId, tenantId);
    if (!user) throw new NotFoundException('User not found');

    const valid = await this.userService.validatePassword(user, body.currentPassword);
    if (!valid) throw new UnauthorizedException('Contraseña actual incorrecta');

    await this.userService.changePassword(userId, tenantId, body.newPassword);
    return { success: true, message: 'Contraseña actualizada' };
  }

  @Get('me/tenant-settings')
  async getTenantSettings(@Req() req: Request) {
    const tenant = await this.tenantService.findById(req.user!.tenantId);
    if (!tenant) throw new NotFoundException('Tenant not found');
    const settings = (tenant.metadata as any)?.settings ?? {};
    return { success: true, data: { settings, plan: tenant.plan, name: tenant.name } };
  }

  @Patch('me/tenant-settings')
  async updateTenantSettings(@Req() req: Request, @Body() body: Record<string, unknown>) {
    const tenant = await this.tenantService.findById(req.user!.tenantId);
    if (!tenant) throw new NotFoundException('Tenant not found');

    const metadata = { ...(tenant.metadata ?? {}), settings: { ...((tenant.metadata as any)?.settings ?? {}), ...body } };
    await this.tenantService.update(req.user!.tenantId, { metadata });
    return { success: true, data: { settings: metadata.settings } };
  }

  // ── Team CRUD ────────────────────────────────────────────────────────────────

  @Post()
  async create(@Body() body: CreateUserDto, @Req() req: Request) {
    const tenantId = req.user!.tenantId;
    const existing = await this.userService.findByEmail(body.email);
    if (existing) throw new ConflictException('Email already in use');

    const user = await this.userService.create(
      tenantId,
      body.email,
      body.password,
      body.role,
      body.firstName,
      body.lastName,
    );
    const { passwordHash: _, ...result } = user;
    return { success: true, data: result };
  }

  @Get()
  async findAll(@Req() req: Request) {
    const users = await this.userService.findAll(req.user!.tenantId);
    return {
      success: true,
      data: users.map(({ passwordHash: _, ...u }) => u),
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: Request) {
    const user = await this.userService.findById(id, req.user!.tenantId);
    if (!user) throw new NotFoundException('User not found');
    const { passwordHash: _, ...result } = user;
    return { success: true, data: result };
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: UpdateUserDto, @Req() req: Request) {
    const user = await this.userService.update(id, req.user!.tenantId, body);
    if (!user) throw new NotFoundException('User not found');
    const { passwordHash: _, ...result } = user;
    return { success: true, data: result };
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: Request) {
    const deleted = await this.userService.remove(id, req.user!.tenantId);
    if (!deleted) throw new NotFoundException('User not found');
    return { success: true, message: 'User deleted' };
  }
}
