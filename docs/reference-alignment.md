# ResTrade reference alignment

The implementation uses the 25 September 2026 prototype supplied in `ResTrade-UI-Prototype.zip`. Work is on `ui/reference-alignment`; existing local changes were retained as the starting point. Nothing has been deployed.

## Screens and shared components

- `globals.css`: reference palette, typography, spacing, buttons, cards, responsive grids and visible keyboard focus. Old competing theme overrides were replaced.
- `SiteShell`, `UI`, `PublicLayout`: shared navigation, role-aware admin link, real profile/campus, search, focus-managed mobile drawer, native modal dialogs, status badges and honest loading/error states.
- `ProductCard`, `ListingForm`: real images with neutral failure fallbacks, supported metadata, persistent saves, creation/editing and validated image uploads.
- Marketplace: categories, saved-items view, search across every fetched page, price/newest sorting, item details and explicit purchase review.
- Overview: real counts, wallet and held funds, recent orders, inventory and test top-ups.
- Orders: purchases/sales, status filters including refunds, receipt acknowledgement before release, disputes, reviews and case access. Collection is never marked complete just because escrow is funded.
- `DisputeCasePanel`: stored reports, conversation, private attachments, event history and two-step administrator resolution with a recorded note.
- Profile/settings: editable supported fields, real review counts, durable preferences and recent in-app order notifications.
- Landing/About/authentication: reference composition, real authentication, original routes and safe login return paths. Administrators may visit ordinary marketplace pages; `/admin` remains protected independently in middleware and by the database.

## Verified existing backend contracts

Project schema, constraints, grants, RLS policies, transaction functions and storage buckets were inspected read-only. **No migration or database reset is required for this frontend change.** Do not replay old schema proposals from the prototype.

| UI feature          | Existing integration                                                                                                   |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Listing metadata    | `products.category`, `condition`, `campus`, `location`                                                                 |
| Condition values    | `new`, `like_new`, `good`, `fair`                                                                                      |
| Identity/reputation | `profiles.full_name`, `campus`, `bio`, `trust_score`, `total_reviews`                                                  |
| Saved items         | `saved_items(user_id, product_id)`                                                                                     |
| Preferences         | `notification_preferences(user_id, order_alerts, marketplace_updates)`                                                 |
| Order notifications | `notifications`, including `read_at`                                                                                   |
| Purchase            | `initiate_purchase(p_product_id)`                                                                                      |
| Confirm receipt     | `release_escrow(p_order_id)`                                                                                           |
| Detailed dispute    | `open_dispute(p_order_id, p_reason, p_description)`                                                                    |
| Recorded resolution | `resolve_dispute_with_note(p_order_id, p_favor_buyer, p_note)`                                                         |
| Case history        | `disputes`, `dispute_messages`, `order_events`                                                                         |
| Test funds          | `fund_wallet(p_amount)`, server-validated                                                                              |
| Listing photos      | Public `product-images`; JPEG/PNG up to 10 MB, user-prefixed paths                                                     |
| Evidence            | Private `dispute-evidence`; JPEG/PNG/PDF up to 10 MB, `order_id/user_id/unique-file` paths and short-lived signed URLs |

The original `raise_dispute(p_order_id)` and `resolve_dispute(p_order_id,p_favor_buyer)` remain available in the backend. The richer UI intentionally uses their verified newer counterparts so its reason/description/note fields are persisted atomically. Money and order-state changes remain exclusively in server-validated RPCs.

## Validation and reproduction

Completed checks:

| Check                                  | Result                       |
| -------------------------------------- | ---------------------------- |
| Production build and TypeScript        | Passed                       |
| ESLint                                 | Passed, no warnings          |
| Formatting                             | Passed                       |
| Isolated browser suite                 | 10 tests passed              |
| Anonymous protected-route checks       | 7 routes redirected to login |
| Live public API / anonymous RPC checks | 5 checks passed              |
| Desktop/mobile screenshot capture      | Completed                    |

Visual inspection included the live landing page, desktop marketplace and overview, and mobile landing/marketplace screenshots. Main page layouts were also checked automatically at four viewport widths.

```sh
npm ci
npm run build
npm run lint
npm run test:ui
node --env-file=.env.local tests/live-contracts.mjs
```

Browser tests use installed Microsoft Edge by default. Set `PLAYWRIGHT_CHANNEL=chrome` to use Chrome. The test fixture server serves built HTML and intercepts Supabase responses in the browser. Fixtures never enter the application bundle or write to Supabase. These tests verify UI behaviour, not authentication or database isolation.

For real anonymous route checks and public-page screenshots, start `npm run start -- --port 3108`, then run `node tests/production-smoke.mjs`. This only reads public pages and verifies protected-route redirects.

The checks cover category filtering, sorting, saved-item persistence, searches beyond the first API page, mobile search/grid/focus, receipt acknowledgement, failed-release feedback, dispute parameters, durable preference feedback, real reputation display, failed fetches, deliberate admin confirmation, listing metadata and photo validation. Layout checks cover 320, 390, 820 and 1440 CSS-pixel widths. Automated checks and visual inspection do not establish accessibility compliance.

## Screenshots

Generated images are in `artifacts/screenshots/` (ignored by Git):

- `*-live.png`: actual local production public pages, using available backend listing data.
- `*-fixture.png`: actual application components rendered with isolated test data; these are visual-review evidence, not real account or transaction results.
- Main authenticated screens include marketplace, dashboard, orders, profile, settings and administrator queue. Public screens include landing, About, login and registration.

## Remaining verification limits

Real buyer/seller/admin account credentials were requested but were not available during implementation. Authenticated purchase/release/refund flows, real upload persistence and email verification therefore still need an end-to-end run with test accounts and test funds. No account was created and no live wallet was changed by the validation scripts. Public reads and anonymous transaction denials were checked against the live API.

Marketplace preference storage is connected, but this frontend does not add an email or push delivery service. Private attachment links expire after ten minutes; the case panel provides a refresh action.

Only pinned development dependencies (`@playwright/test`, `prettier`) were added. Existing runtime versions were preserved, and the npm lockfile was updated for the development tools. Installation reported dependency advisories; no unrelated automatic dependency upgrades were applied.

## Asset credit

The prototype’s backpack photograph is used only as the landing-page marketing illustration, never as a fallback or replacement for a real listing photograph. Credit: Sun Lingyan / Unsplash, https://unsplash.com/photos/_H0fjILH5Vw. All production product cards use `products.image_url` or a neutral missing-image state. Sample identities, wallet mutations, fictional evidence, hash routes and design-preview banners were not imported.
