import {
  BusinessApplicantType,
  BusinessApplicationStatus,
  BusinessDocumentType,
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
  const service = new BusinessApplicationService(
    repository as never,
    prisma as never,
    documentAccess as never,
    mediaService as never,
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
