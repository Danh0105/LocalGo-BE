import { HttpStatus, Injectable } from '@nestjs/common';
import {
  FeedbackTicketStatus,
  Prisma,
  type FeedbackChannelCategory,
  type FeedbackTicket,
  type User,
} from '../../../../generated/prisma';
import { ErrorCode } from '../../../common/constants/error-codes.constant';
import { AppException } from '../../../common/exceptions/app.exception';
import { paginate } from '../../../common/pagination/pagination.util';
import { PrismaService } from '../../../database/prisma.service';
import { LookupFeedbackTicketDto } from '../dto/lookup-feedback-ticket.dto';
import { QueryFeedbackTicketAdminDto } from '../dto/query-feedback-ticket.dto';
import { SubmitFeedbackTicketDto } from '../dto/submit-feedback-ticket.dto';
import { UpdateFeedbackTicketStatusDto } from '../dto/update-feedback-ticket-status.dto';
import {
  FeedbackTicketAdminResponseDto,
  FeedbackTicketLookupResponseDto,
  SubmitFeedbackTicketResponseDto,
} from '../dto/feedback-ticket-response.dto';
import { FEEDBACK_CHANNEL_CATEGORY_FROM_DB } from '../feedback-channel.constants';
import {
  FEEDBACK_TICKET_STATUS_FROM_DB,
  FEEDBACK_TICKET_STATUS_TO_DB,
} from '../feedback-ticket.constants';
import { isValidFeedbackTicketTransition } from '../utils/feedback-ticket-transitions.util';
import { generateTicketCode } from '../utils/ticket-code.util';

type FeedbackTicketRecord = FeedbackTicket & {
  handledBy: Pick<User, 'displayName'> | null;
};

type FeedbackTicketLookupRecord = FeedbackTicket & {
  channel: {
    id: string;
    title: string;
    category: FeedbackChannelCategory;
  } | null;
};

const includeFeedbackTicket = {
  handledBy: { select: { displayName: true } },
};

/** Strips incidental whitespace so "090 123 4567" matches "0901234567". */
function normalizePhone(phone: string): string {
  return phone.replace(/\s+/g, '');
}

const MAX_TICKET_CODE_ATTEMPTS = 5;

@Injectable()
export class FeedbackTicketService {
  constructor(private readonly prisma: PrismaService) {}

  async submit(
    dto: SubmitFeedbackTicketDto,
  ): Promise<SubmitFeedbackTicketResponseDto> {
    if (dto.channelId) {
      const channel = await this.prisma.feedbackChannel.findUnique({
        where: { id: dto.channelId },
        select: { id: true },
      });
      if (!channel) {
        throw new AppException(
          ErrorCode.VALIDATION_ERROR,
          'channelId không tồn tại',
        );
      }
    }

    for (let attempt = 0; attempt < MAX_TICKET_CODE_ATTEMPTS; attempt++) {
      const ticketCode = generateTicketCode();
      try {
        await this.prisma.feedbackTicket.create({
          data: {
            ticketCode,
            channelId: dto.channelId ?? null,
            fullName: dto.fullName,
            phone: dto.phone,
            content: dto.content,
            status: FeedbackTicketStatus.NEW,
          },
        });
        return { success: true, ticketCode };
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          continue;
        }
        throw error;
      }
    }
    throw new AppException(
      ErrorCode.INTERNAL_ERROR,
      'Không thể tạo mã ticket, vui lòng thử lại',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  async lookup(
    dto: LookupFeedbackTicketDto,
  ): Promise<FeedbackTicketLookupResponseDto> {
    const record = await this.prisma.feedbackTicket.findUnique({
      where: { ticketCode: dto.ticketCode.trim().toUpperCase() },
      include: {
        channel: { select: { id: true, title: true, category: true } },
      },
    });
    // Same 404 whether the code doesn't exist or the phone doesn't match it,
    // so a guessed ticketCode can't be used to probe for its owner's phone.
    if (!record || normalizePhone(record.phone) !== normalizePhone(dto.phone)) {
      throw this.notFound();
    }
    return this.toLookupDto(record);
  }

  async adminList(query: QueryFeedbackTicketAdminDto) {
    const searchUpper = query.search?.toUpperCase();
    const where: Prisma.FeedbackTicketWhereInput = {
      ...(query.status
        ? { status: FEEDBACK_TICKET_STATUS_TO_DB[query.status] }
        : {}),
      ...(query.channelId ? { channelId: query.channelId } : {}),
      ...(query.fromDate || query.toDate
        ? {
            createdAt: {
              ...(query.fromDate ? { gte: new Date(query.fromDate) } : {}),
              ...(query.toDate ? { lte: new Date(query.toDate) } : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { fullName: { contains: query.search, mode: 'insensitive' } },
              { phone: { contains: query.search } },
              { ticketCode: { contains: searchUpper } },
            ],
          }
        : {}),
    };
    const [records, total] = await this.prisma.$transaction([
      this.prisma.feedbackTicket.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: includeFeedbackTicket,
      }),
      this.prisma.feedbackTicket.count({ where }),
    ]);
    return paginate(
      records.map((record) => this.toAdminDto(record)),
      query.page,
      query.limit,
      total,
    );
  }

  async adminDetail(id: string): Promise<FeedbackTicketAdminResponseDto> {
    return this.toAdminDto(await this.findOrThrow(id));
  }

  async updateStatus(
    actorId: string,
    id: string,
    dto: UpdateFeedbackTicketStatusDto,
  ): Promise<FeedbackTicketAdminResponseDto> {
    const current = await this.findOrThrow(id);
    const targetStatus = FEEDBACK_TICKET_STATUS_TO_DB[dto.status];
    if (!isValidFeedbackTicketTransition(current.status, targetStatus)) {
      throw new AppException(
        ErrorCode.INVALID_STATUS_TRANSITION,
        `Không thể chuyển trạng thái từ ${FEEDBACK_TICKET_STATUS_FROM_DB[current.status]} sang ${dto.status}`,
        HttpStatus.CONFLICT,
      );
    }

    const record = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.feedbackTicket.update({
        where: { id },
        data: {
          status: targetStatus,
          adminNote: dto.adminNote ?? current.adminNote,
          handledById: actorId,
          ...(targetStatus === FeedbackTicketStatus.RESOLVED
            ? { resolvedAt: new Date() }
            : {}),
        },
        include: includeFeedbackTicket,
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'FEEDBACK_TICKET_STATUS_UPDATED',
          resourceType: 'FeedbackTicket',
          resourceId: id,
          oldData: { status: current.status },
          newData: { status: targetStatus },
        },
      });
      return updated;
    });
    return this.toAdminDto(record);
  }

  private async findOrThrow(id: string): Promise<FeedbackTicketRecord> {
    const record = await this.prisma.feedbackTicket.findUnique({
      where: { id },
      include: includeFeedbackTicket,
    });
    if (!record) throw this.notFound();
    return record;
  }

  private toLookupDto(
    record: FeedbackTicketLookupRecord,
  ): FeedbackTicketLookupResponseDto {
    return {
      ticketCode: record.ticketCode,
      status: FEEDBACK_TICKET_STATUS_FROM_DB[record.status],
      channel: record.channel
        ? {
            id: record.channel.id,
            title: record.channel.title,
            category:
              FEEDBACK_CHANNEL_CATEGORY_FROM_DB[record.channel.category],
          }
        : null,
      content: record.content,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      resolvedAt: record.resolvedAt,
    };
  }

  private toAdminDto(
    record: FeedbackTicketRecord,
  ): FeedbackTicketAdminResponseDto {
    return {
      id: record.id,
      ticketCode: record.ticketCode,
      channelId: record.channelId,
      fullName: record.fullName,
      phone: record.phone,
      content: record.content,
      status: FEEDBACK_TICKET_STATUS_FROM_DB[record.status],
      adminNote: record.adminNote,
      handledBy: record.handledBy?.displayName ?? null,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      resolvedAt: record.resolvedAt,
    };
  }

  private notFound(): AppException {
    return new AppException(
      ErrorCode.FEEDBACK_TICKET_NOT_FOUND,
      'Không tìm thấy ticket phản hồi',
      HttpStatus.NOT_FOUND,
    );
  }
}
