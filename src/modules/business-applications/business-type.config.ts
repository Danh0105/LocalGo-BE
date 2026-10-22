import {
  BusinessApplicantType,
  BusinessDocumentType,
  BusinessType,
  TradePostPurpose,
} from '../../../generated/prisma';

/** Application fields a business type can require on top of the common ones. */
export type BusinessApplicationField =
  | 'identityNumber'
  | 'identityIssuedAt'
  | 'identityIssuedPlace'
  | 'legalName'
  | 'taxCode'
  | 'representativeName'
  | 'representativeTitle'
  | 'templeName'
  | 'openingHours'
  | 'seatingCapacity'
  | 'roomCount'
  | 'gardenArea'
  | 'mainProducts';

export interface ApplicantRequirement {
  requiredFields: BusinessApplicationField[];
  requiredDocuments: BusinessDocumentType[];
}

export interface BusinessTypeConfig {
  type: BusinessType;
  label: string;
  description: string;
  /** Applicant types this business type can register as. */
  applicantTypes: BusinessApplicantType[];
  /** Requirements that depend on registering as an individual or an organization. */
  requirements: Partial<Record<BusinessApplicantType, ApplicantRequirement>>;
  /** Type-specific fields, regardless of applicant type. */
  requiredFields: BusinessApplicationField[];
  optionalFields: BusinessApplicationField[];
  optionalDocuments: BusinessDocumentType[];
  /** Trade post purposes an approved account of this type may publish. */
  postPurposes: TradePostPurpose[];
}

const IDENTITY: ApplicantRequirement = {
  requiredFields: ['identityNumber', 'identityIssuedAt', 'identityIssuedPlace'],
  requiredDocuments: [
    BusinessDocumentType.IDENTITY_FRONT,
    BusinessDocumentType.IDENTITY_BACK,
  ],
};

const LEGAL_ENTITY: ApplicantRequirement = {
  requiredFields: [
    'legalName',
    'taxCode',
    'representativeName',
    'representativeTitle',
  ],
  requiredDocuments: [BusinessDocumentType.BUSINESS_LICENSE],
};

/** Individual household business: owner identity plus the household business licence. */
const LICENSED_INDIVIDUAL: ApplicantRequirement = {
  requiredFields: IDENTITY.requiredFields,
  requiredDocuments: [
    ...IDENTITY.requiredDocuments,
    BusinessDocumentType.BUSINESS_LICENSE,
  ],
};

const BOTH_PURPOSES = [
  TradePostPurpose.COMMERCIAL,
  TradePostPurpose.NON_PROFIT,
];
const BOTH_APPLICANT_TYPES = [
  BusinessApplicantType.INDIVIDUAL,
  BusinessApplicantType.ORGANIZATION,
];

export const BUSINESS_TYPE_CONFIG: Record<BusinessType, BusinessTypeConfig> = {
  [BusinessType.TEMPLE_MANAGEMENT]: {
    type: BusinessType.TEMPLE_MANAGEMENT,
    label: 'Ban quản lý đền/miếu',
    description:
      'Đăng tin phi lợi nhuận quảng bá lễ hội, ngày hội lớn của đền, chùa, miếu.',
    applicantTypes: [BusinessApplicantType.ORGANIZATION],
    requirements: {
      [BusinessApplicantType.ORGANIZATION]: {
        // CCCD of the board's representative; no tax code or business licence.
        requiredFields: IDENTITY.requiredFields,
        requiredDocuments: [
          ...IDENTITY.requiredDocuments,
          BusinessDocumentType.MANAGEMENT_DECISION,
        ],
      },
    },
    requiredFields: ['templeName', 'representativeName', 'representativeTitle'],
    optionalFields: [],
    optionalDocuments: [BusinessDocumentType.OTHER],
    postPurposes: [TradePostPurpose.NON_PROFIT],
  },
  [BusinessType.RESTAURANT]: {
    type: BusinessType.RESTAURANT,
    label: 'Nhà hàng – quán ăn',
    description: 'Nhà hàng, quán ăn, quán cà phê, cơ sở ăn uống.',
    applicantTypes: BOTH_APPLICANT_TYPES,
    requirements: {
      [BusinessApplicantType.INDIVIDUAL]: LICENSED_INDIVIDUAL,
      [BusinessApplicantType.ORGANIZATION]: LEGAL_ENTITY,
    },
    requiredFields: [],
    optionalFields: ['openingHours', 'seatingCapacity'],
    optionalDocuments: [
      BusinessDocumentType.FOOD_SAFETY_CERTIFICATE,
      BusinessDocumentType.TAX_DOCUMENT,
      BusinessDocumentType.OTHER,
    ],
    postPurposes: BOTH_PURPOSES,
  },
  [BusinessType.ACCOMMODATION]: {
    type: BusinessType.ACCOMMODATION,
    label: 'Khách sạn – nhà nghỉ – homestay',
    description: 'Cơ sở lưu trú: khách sạn, nhà nghỉ, homestay.',
    applicantTypes: BOTH_APPLICANT_TYPES,
    requirements: {
      [BusinessApplicantType.INDIVIDUAL]: LICENSED_INDIVIDUAL,
      [BusinessApplicantType.ORGANIZATION]: LEGAL_ENTITY,
    },
    requiredFields: [],
    optionalFields: ['openingHours', 'roomCount'],
    optionalDocuments: [
      BusinessDocumentType.SECURITY_CERTIFICATE,
      BusinessDocumentType.TAX_DOCUMENT,
      BusinessDocumentType.OTHER,
    ],
    postPurposes: BOTH_PURPOSES,
  },
  [BusinessType.GARDEN]: {
    type: BusinessType.GARDEN,
    label: 'Chủ vườn – nhà vườn',
    description:
      'Chủ vườn cây ăn trái, nhà vườn, trang trại, hợp tác xã nông nghiệp.',
    applicantTypes: BOTH_APPLICANT_TYPES,
    requirements: {
      [BusinessApplicantType.INDIVIDUAL]: IDENTITY,
      [BusinessApplicantType.ORGANIZATION]: LEGAL_ENTITY,
    },
    requiredFields: ['mainProducts'],
    optionalFields: ['gardenArea'],
    optionalDocuments: [
      BusinessDocumentType.LAND_USE_CERTIFICATE,
      BusinessDocumentType.OTHER,
    ],
    postPurposes: BOTH_PURPOSES,
  },
  [BusinessType.GENERAL]: {
    type: BusinessType.GENERAL,
    label: 'Hộ kinh doanh / doanh nghiệp khác',
    description: 'Các loại hình kinh doanh khác.',
    applicantTypes: BOTH_APPLICANT_TYPES,
    requirements: {
      [BusinessApplicantType.INDIVIDUAL]: IDENTITY,
      [BusinessApplicantType.ORGANIZATION]: LEGAL_ENTITY,
    },
    requiredFields: [],
    optionalFields: [],
    optionalDocuments: [
      BusinessDocumentType.TAX_DOCUMENT,
      BusinessDocumentType.OTHER,
    ],
    postPurposes: BOTH_PURPOSES,
  },
};

export const BUSINESS_APPLICATION_FIELD_LABEL: Record<
  BusinessApplicationField,
  string
> = {
  identityNumber: 'Số CCCD',
  identityIssuedAt: 'Ngày cấp CCCD',
  identityIssuedPlace: 'Nơi cấp CCCD',
  legalName: 'Tên pháp nhân',
  taxCode: 'Mã số thuế',
  representativeName: 'Người đại diện',
  representativeTitle: 'Chức vụ người đại diện',
  templeName: 'Tên đền/chùa/miếu',
  openingHours: 'Giờ mở cửa',
  seatingCapacity: 'Số chỗ ngồi',
  roomCount: 'Số phòng',
  gardenArea: 'Diện tích vườn',
  mainProducts: 'Sản phẩm/cây trồng chính',
};

export const BUSINESS_DOCUMENT_TYPE_LABEL: Record<
  BusinessDocumentType,
  string
> = {
  IDENTITY_FRONT: 'CCCD mặt trước',
  IDENTITY_BACK: 'CCCD mặt sau',
  BUSINESS_LICENSE: 'Giấy phép / giấy chứng nhận đăng ký kinh doanh',
  TAX_DOCUMENT: 'Giấy tờ thuế',
  OTHER: 'Giấy tờ khác',
  MANAGEMENT_DECISION: 'Văn bản xác nhận / quyết định công nhận Ban quản lý',
  FOOD_SAFETY_CERTIFICATE: 'Giấy chứng nhận đủ điều kiện ATTP',
  SECURITY_CERTIFICATE: 'Giấy chứng nhận đủ điều kiện ANTT',
  LAND_USE_CERTIFICATE: 'Giấy chứng nhận quyền sử dụng đất',
};

/** Post purposes allowed for an account; accounts without a type are GENERAL. */
export function allowedPostPurposes(
  businessType: BusinessType | null | undefined,
): TradePostPurpose[] {
  return BUSINESS_TYPE_CONFIG[businessType ?? BusinessType.GENERAL]
    .postPurposes;
}

/** Fields that only make sense for some types; cleared for the others on save. */
export const TYPE_SPECIFIC_FIELDS: BusinessApplicationField[] = [
  'templeName',
  'openingHours',
  'seatingCapacity',
  'roomCount',
  'gardenArea',
  'mainProducts',
];
