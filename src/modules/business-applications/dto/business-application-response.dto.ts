import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  BusinessDocumentType,
  BusinessType,
  type BusinessApplicantType,
  type BusinessApplicationStatus,
} from '../../../../generated/prisma';
import type {
  BusinessApplicationEntity,
  BusinessApplicationDocumentView,
} from '../entities/business-application.entity';

export class BusinessApplicationDocumentResponseDto implements BusinessApplicationDocumentView {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty({ enum: BusinessDocumentType })
  type: BusinessDocumentType;
  @ApiProperty() url: string;
  @ApiProperty() mimeType: string;
}

export class BusinessApplicationResponseDto {
  @ApiProperty() id: string;
  @ApiProperty({ enum: ['INDIVIDUAL', 'ORGANIZATION'] })
  applicantType: BusinessApplicantType;
  @ApiProperty({ enum: BusinessType })
  businessType: BusinessType;
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
  @ApiPropertyOptional({ nullable: true }) identityNumber: string | null;
  @ApiPropertyOptional({ nullable: true }) identityIssuedAt: Date | null;
  @ApiPropertyOptional({ nullable: true }) identityIssuedPlace: string | null;
  @ApiPropertyOptional({ nullable: true }) legalName: string | null;
  @ApiPropertyOptional({ nullable: true }) taxCode: string | null;
  @ApiPropertyOptional({ nullable: true }) representativeName: string | null;
  @ApiPropertyOptional({ nullable: true }) representativeTitle: string | null;
  @ApiPropertyOptional({ nullable: true }) website: string | null;
  @ApiPropertyOptional({ nullable: true }) description: string | null;
  @ApiPropertyOptional({ nullable: true }) zaloId: string | null;
  @ApiPropertyOptional({ nullable: true }) zaloDisplayName: string | null;
  @ApiPropertyOptional({ nullable: true }) zaloAvatarUrl: string | null;
  @ApiProperty({ type: [BusinessApplicationDocumentResponseDto] })
  documents: BusinessApplicationDocumentResponseDto[];
  @ApiProperty({ enum: ['PENDING', 'APPROVED', 'REJECTED'] })
  status: BusinessApplicationStatus;
  @ApiPropertyOptional({ nullable: true }) rejectionReason: string | null;
  @ApiPropertyOptional({ nullable: true }) reviewedByName: string | null;
  @ApiPropertyOptional({ nullable: true }) reviewedAt: Date | null;
  @ApiPropertyOptional({ nullable: true }) createdUserId: string | null;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;

  static fromEntity(
    entity: BusinessApplicationEntity,
  ): BusinessApplicationResponseDto {
    return Object.assign(new BusinessApplicationResponseDto(), entity);
  }
}

export class ApproveBusinessApplicationResponseDto extends BusinessApplicationResponseDto {
  @ApiPropertyOptional({
    nullable: true,
    description:
      'Mật khẩu do hệ thống sinh, chỉ trả một lần khi tài khoản chưa có mật khẩu. Null nếu tài khoản đã có mật khẩu.',
  })
  initialPassword: string | null;

  static fromApproval(
    entity: BusinessApplicationEntity,
    initialPassword: string | null,
  ): ApproveBusinessApplicationResponseDto {
    return Object.assign(
      new ApproveBusinessApplicationResponseDto(),
      BusinessApplicationResponseDto.fromEntity(entity),
      { initialPassword },
    );
  }
}
