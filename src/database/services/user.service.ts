import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../entities';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async create(
    tenantId: string,
    email: string,
    password: string,
    role: UserRole = UserRole.VIEWER,
    firstName?: string,
    lastName?: string,
  ): Promise<User> {
    const passwordHash = await bcrypt.hash(password, 10);
    const user = this.userRepo.create({ tenantId, email, passwordHash, role, firstName, lastName });
    return this.userRepo.save(user);
  }

  async findAll(tenantId: string): Promise<User[]> {
    return this.userRepo.find({ where: { tenantId } });
  }

  async findById(id: string, tenantId: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { id, tenantId } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { email } });
  }

  async update(
    id: string,
    tenantId: string,
    data: Partial<{ firstName: string; lastName: string; role: UserRole; isActive: boolean }>,
  ): Promise<User | null> {
    await this.userRepo.update({ id, tenantId }, data);
    return this.findById(id, tenantId);
  }

  async remove(id: string, tenantId: string): Promise<boolean> {
    const result = await this.userRepo.delete({ id, tenantId });
    return (result.affected ?? 0) > 0;
  }

  async changePassword(id: string, tenantId: string, newPassword: string): Promise<boolean> {
    const passwordHash = await bcrypt.hash(newPassword, 10);
    const result = await this.userRepo.update({ id, tenantId }, { passwordHash });
    return (result.affected ?? 0) > 0;
  }

  async validatePassword(user: User, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.passwordHash);
  }
}
