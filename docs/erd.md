# ERD — Phase 1 (Foundation, Auth, Media, Trade + Reviews)

Covers every table that exists in `prisma/schema.prisma` today. The 14 read-only content-domain tables, Favorite, FeedbackTicket/FeedbackAttachment tables do not exist yet (Phase 2+) — `Category` and `AuditLog` are built now as shared infra ahead of their real consumers (see `docs/assumptions.md`).

```mermaid
erDiagram
    User ||--o{ AuthSession : "has sessions"
    User ||--o{ TradePost : "owns (ownerId)"
    User ||--o{ TradePost : "approves (approvedById)"
    User ||--o{ TradeReview : "writes"
    User ||--o{ Media : "uploads"
    User ||--o{ AuditLog : "acts as"

    TradePost ||--o{ TradePostImage : "gallery"
    TradePost ||--o{ TradeReview : "reviewed by"

    TradeReview ||--o{ TradeReviewImage : "gallery"

    Media ||--o{ TradePostImage : "referenced by"
    Media ||--o{ TradeReviewImage : "referenced by"

    Category }o--o{ Category : "parent/children"

    User {
        string id PK
        string zaloId UK "nullable"
        string phone UK "nullable"
        string email UK "nullable"
        string displayName
        string avatarUrl "nullable"
        string passwordHash "nullable"
        enum role "USER|BUSINESS|MODERATOR|ADMIN"
        enum status "ACTIVE|BLOCKED|PENDING"
        datetime lastLoginAt "nullable"
        datetime deletedAt "nullable"
    }

    AuthSession {
        string id PK
        string familyId
        string userId FK
        string refreshTokenHash
        datetime expiresAt "absolute, fixed at family creation"
        string replacedByTokenId FK "nullable, unique"
        datetime revokedAt "nullable"
        enum revokedReason "nullable"
    }

    Category {
        string id PK
        string domain
        string slug
        string name
        string parentId FK "nullable"
        boolean isActive
        datetime deletedAt "nullable"
    }

    Media {
        string id PK
        string ownerId FK
        enum storageProvider "LOCAL|S3"
        string storageKey UK
        string originalUrl
        string thumbnailUrl "nullable"
        string mimeType
        int size
        int width "nullable"
        int height "nullable"
        string checksum
        enum resourceType "nullable, denormalized"
        string resourceId "nullable, denormalized"
        datetime deletedAt "nullable"
    }

    TradePost {
        string id PK
        string slug UK
        string ownerId FK
        enum category "PRODUCT|SERVICE|BUY_REQUEST|PROMOTION"
        string title
        enum priceType "FIXED|NEGOTIABLE|CONTACT"
        decimal price "nullable"
        decimal lat "nullable"
        decimal lng "nullable"
        enum status "DRAFT|PENDING|PUBLISHED|REJECTED|EXPIRED|ARCHIVED"
        boolean featured
        int promotionPercent "nullable"
        datetime promotionStartAt "nullable"
        datetime promotionEndAt "nullable"
        datetime expiresAt "nullable"
        int viewCount
        decimal averageRating
        int reviewCount
        datetime publishedAt "nullable"
        string rejectedReason "nullable"
        string approvedById FK "nullable"
        datetime approvedAt "nullable"
        datetime deletedAt "nullable"
    }

    TradePostImage {
        string id PK
        string tradePostId FK
        string mediaId FK
        int sortOrder
    }

    TradeReview {
        string id PK
        string tradePostId FK
        string userId FK
        int rating "1-5, CHECK constraint"
        string content "max 500 chars"
        enum status "PENDING|PUBLISHED|HIDDEN"
        datetime deletedAt "nullable"
    }

    TradeReviewImage {
        string id PK
        string tradeReviewId FK
        string mediaId FK
        int sortOrder
    }

    AuditLog {
        string id PK
        string actorId FK "nullable"
        string action
        string resourceType
        string resourceId "nullable"
        json oldData "nullable, redacted"
        json newData "nullable, redacted"
        string requestId "nullable"
        datetime createdAt
    }
```

## Notes on cardinality and integrity

- `TradeReview` has no schema-visible unique constraint for "one active review per user per post" — it's enforced by a hand-written **partial unique index** (`WHERE deletedAt IS NULL`) applied in a follow-up raw-SQL migration, since Prisma's schema DSL can't express a filtered unique constraint. See `docs/assumptions.md`.
- `Media.resourceType`/`resourceId` are denormalized, nullable pointers only — `TradePostImage`/`TradeReviewImage` are the authoritative galleries (a two-phase upload: media is uploaded and gets an id *before* the parent TradePost/TradeReview exists).
- `TradePost.ownerId` → `onDelete: Restrict` (a user can't be hard-deleted out from under their own posts); `TradePost.approvedById` → `onDelete: SetNull` (losing the approving moderator doesn't invalidate the post).
- `AuditLog.actorId` → `onDelete: SetNull` — audit history survives user deletion.
