import { IsEnum, IsOptional, IsString, Length, Matches } from 'class-validator';
import { TenantPlan } from '../../database/entities/tenant.entity';

export class CreateTenantDto {
  @IsString()
  @Length(3, 255)
  name!: string;

  @IsString()
  @Length(3, 255)
  @Matches(/^[a-z0-9-]+$/)
  slug!: string;

  @IsOptional()
  @IsEnum(TenantPlan)
  plan?: TenantPlan;
}
