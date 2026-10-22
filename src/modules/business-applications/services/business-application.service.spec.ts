import {
  BusinessApplicantType,
  BusinessApplicationStatus,
  BusinessDocumentType,
  BusinessType,
} from '../../../../generated/prisma';
import { ErrorCode } from '../../../common/constants/error-codes.constant';
import { AppException } from '../../../common/exceptions/app.exception';
import type { UpsertBusinessApplicationDto } from '../dto/upsert-business-application.dto';
import { BusinessApplicationService } from './business-application.service';

const common = {
  businessName: 'Local Business',
  businessCategory: 'Ẩm thực',
  contactName: 'Nguyễn Văn A',
  contactPhone: '0901234567',
  contactEmail: 'a@example.com',
  address: 'Tây Ninh',
  zaloId: 'zalo-123',
  documents: [],
};

describe('BusinessApplicationService validation and ownership', () => {
  const repository = {
    findById: jest.fn(),
    findLatestForUser: jest.fn(),
    findAdminList: jest.fn(),
  };
  const prisma = { $transaction: jest.fn() };
  const documentAccess = { createSignedUrl: jest.fn() };
  const mediaService = {
    pruneDetachedMedia: jest.fn(),
    purgeStorage: jest.fn(),
  };
  const notifications = { notify: jest.fn() };
  const service = new BusinessApplicationService(
    repository as never,
    prisma as never,
    documentAccess as never,
    mediaService as never,
    notifications as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it('rejects an INDIVIDUAL application without complete identity documents', () => {
    const dto = {
      ...common,
      applicantType: BusinessApplicantType.INDIVIDUAL,
    } as UpsertBusinessApplicationDto;
    try {
      service.validateByApplicantType(dto);
      throw new Error('Expected validation to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(AppException);
      expect((error as AppException).code).toBe(
        ErrorCode.INVALID_BUSINESS_APPLICATION,
      );
    }
  });

  it('rejects an ORGANIZATION application without tax code or business license', () => {
    const dto = {
      ...common,
      applicantType: BusinessApplicantType.ORGANIZATION,
      legalName: 'Công ty ABC',
      representativeName: 'Nguyễn Văn A',
      representativeTitle: 'Giám đốc',
    } as UpsertBusinessApplicationDto;
    try {
      service.validateByApplicantType(dto);
      throw new Error('Expected validation to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(AppException);
      expect((error as AppException).code).toBe(
        ErrorCode.INVALID_BUSINESS_APPLICATION,
      );
    }
  });

  describe('business type requirements', () => {
    const identity = {
      identityNumber: '079200000001',
      identityIssuedAt: '2020-01-01',
      identityIssuedPlace: 'Cục CS QLHC về TTXH',
    };
    const doc = (type: BusinessDocumentType, index: number) => ({
      type,
      mediaId: `00000000-0000-4000-8000-00000000000${index}`,
      name: `${type}.jpg`,
    });
    const identityDocs = [
      doc(BusinessDocumentType.IDENTITY_FRONT, 1),
      doc(BusinessDocumentType.IDENTITY_BACK, 2),
    ];

    function expectInvalid(dto: Partial<UpsertBusinessApplicationDto>): string {
      try {
        service.validateByApplicantType({
          ...common,
          ...dto,
        } as UpsertBusinessApplicationDto);
      } catch (error) {
        expect(error).toBeInstanceOf(AppException);
        expect((error as AppException).code).toBe(
          ErrorCode.INVALID_BUSINESS_APPLICATION,
        );
        return (error as AppException).message;
      }
      throw new Error('Expected validation to fail');
    }

    it('accepts a temple management board without tax code or business licence', () => {
      expect(() =>
        service.validateByApplicantType({
          ...common,
          ...identity,
          businessType: BusinessType.TEMPLE_MANAGEMENT,
          applicantType: BusinessApplicantType.ORGANIZATION,
          templeName: 'Đền Bà',
          representativeName: 'Nguyễn Văn B',
          representativeTitle: 'Trưởng ban',
          documents: [
            ...identityDocs,
            doc(BusinessDocumentType.MANAGEMENT_DECISION, 3),
          ],
        }),
      ).not.toThrow();
    });

    it('requires the management decision document and temple name for a temple board', () => {
      const message = expectInvalid({
        ...identity,
        businessType: BusinessType.TEMPLE_MANAGEMENT,
        applicantType: BusinessApplicantType.ORGANIZATION,
        representativeName: 'Nguyễn Văn B',
        representativeTitle: 'Trưởng ban',
        documents: identityDocs,
      });
      expect(message).toContain('Tên đền/chùa/miếu');
      expect(message).toContain('quyết định công nhận Ban quản lý');
    });

    it('does not let a temple board register as an individual', () => {
      expect(
        expectInvalid({
          businessType: BusinessType.TEMPLE_MANAGEMENT,
          applicantType: BusinessApplicantType.INDIVIDUAL,
        }),
      ).toContain('tổ chức');
    });

    it('requires a business licence from an individual restaurant owner', () => {
      expect(
        expectInvalid({
          ...identity,
          businessType: BusinessType.RESTAURANT,
          applicantType: BusinessApplicantType.INDIVIDUAL,
          documents: identityDocs,
        }),
      ).toContain('đăng ký kinh doanh');
    });

    it('requires main products from a garden owner but no business licence', () => {
      const base = {
        ...common,
        ...identity,
        businessType: BusinessType.GARDEN,
        applicantType: BusinessApplicantType.INDIVIDUAL,
        documents: identityDocs,
      };
      expect(
        expectInvalid(base as Partial<UpsertBusinessApplicationDto>),
      ).toContain('Sản phẩm/cây trồng chính');
      expect(() =>
        service.validateByApplicantType({
          ...base,
          mainProducts: 'Sầu riêng, bưởi da xanh',
        }),
      ).not.toThrow();
    });
  });

  it('does not allow a user to update another users rejected application', async () => {
    repository.findById.mockResolvedValue({
      id: 'application-id',
      submittedById: 'owner-id',
      status: BusinessApplicationStatus.REJECTED,
    });
    const validDto = {
      ...common,
      applicantType: BusinessApplicantType.INDIVIDUAL,
      identityNumber: '072190012345',
      identityIssuedAt: '2021-09-16',
      identityIssuedPlace: 'Cục CSQLHC',
      documents: [
        {
          mediaId: '00000000-0000-4000-8000-000000000001',
          type: BusinessDocumentType.IDENTITY_FRONT,
          name: 'front.jpg',
        },
        {
          mediaId: '00000000-0000-4000-8000-000000000002',
          type: BusinessDocumentType.IDENTITY_BACK,
          name: 'back.jpg',
        },
      ],
    } as UpsertBusinessApplicationDto;
    await expect(
      service.update('other-id', 'application-id', validDto),
    ).rejects.toMatchObject({
      code: ErrorCode.APPLICATION_NOT_FOUND,
    });
  });
});
