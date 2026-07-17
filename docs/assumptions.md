# Assumptions & Design Decisions

Living document, updated as each Phase 1 slice is implemented. Each entry states the decision, why it was made, and its impact/scope.

## Backend root location

**Decision:** Backend lives at `f:\LocalGo-BE` (its own git repository), not nested inside the frontend at `F:\LocalGo\backend` as an earlier draft of the spec literally stated.

**Why:** `f:\LocalGo-BE` already existed as an initialized NestJS scaffold with its own git history when this build started; nesting a second backend inside the frontend repo would have duplicated tooling and split history for no benefit.

**Impact:** Any tooling/CI that assumes the backend is a subdirectory of the frontend repo needs to point at `f:\LocalGo-BE` instead.

## TypeScript / linting strictness

**Decision:** `tsconfig.json` uses `"strict": true` with one carve-out: `"strictPropertyInitialization": false`. ESLint's `@typescript-eslint/no-explicit-any` and `no-unsafe-argument` are set to `error` (were `off`/`warn` in the bare scaffold).

**Why:** The spec mandates TypeScript strict mode and forbids unnecessary `any`. `strictPropertyInitialization` specifically was disabled because DTO/entity classes in a NestJS + class-validator + class-transformer codebase are populated by the validation/transform pipeline or factory methods (e.g. `UserResponseDto.fromEntity()`), not by constructors — enforcing constructor-time initialization on every DTO field would force either verbose `!` assertions on every property or artificial constructors across dozens of DTOs, with no real safety benefit since `class-validator` decorators are the actual runtime guard for input DTOs. This is a standard, widely-adopted exception in the NestJS ecosystem, not a general weakening of strictness.

**Impact:** All other strict flags (`strictNullChecks`, `noImplicitAny`, `strictFunctionTypes`, etc.) remain fully enforced. Only bare-property DTO/entity classes are affected.

## Prisma 7 configuration model (no-Rust-engine architecture)

**Decision:** `prisma/schema.prisma`'s `datasource` block has no `url` — instead `prisma.config.ts` (project root) holds `datasource.url = env('DATABASE_URL')` for CLI/migration purposes, and the generated client is instantiated at runtime via the `@prisma/adapter-pg` driver adapter (`new PrismaPg({ connectionString: process.env.DATABASE_URL })` passed to `new PrismaClient({ adapter })` in `src/database/prisma.service.ts`). The generator's `output` is explicitly set to `../generated/prisma` (generated code lives in the repo tree under `/generated`, gitignored, not in `node_modules`).

**Why:** The installed `prisma`/`@prisma/client` version resolved to **7.8.0** (newer than this assistant's training data), which made the classic `datasource { url = env(...) }` + implicit `node_modules/.prisma/client` pattern a hard validation error (`P1012`). This is a genuine breaking change in Prisma ORM 7, confirmed by fetching Prisma's current documentation rather than assumed from prior-version knowledge.

**Impact:** `pg` and `@prisma/adapter-pg` are now direct dependencies. Anyone regenerating the client or adding a new PrismaService-like instantiation must follow the adapter pattern, not the old implicit-URL pattern. `/generated` must stay in `.gitignore` and must be regenerated (`npx prisma generate`) after a fresh clone/install.

## Postgres role/database provisioning

**Decision:** The `localgo` Postgres role and `localgo`/`localgo_test` databases are created manually by the project owner (via `psql`/pgAdmin with superuser credentials), not by this backend's tooling.

**Why:** PostgreSQL 18 runs as a native Windows service on the development machine with password-protected auth (not `trust`), and Docker is not installed in this environment — so this agent has no path to provision the role/DB itself. The exact `CREATE ROLE`/`CREATE DATABASE` SQL was handed to the project owner with a pre-generated password already placed in `.env`/`.env.test`.

**Impact:** Migrations cannot run until this manual step is done. Production/other environments should provision the database via their own standard process (this is a dev-environment-specific gap, not a design choice for the app itself).

## Image magic-byte validation: hand-rolled instead of the `file-type` package

**Decision:** `src/modules/media/utils/image-processing.util.ts` validates upload signatures with a small hand-written byte check (PNG/JPEG/WebP magic numbers) instead of the `file-type` npm package.

**Why:** `file-type` v22 (the version that installs today) is ESM-only. A dynamic `import('file-type')` works fine when the app actually runs (verified with a standalone Node script), but fails under this project's Jest/ts-jest CommonJS test transform with `A dynamic import callback was invoked without --experimental-vm-modules`. Since only three fixed formats are ever accepted, hand-rolling the signature check (PNG: `89 50 4E 47 0D 0A 1A 0A`; JPEG: `FF D8 FF`; WebP: `RIFF....WEBP`) avoids the ESM/CJS interop problem entirely and is fully unit-testable synchronously.

**Impact:** No `file-type` dependency in `package.json`. If more upload formats are added later (e.g. PDF, video), either extend the hand-rolled check with more signatures or revisit a properly-configured ESM-aware Jest setup at that time.

## Category deletion "in use" check is a no-op in Phase 1

**Decision:** `CategoryService.remove()` always soft-deletes/deactivates the category; it does not check whether any content references it before doing so.

**Why:** The spec requires rejecting or soft-deleting category deletion when the category "is in use," but in Phase 1 the `Category` table is pure shared infra with zero real consumers — `TradePost.category` is a closed enum, not a `Category` FK, and none of the 14 content-domain modules (which will actually reference `Category`) exist yet. There is nothing to check "in use" against yet.

**Impact:** [[Phase 2 content-domain modules]] (agriculture, attractions, etc.) must each add a real reference check to `CategoryService.remove()` (throw `CATEGORY_IN_USE`) as they wire up to `Category`, before this path is exposed to production data that actually references categories.

## TradePost status machine: ARCHIVED/EXPIRED are terminal; no scheduled expiry job

**Decision:** The legal transition table (`trade-post-transitions.util.ts`) has no outbound transitions from `ARCHIVED` or `EXPIRED`, and nothing in Phase 1 automatically flips a `PUBLISHED` post to `EXPIRED` when `expiresAt` passes — expiry is enforced purely as a public-visibility query filter (`listPublic`/`getPublicDetail` exclude posts whose `expiresAt` has passed, regardless of their stored `status`).

**Why:** The spec explicitly marks "ARCHIVED → DRAFT hoặc PUBLISHED" as optional ("nếu nghiệp vụ cho phép"), and a scheduled expiry job is an infra/cron concern that doesn't change correctness — the query filter already guarantees expired posts are never shown as active regardless of their persisted status.

**Impact:** An `ARCHIVED` post can only be revived by direct DB intervention in Phase 1 (no un-archive endpoint). A `PUBLISHED` post past its `expiresAt` keeps `status = PUBLISHED` in the database until some future job or admin action changes it, but is already correctly hidden from every public read path. A later phase should add a scheduled job to actually flip `status` to `EXPIRED` for data-accuracy/reporting purposes.

## Seed script: no images on seeded reviews, deterministic ids for idempotency

**Decision:** `prisma/seed.ts` creates trade posts and reviews without attaching any `Media`/`TradePostImage`/`TradeReviewImage` rows, and derives each seeded `TradeReview`'s id deterministically (SHA-1 of a fixed namespace + the post slug + reviewer id) instead of a random UUID.

**Why:** Real images require running the actual resize/checksum/storage pipeline (`MediaService.uploadImage`) against real file bytes — fabricating `Media` rows that don't point at real files on disk would violate the same "no orphan/fake media" invariant the app enforces elsewhere. Deterministic review ids make the seed script safely re-runnable (`upsert` by id) without needing a separate compound-unique lookup just for seeding purposes.

**Impact:** Seeded trade posts show no gallery images and seeded reviews show no review photos. If a demo needs to show the image gallery UI, upload real images through `POST /media/images` manually after seeding, then `PATCH` the relevant trade post/review with the returned `imageIds`.

## Rate limiting is disabled when NODE_ENV=test

**Decision:** `ThrottlerModule`'s `skipIf` option disables all rate limiting when `config.nodeEnv === 'test'`; production and development keep the full per-route limits (e.g. 5 logins/min on `/auth/zalo`, `/auth/login`, `/auth/refresh`).

**Why:** Running the real e2e suite against a live database surfaced this: the e2e fixtures each call `POST /auth/zalo` to log in a fresh mock user, and several test cases (e.g. the rating-recomputation concurrency test) create 5+ users in quick succession — comfortably exceeding the 5-requests/60s throttle meant to stop credential-stuffing/brute-force in real traffic. Confirmed via `npm run test:e2e`: before this fix, 7 of 19 e2e tests failed with `429 Too Many Requests`, not a real product bug; after adding `skipIf`, all 19 passed.

**Impact:** The e2e test database (`localgo_test`) and any environment intentionally run with `NODE_ENV=test` have no rate limiting at all — this must never be how a real (dev/staging/production) deployment is configured. `NODE_ENV=test` should only ever be set for automated test runs.
