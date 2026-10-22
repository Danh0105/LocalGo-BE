import type {
  Media,
  TradePost,
  TradePostStatus,
  TradeReview,
  TradeReviewCustomerReply,
  TradeReviewImage,
  TradeReviewStatus,
  User,
  UserStatus,
} from '../../../../../generated/prisma';

export interface TradeReviewImageView {
  id: string;
  url: string;
  thumbnailUrl: string | null;
  sortOrder: number;
}

/** The reviewed post, as shown to moderators next to each review. */
export interface TradeReviewPostView {
  id: string;
  title: string;
  slug: string;
  thumbnailUrl: string | null;
  status: TradePostStatus;
  deleted: boolean;
}

/** The review's author, as shown to moderators next to each review. */
export interface TradeReviewAuthorView {
  id: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  status: UserStatus;
}

export type TradeReviewWithImages = TradeReview & {
  images: (TradeReviewImage & { media: Media })[];
};

/** Public identity of a reviewer: no contact details. */
export interface TradeReviewReviewerView {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface TradeReviewCustomerReplyAuthorView {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface TradeReviewCustomerReplyView {
  id: string;
  reviewId: string;
  userId: string | null;
  content: string;
  createdAt: Date;
  author: TradeReviewCustomerReplyAuthorView | null;
}

export type TradeReviewCustomerReplyWithAuthor = TradeReviewCustomerReply & {
  author: Pick<User, 'id' | 'displayName' | 'avatarUrl'> | null;
};

type ReviewPostSelect = Pick<
  TradePost,
  'id' | 'title' | 'slug' | 'thumbnailUrl' | 'status' | 'deletedAt'
>;

/** Review loaded for public/owner responses: reviewer limited to public fields. */
export type TradeReviewWithPublicRelations = TradeReviewWithImages & {
  tradePost: ReviewPostSelect;
  user: Pick<User, 'id' | 'displayName' | 'avatarUrl'>;
  customerReplies: TradeReviewCustomerReplyWithAuthor[];
};

export type TradeReviewWithAdminRelations = TradeReviewWithImages & {
  tradePost: ReviewPostSelect;
  user: Pick<
    User,
    'id' | 'displayName' | 'email' | 'phone' | 'avatarUrl' | 'status'
  >;
  customerReplies: TradeReviewCustomerReplyWithAuthor[];
};

export class TradeReviewEntity {
  id: string;
  tradePostId: string;
  userId: string;
  rating: number;
  content: string;
  status: TradeReviewStatus;
  replyContent: string | null;
  repliedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  images: TradeReviewImageView[];
  customerReplies: TradeReviewCustomerReplyView[];
  /** Populated when loaded with public or admin relations. */
  tradePost?: TradeReviewPostView;
  /** Populated when loaded with public or admin relations. */
  reviewer?: TradeReviewReviewerView;
  /** Contact details — only populated when loaded with admin relations. */
  user?: TradeReviewAuthorView;

  constructor(
    review:
      | TradeReview
      | TradeReviewWithImages
      | TradeReviewWithPublicRelations
      | TradeReviewWithAdminRelations,
  ) {
    this.id = review.id;
    this.tradePostId = review.tradePostId;
    this.userId = review.userId;
    this.rating = review.rating;
    this.content = review.content;
    this.status = review.status;
    this.replyContent = review.replyContent;
    this.repliedAt = review.repliedAt;
    this.createdAt = review.createdAt;
    this.updatedAt = review.updatedAt;
    this.images =
      'images' in review
        ? review.images
            .slice()
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((image) => ({
              id: image.mediaId,
              url: image.media.originalUrl,
              thumbnailUrl: image.media.thumbnailUrl,
              sortOrder: image.sortOrder,
            }))
        : [];
    this.customerReplies =
      'customerReplies' in review
        ? review.customerReplies.map((reply) => ({
            id: reply.id,
            reviewId: reply.reviewId,
            userId: reply.userId,
            content: reply.content,
            createdAt: reply.createdAt,
            author: reply.author
              ? {
                  id: reply.author.id,
                  displayName: reply.author.displayName,
                  avatarUrl: reply.author.avatarUrl,
                }
              : null,
          }))
        : [];
    if ('tradePost' in review) {
      const { deletedAt, ...post } = review.tradePost;
      this.tradePost = { ...post, deleted: deletedAt !== null };
    }
    if ('user' in review) {
      const { id, displayName, avatarUrl } = review.user;
      this.reviewer = { id, displayName, avatarUrl };
      if ('email' in review.user) {
        this.user = { ...review.user };
      }
    }
  }
}
