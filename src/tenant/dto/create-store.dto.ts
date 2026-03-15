import { IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { StoreProvider } from '../../database/entities/store.entity';

export class CreateStoreDto {
  @IsEnum(StoreProvider)
  provider!: StoreProvider;

  @IsString()
  @Length(2, 255)
  name!: string;

  @IsString()
  @Length(1, 500)
  externalId!: string;

  @IsString()
  @Length(1, 1024)
  accessToken!: string;

  @IsOptional()
  @IsString()
  @Length(1, 1024)
  refreshToken?: string;
}
