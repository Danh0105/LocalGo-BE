import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BusinessType, UserStatus } from '../../../../generated/prisma';

export interface BusinessProfileRecord {
  id: string;
  userId: string;
  businessType: BusinessType;
  businessName: string;
  businessCategory: string;
  templeName: string | null;
  openingHours: string | null;
  seatingCapacity: number | null;
  roomCount: number | null;
  gardenArea: string | null;
  mainProducts: string | null;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  address: string;
  googleMapsUrl: string | null;
  lat: { toString(): string } | null;
  lng: { toString(): string } | null;
  website: string | null;
  facebookUrl: string | null;
  zaloOaUrl: string | null;
  logoUrl: string | null;
  coverImageUrl: string | null;
  description: string | null;
  isPublic: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  user: {
    displayName: string;
    avatarUrl: string | null;
    status: UserStatus;
  };
}

export class BusinessProfileOwnerDto {
  @ApiProperty() id: string;
  @ApiProperty() displayName: string;
  @ApiPropertyOptional({ nullable: true }) avatarUrl: string | null;
  @ApiProperty({ enum: UserStatus }) status: UserStatus;
}

export class BusinessProfileResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() userId: string;
  @ApiProperty({ enum: BusinessType }) businessType: BusinessType;
  @ApiProperty() businessName: string;
  @ApiProperty() businessCategory: string;
  @ApiPropertyOptional({ nullable: true }) templeName: string | null;
  @ApiPropertyOptional({ nullable: true }) openingHours: string | null;
  @ApiPropertyOptional({ nullable: true }) seatingCapacity: number | null;
  @ApiPropertyOptional({ nullable: true }) roomCount: number | null;
  @ApiPropertyOptional({ nullable: true }) gardenArea: string | null;
  @ApiPropertyOptional({ nullable: true }) mainProducts: string | null;
  @ApiProperty() contactName: string;
  @ApiProperty() contactPhone: string;
  @ApiProperty() contactEmail: string;
  @ApiProperty() address: string;
  @ApiPropertyOptional({ nullable: true }) googleMapsUrl: string | null;
  @ApiPropertyOptional({ nullable: true }) lat: number | null;
  @ApiPropertyOptional({ nullable: true }) lng: number | null;
  @ApiPropertyOptional({ nullable: true }) website: string | null;
  @ApiPropertyOptional({ nullable: true }) facebookUrl: string | null;
  @ApiPropertyOptional({ nullable: true }) zaloOaUrl: string | null;
  @ApiPropertyOptional({ nullable: true }) logoUrl: string | null;
  @ApiPropertyOptional({ nullable: true }) coverImageUrl: string | null;
  @ApiPropertyOptional({ nullable: true }) description: string | null;
  @ApiProperty() isPublic: boolean;
  @ApiProperty() version: number;
  @ApiProperty({ type: BusinessProfileOwnerDto })
  owner: BusinessProfileOwnerDto;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
  @ApiPropertyOptional({ nullable: true }) deletedAt: Date | null;

  static fromRecord(record: BusinessProfileRecord): BusinessProfileResponseDto {
    return {
      id: record.id,
      userId: record.userId,
      businessType: record.businessType,
      businessName: record.businessName,
      businessCategory: record.businessCategory,
      templeName: record.templeName,
      openingHours: record.openingHours,
      seatingCapacity: record.seatingCapacity,
      roomCount: record.roomCount,
      gardenArea: record.gardenArea,
      mainProducts: record.mainProducts,
      contactName: record.contactName,
      contactPhone: record.contactPhone,
      contactEmail: record.contactEmail,
      address: record.address,
      googleMapsUrl: record.googleMapsUrl,
      lat: record.lat === null ? null : Number(record.lat.toString()),
      lng: record.lng === null ? null : Number(record.lng.toString()),
      website: record.website,
      facebookUrl: record.facebookUrl,
      zaloOaUrl: record.zaloOaUrl,
      logoUrl: record.logoUrl,
      coverImageUrl: record.coverImageUrl,
      description: record.description,
      isPublic: record.isPublic,
      version: record.version,
      owner: {
        id: record.userId,
        displayName: record.user.displayName,
        avatarUrl: record.user.avatarUrl,
        status: record.user.status,
      },
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      deletedAt: record.deletedAt,
    };
  }
}
