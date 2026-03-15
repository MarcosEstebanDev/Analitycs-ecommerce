import { IsEmail, IsOptional, IsString } from 'class-validator';

export class CreateBillingCustomerDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  name?: string;
}
