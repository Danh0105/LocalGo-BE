import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { BusinessDocumentType } from '../../../../generated/prisma';

export class BusinessApplicationDocumentInputDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  mediaId: string;

  @ApiProperty({ enum: BusinessDocumentType })
  @IsEnum(BusinessDocumentType)
  type: BusinessDocumentType;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name: string;
}
