import {
  Body, Controller, Delete, Get, NotFoundException,
  Param, Post, Put, Req, ConflictException, UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserService } from '../database/services';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly userService: UserService) {}

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
