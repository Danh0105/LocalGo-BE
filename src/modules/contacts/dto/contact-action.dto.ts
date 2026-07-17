import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsString,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';

export class UpdateContactStatusDto {
  @ApiProperty()
  @IsBoolean()
  isActive: boolean;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  version: number;
}

export class ReorderContactItemDto {
  @ApiProperty()
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  id: string;

  @ApiProperty({ minimum: 0 })
  @IsInt()
  @Min(0)
  sortOrder: number;
}

export class ReorderContactsDto {
  @ApiProperty({ type: [ReorderContactItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ReorderContactItemDto)
  items: ReorderContactItemDto[];
}
