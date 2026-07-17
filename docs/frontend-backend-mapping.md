# Frontend ↔ Backend Mapping

Status: **Phase 1 scope only** (trade/giao thương + auth). The 14 read-only content domains (agriculture, attractions, temples, historical-sites, specialties, cuisine, craft-villages, festivals, experience-tours, ocop, map-places, news, contacts) are analyzed below for context but their backend modules ship in a later phase — this table will be extended when they do.

## Source of the analysis

Frontend root: `F:\LocalGo`. Analyzed via direct inspection of `src/data/*.ts` (14 files, one per content domain), `src/services/*.ts` (11 of the 14 domains have a thin service wrapper; `temples`, `attractions`, `specialties` do not — pages import the mock array directly), `src/pages/trade.tsx` / `trade-detail.tsx` (trade posts + inline review UI, the only "giao thương" code that exists), and `src/components/search-popup.tsx` (client-side search aggregation, no backend today).

## Trade / Giao thương (Phase 1 — built)

| Frontend page/component | Frontend model | Mock data/service | Database entity | API endpoint | Ghi chú |
| --- | --- | --- | --- | --- | --- |
| `src/pages/trade.tsx` (list) | inline `tradePosts` array, `id: number` | page-local mock, no service file | `TradePost` | `GET /api/v1/trade-posts` | Frontend mock `id` is numeric; backend `id` is a UUID string — frontend integration must switch to string ids and add a `slug` for pretty URLs (not present in the mock at all). |
| `src/pages/trade-detail.tsx` (detail) | same shape, looked up via `Number(id)` | same mock | `TradePost` (detail, with `images`) | `GET /api/v1/trade-posts/:idOrSlug` | Mock fields `owner` (string name) and `rating`/`reviewCount` map to `TradePost.contactName`/`averageRating`/`reviewCount` — but the mock has no owner *account*, no images array, no status/moderation concept at all. Backend adds all of this net-new. |
| "Đăng tin" button on `trade.tsx` (currently non-functional) | — | — | `POST /api/v1/trade-posts` + `PATCH /api/v1/trade-posts/:id/submit` | Create/submit | Frontend has a visible button with no wired action — this is the first real integration point. |
| Inline review form in `trade-detail.tsx` (2 hardcoded reviews + a client-only "submit review" popup: rating 1-5 stars, text, up to 3 images via `URL.createObjectURL`, never persisted) | ad-hoc local state `{ rating, content, images }` + hardcoded reviewer name/time strings | none — pure UI mock | `TradeReview` + `TradeReviewImage` | `GET/POST /api/v1/trade-posts/:tradePostId/reviews`, `GET .../reviews/summary` | This is the shape the backend's Review entity was designed from — `rating`(1-5)/`content`/`images` line up directly. Backend adds `status` (moderation), one-review-per-user enforcement, and real image upload via `POST /api/v1/media/images` first. |

### Field mapping detail: trade post mock → `TradePost`

| Frontend field | Type | Backend field | Notes |
| --- | --- | --- | --- |
| `id` | `number` | `id` | Backend uses UUID string; frontend must stop using `Number(id)` lookups. |
| `category` | `"Sản phẩm" \| "Dịch vụ" \| "Cần mua" \| "Khuyến mãi"` | `category` (`PRODUCT \| SERVICE \| BUY_REQUEST \| PROMOTION`) | Direct 1:1 remap, Vietnamese label → enum constant (needs a small label lookup table on the frontend). |
| `title` | `string` | `title` | — |
| `owner` | `string` (display name only) | `contactName` + real `ownerId` (User relation) | Mock has no real account; backend requires an authenticated owner. |
| `location` | `string` | `address` | — |
| `price` | `string` (always a display string, e.g. "Liên hệ báo giá") | `priceLabel` (display) + `price`/`priceType` (structured) | Backend keeps both: a real `Decimal` for FIXED-price posts (business rule enforced) and the freeform label for display parity with the mock. |
| `summary` | `string` | `summary` | — |
| `image` | static asset import | `thumbnailUrl` (+ `images[]` gallery) | Frontend must switch from bundled asset imports to backend-served URLs (`PUBLIC_BASE_URL/uploads/...`). |
| `rating` | `number` | `averageRating` | Backend computes this from actual reviews (transactional recompute), never client-supplied. |
| `reviewCount` | `number` | `reviewCount` | Same as above. |
| `badge` | `string?` | `featured` (boolean) | Mock's freeform badge string collapses to a boolean in Phase 1; admin-only `PATCH /admin/trade-posts/:id/feature`. |
| — (not in mock) | — | `status`, `priceType`, `contactPhone`, `contactZalo`, `promotionPercent/StartAt/EndAt`, `expiresAt` | Net-new fields the frontend detail page will need to start rendering (e.g. a "Chờ duyệt" badge for non-owner-visible statuses, promotion countdown for `PROMOTION` posts). |

## Auth (Phase 1 — built, no frontend precedent)

The frontend has **no login/auth code at all** — only a single unrelated `zmp-sdk` import (`getSystemInfo()` for reading the Zalo theme in `src/components/layout.tsx`). No `AuthContext`, no `useAuth` hook, no token storage, no protected routes exist today. The `POST /api/v1/auth/zalo` endpoint (exchanging a `zmp-sdk` `getAccessToken()` value) and the access/refresh token flow are designed from the spec alone — this is the biggest net-new integration surface for the frontend team, detailed in `docs/frontend-integration.md`.

## Other domains (Phase 2 — analyzed, not yet built)

All 14 read-only content domains follow one repeating shape: a TS `interface` + `Category` union type + mock array in `src/data/<domain>.ts`, list/detail pages in `src/pages/`, and (for 11 of the 14) a thin `getXItems(query?)`/`getXItemById(id)` service pair in `src/services/<domain>.ts` (temples, attractions, and specialties have no service file — their pages import the mock array directly). Every domain's `id` is a slug-like string already (unlike trade's numeric ids), and every mock item has an `image` field pointing at a bundled asset. When Phase 2 builds these modules, expect: a shared base content shape (`id/slug/title/summary/description/category/thumbnailUrl/status/...`), a `Category` row per domain value (the `Category` table already exists for this purpose — see `docs/assumptions.md`), and per-domain metadata validated via dedicated DTOs (e.g. `HistoricalSite.rank`/`recognizedYear`, `OcopProduct.rating`/`producer`, `MapPlace.coordinates`). Feedback, Favorites, and Search are similarly deferred — Feedback already has a channel *catalog* mock (`src/data/feedback.ts` + `submitFeedback()` in `src/services/feedback.ts`, the only existing "write" contract in the whole frontend) but no submitted-ticket persistence; Favorites has no frontend code at all; Search is entirely client-side today (`src/components/search-popup.tsx` aggregating all mock arrays in-browser).
