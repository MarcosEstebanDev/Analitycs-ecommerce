import { IsIn, IsString } from 'class-validator';

export class CreateCheckoutSessionDto {
  @IsString()
  @IsIn(['growth', 'scale'])
  planId!: string;
}
