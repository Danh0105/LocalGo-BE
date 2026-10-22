import { OmitType } from '@nestjs/swagger';
import { UpsertBusinessApplicationDto } from './upsert-business-application.dto';

/** Public registration payload for applicants who do not have a Zalo/user account. */
export class SubmitBusinessApplicationRequestDto extends OmitType(
  UpsertBusinessApplicationDto,
  ['zaloId', 'zaloDisplayName', 'zaloAvatarUrl'] as const,
) {}
