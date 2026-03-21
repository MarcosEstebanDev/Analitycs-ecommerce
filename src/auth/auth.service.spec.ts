import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, ConflictException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { UserService } from '../database/services';
import { TenantService } from '../database/services';
import { UserRole, TenantPlan } from '../database/entities';

const mockUser = {
  id: 'user-uuid',
  email: 'test@example.com',
  tenantId: 'tenant-uuid',
  role: UserRole.ADMIN,
  isActive: true,
};

const mockTenant = {
  id: 'tenant-uuid',
  name: 'Test Corp',
  slug: 'test-corp',
  plan: TenantPlan.FREE,
};

describe('AuthService', () => {
  let service: AuthService;
  let userService: jest.Mocked<UserService>;
  let tenantService: jest.Mocked<TenantService>;
  let jwtService: jest.Mocked<JwtService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UserService,
          useValue: {
            findByEmail: jest.fn(),
            validatePassword: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: TenantService,
          useValue: {
            findById: jest.fn(),
            findBySlug: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn().mockResolvedValue('mocked-jwt-token'),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userService = module.get(UserService);
    tenantService = module.get(TenantService);
    jwtService = module.get(JwtService);
  });

  // ─── login ─────────────────────────────────────────────────────────────────

  describe('login', () => {
    it('should return tokens when credentials are valid', async () => {
      userService.findByEmail.mockResolvedValue(mockUser as any);
      userService.validatePassword.mockResolvedValue(true);

      const result = await service.login('test@example.com', 'password');

      expect(result.accessToken).toBe('mocked-jwt-token');
      expect(result.refreshToken).toBe('mocked-jwt-token');
      expect(result.tokenType).toBe('Bearer');
      expect(result.tenantId).toBe('tenant-uuid');
    });

    it('should throw UnauthorizedException when user not found', async () => {
      userService.findByEmail.mockResolvedValue(null);

      await expect(service.login('noone@example.com', 'pass')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when user is inactive', async () => {
      userService.findByEmail.mockResolvedValue({ ...mockUser, isActive: false } as any);

      await expect(service.login('test@example.com', 'pass')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when password is wrong', async () => {
      userService.findByEmail.mockResolvedValue(mockUser as any);
      userService.validatePassword.mockResolvedValue(false);

      await expect(service.login('test@example.com', 'wrongpassword')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // ─── register ──────────────────────────────────────────────────────────────

  describe('register', () => {
    it('should create a user and return tokens', async () => {
      tenantService.findById.mockResolvedValue(mockTenant as any);
      userService.findByEmail.mockResolvedValue(null);
      userService.create.mockResolvedValue(mockUser as any);

      const result = await service.register('tenant-uuid', 'new@example.com', 'password');

      expect(result.accessToken).toBe('mocked-jwt-token');
      expect(userService.create).toHaveBeenCalledWith(
        'tenant-uuid',
        'new@example.com',
        'password',
        UserRole.ADMIN,
        undefined,
        undefined,
      );
    });

    it('should throw NotFoundException when tenant not found', async () => {
      tenantService.findById.mockResolvedValue(null);

      await expect(service.register('bad-tenant', 'a@b.com', 'pass')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException when email is already in use', async () => {
      tenantService.findById.mockResolvedValue(mockTenant as any);
      userService.findByEmail.mockResolvedValue(mockUser as any);

      await expect(service.register('tenant-uuid', 'test@example.com', 'pass')).rejects.toThrow(
        ConflictException,
      );
    });
  });

  // ─── signup ────────────────────────────────────────────────────────────────

  describe('signup', () => {
    it('should create tenant and user, return tokens', async () => {
      tenantService.findBySlug.mockResolvedValue(null);
      userService.findByEmail.mockResolvedValue(null);
      tenantService.create.mockResolvedValue(mockTenant as any);
      userService.create.mockResolvedValue(mockUser as any);

      const result = await service.signup('Test Corp', 'new@example.com', 'password', 'Ana', 'López');

      expect(result.accessToken).toBe('mocked-jwt-token');
      expect(tenantService.create).toHaveBeenCalledWith('Test Corp', 'test-corp', TenantPlan.FREE);
    });

    it('should throw ConflictException if tenant slug already exists', async () => {
      tenantService.findBySlug.mockResolvedValue(mockTenant as any);

      await expect(service.signup('Test Corp', 'a@b.com', 'pass')).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw ConflictException if email already registered', async () => {
      tenantService.findBySlug.mockResolvedValue(null);
      userService.findByEmail.mockResolvedValue(mockUser as any);

      await expect(service.signup('New Corp', 'test@example.com', 'pass')).rejects.toThrow(
        ConflictException,
      );
    });
  });
});
