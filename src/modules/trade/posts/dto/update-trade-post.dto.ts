import { PartialType } from '@nestjs/swagger';
import { CreateTradePostDto } from './create-trade-post.dto';

/**
 * Deliberately excludes `featured` and `status` — those are never
 * client-writable; they only change via the dedicated admin/workflow
 * endpoints (submit/approve/reject/archive/feature).
 */
export class UpdateTradePostDto extends PartialType(CreateTradePostDto) {}
