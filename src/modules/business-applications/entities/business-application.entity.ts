import type {
  BusinessApplicantType,
  BusinessApplicationStatus,
  BusinessDocumentType,
} from '../../../../generated/prisma';
import type { BusinessApplicationRecord } from '../repositories/business-application.repository';

export interface BusinessApplicationDocumentView {
  id: string;
  name: string;
  type: BusinessDocumentType;
  url: string;
  mimeType: string;
}

export class BusinessApplicationEntity {
  id: string;
  applicantType: BusinessApplicantType;
  businessName: string;
  businessCategory: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  address: string;
  identityNumber: string | null;
  identityIssuedAt: Date | null;
  identityIssuedPlace: string | null;
  legalName: string | null;
  taxCode: string | null;
  representativeName: string | null;
  representativeTitle: string | null;
  website: string | null;
  description: string | null;
  documents: BusinessApplicationDocumentView[];
  status: BusinessApplicationStatus;
  rejectionReason: string | null;
  reviewedByName: string | null;
  reviewedAt: Date | null;
  createdUserId: string | null;
  createdAt: Date;
  updatedAt: Date;

  constructor(
    record: BusinessApplicationRecord,
    documentUrl: (id: string) => string,
  ) {
    this.id = record.id;
    this.applicantType = record.applicantType;
    this.businessName = record.businessName;
    this.businessCategory = record.businessCategory;
    this.contactName = record.contactName;
    this.contactPhone = record.contactPhone;
    this.contactEmail = record.contactEmail;
    this.address = record.address;
    this.identityNumber = record.identityNumber;
    this.identityIssuedAt = record.identityIssuedAt;
    this.identityIssuedPlace = record.identityIssuedPlace;
    this.legalName = record.legalName;
    this.taxCode = record.taxCode;
    this.representativeName = record.representativeName;
    this.representativeTitle = record.representativeTitle;
    this.website = record.website;
    this.description = record.description;
    this.documents = record.documents.map((document) => ({
      id: document.id,
      name: document.name,
      type: document.type,
      url: documentUrl(document.id),
      mimeType: document.media.mimeType,
    }));
    this.status = record.status;
    this.rejectionReason = record.rejectionReason;
    this.reviewedByName = record.reviewedBy?.displayName ?? null;
    this.reviewedAt = record.reviewedAt;
    this.createdUserId = record.createdUserId;
    this.createdAt = record.createdAt;
    this.updatedAt = record.updatedAt;
  }
}
