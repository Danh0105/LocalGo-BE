import { ApiProperty } from '@nestjs/swagger';
import {
  BusinessApplicantType,
  BusinessDocumentType,
  BusinessType,
  TradePostPurpose,
} from '../../../../generated/prisma';
import {
  BUSINESS_APPLICATION_FIELD_LABEL,
  BUSINESS_DOCUMENT_TYPE_LABEL,
  BUSINESS_TYPE_CONFIG,
  type BusinessApplicationField,
} from '../business-type.config';

export class BusinessFieldOptionDto {
  @ApiProperty({ example: 'identityNumber' }) field: BusinessApplicationField;
  @ApiProperty({ example: 'Số CCCD' }) label: string;
}

export class BusinessDocumentOptionDto {
  @ApiProperty({ enum: BusinessDocumentType }) type: BusinessDocumentType;
  @ApiProperty() label: string;
}

/** Exactly what the form must collect for one business type + applicant type. */
export class BusinessApplicantFormDto {
  @ApiProperty({ enum: BusinessApplicantType })
  applicantType: BusinessApplicantType;
  @ApiProperty({ type: [BusinessFieldOptionDto] })
  requiredFields: BusinessFieldOptionDto[];
  @ApiProperty({ type: [BusinessFieldOptionDto] })
  optionalFields: BusinessFieldOptionDto[];
  @ApiProperty({ type: [BusinessDocumentOptionDto] })
  requiredDocuments: BusinessDocumentOptionDto[];
  @ApiProperty({ type: [BusinessDocumentOptionDto] })
  optionalDocuments: BusinessDocumentOptionDto[];
}

export class BusinessTypeResponseDto {
  @ApiProperty({ enum: BusinessType }) type: BusinessType;
  @ApiProperty() label: string;
  @ApiProperty() description: string;
  @ApiProperty({
    enum: TradePostPurpose,
    isArray: true,
    description: 'Loại tin tài khoản thuộc loại hình này được đăng',
  })
  postPurposes: TradePostPurpose[];
  @ApiProperty({ type: [BusinessApplicantFormDto] })
  applicantTypes: BusinessApplicantFormDto[];

  static all(): BusinessTypeResponseDto[] {
    const field = (name: BusinessApplicationField): BusinessFieldOptionDto => ({
      field: name,
      label: BUSINESS_APPLICATION_FIELD_LABEL[name],
    });
    const document = (
      type: BusinessDocumentType,
    ): BusinessDocumentOptionDto => ({
      type,
      label: BUSINESS_DOCUMENT_TYPE_LABEL[type],
    });

    return Object.values(BUSINESS_TYPE_CONFIG).map((config) => ({
      type: config.type,
      label: config.label,
      description: config.description,
      postPurposes: config.postPurposes,
      applicantTypes: config.applicantTypes.map((applicantType) => {
        const requirement = config.requirements[applicantType]!;
        const required = [
          ...new Set([...requirement.requiredFields, ...config.requiredFields]),
        ];
        return {
          applicantType,
          requiredFields: required.map(field),
          optionalFields: config.optionalFields
            .filter((name) => !required.includes(name))
            .map(field),
          requiredDocuments: requirement.requiredDocuments.map(document),
          optionalDocuments: config.optionalDocuments.map(document),
        };
      }),
    }));
  }
}
