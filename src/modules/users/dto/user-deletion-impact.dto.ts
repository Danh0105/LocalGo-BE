import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../../../generated/prisma';

export class UserDeletionCountsDto {
  @ApiProperty() authSessions: number;
  @ApiProperty() passwordResetTokens: number;
  @ApiProperty() businessProfiles: number;
  @ApiProperty() businessApplications: number;
  @ApiProperty() tradePosts: number;
  @ApiProperty() tradeReviews: number;
  @ApiProperty() contentReviews: number;
  @ApiProperty() reviewReplies: number;
  @ApiProperty() conversations: number;
  @ApiProperty() messages: number;
  @ApiProperty() savedPosts: number;
  @ApiProperty() notifications: number;
  @ApiProperty() auditLogs: number;
  @ApiProperty() harvestBatches: number;
  @ApiProperty() feedbackTickets: number;
  @ApiProperty() feedbackMessages: number;
  @ApiProperty() mediaFiles: number;
}

export class UserDeletionImpactDto {
  @ApiProperty() userId: string;
  @ApiProperty() displayName: string;
  @ApiProperty({ nullable: true }) email: string | null;
  @ApiProperty({ enum: UserRole }) role: UserRole;
  @ApiProperty({ type: UserDeletionCountsDto }) counts: UserDeletionCountsDto;
}
