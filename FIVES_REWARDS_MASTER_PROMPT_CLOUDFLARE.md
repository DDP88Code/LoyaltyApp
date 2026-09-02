# Fives Rewards — Master Build Prompt (Cloudflare)

You are building a complete loyalty web application called **Fives Rewards** for **Fives Pub & Grill** in South Africa.

The application must be a **mobile-first React/Vite PWA** that can later be wrapped with **Capacitor** for iOS and Android.

Do not only explain what to build. Actually create the application in this repository. Create the frontend, Cloudflare Worker API, D1 schema/migrations, authentication, role-based authorization, R2 image handling, loyalty engine, tests and documentation.

Follow the root `CHECKLIST.md` as the execution plan. Update it only when items are genuinely complete. Keep the project runnable after every major phase. Do not skip security/backend work to rush into screens.

## 1. Product scope

There are four application roles but three user experiences:

- **Customer**
- **Staff / Waiter**
- **Admin**
- **Owner**

Admin and Owner share the same dashboard initially, but remain separate roles in the database and permission system.

The MVP launches around **coffee loyalty**, while the architecture must later support points, spend-based rewards, food rewards, birthday rewards, promotions, multiple locations, WhatsApp, POS integration, Apple/Google Wallet and Capacitor apps.

## 2. Required technology stack

Frontend:
- React
- Vite
- TypeScript with strict mode
- React Router
- Tailwind CSS
- TanStack Query
- React Hook Form
- Zod
- Lucide icons
- vite-plugin-pwa

Backend:
- Cloudflare Workers
- Hono

Database:
- Cloudflare D1
- Drizzle ORM
- Drizzle migrations / Drizzle Kit

Authentication:
- Better Auth with D1-backed persistence

Storage:
- Cloudflare R2

Cloudflare tooling:
- Wrangler
- Turnstile integration points where appropriate

Do **not** use Supabase, Firebase, PostgreSQL, Supabase Auth, Supabase RLS or Supabase Storage.

## 3. Architecture

The browser must never connect directly to D1.

Use:

```text
Customer / Staff / Admin UI
        ↓
React + Vite PWA
        ↓
Cloudflare Worker API
        ↓
Session validation
Role authorization
Zod validation
Business logic
Loyalty logic
        ↓
D1 + R2
```

Suggested API groups:

```text
/api/auth/*
/api/customer/*
/api/staff/*
/api/admin/*
```

Create reusable Worker middleware/guards such as:

- requireSession
- requireCustomer
- requireStaff
- requireAdmin
- requireOwner
- requireAdminOrOwner

Every protected route must validate session, active profile, role, business scope, location scope where relevant, and input data.

Never trust a role, customer id, reward status, balance or loyalty amount supplied by the frontend.

## 4. Role behaviour

### Customer

Customers can:
- register and log in
- receive a configurable welcome reward
- view coffee progress
- view available/redeemed/expired rewards
- view vouchers
- view transaction history
- generate a temporary loyalty QR and 6-digit code
- browse the menu
- view promotions
- manage profile/preferences
- log out
- request account deletion

Customers must never be able to award themselves stamps/points, issue rewards, redeem rewards directly, adjust history, or read another customer's data.

### Staff

Staff can:
- log into `/staff`
- scan a temporary customer QR
- enter a temporary 6-digit code
- resolve a customer securely
- view only the minimum loyalty information needed
- add a qualifying coffee purchase
- redeem free coffee rewards
- redeem vouchers
- record an optional bill/reference number

Staff cannot browse all customers, manage loyalty configuration, menu, promotions, staff roles or Admin pages.

### Admin / Owner

Admin/Owner can:
- view dashboard metrics
- manage customers
- manage staff
- configure loyalty programs
- configure reward definitions
- configure welcome rewards
- manage menu and images
- manage promotions and images
- view transactions
- perform authorised manual adjustments/reversals
- view reports
- manage settings
- view audit logs

Never destructively edit loyalty transaction history.

## 5. Transaction-ledger requirement

This is non-negotiable.

Do **not** make a field such as `coffee_count = 7` the source of truth.

All loyalty activity must use a transaction ledger.

Examples:

```text
transaction_type = earn
program = COFFEE
quantity = +1
```

Other transaction types:
- bonus
- redeem
- adjustment
- reversal

Coffee progress and future points balances must be derived from ledger data and issued rewards.

The model must later support stamp programs and points programs.

## 6. Money and time

Store all money as integer cents.

Examples:
- R50.00 = 5000
- R89.90 = 8990

Business currency: `ZAR`

Business timezone: `Africa/Johannesburg`

Use timezone-aware timestamps and display South African local time in the UI.

## 7. D1 schema

Use D1-compatible SQL. Do not write PostgreSQL-specific SQL.

Create Drizzle schemas/migrations for these tables.

### businesses
- id
- name
- slug
- currency
- timezone
- active
- created_at
- updated_at

Seed Fives Pub & Grill, ZAR, Africa/Johannesburg.

### locations
- id
- business_id
- name
- address
- active
- created_at
- updated_at

Keep multi-location support from day one.

### profiles
Link application profiles to Better Auth users.

Fields:
- id
- auth_user_id
- business_id
- full_name
- email
- mobile_number
- role
- birthday nullable
- avatar_url nullable
- marketing_opt_in
- notification_opt_in
- active
- created_at
- updated_at

Roles:
- customer
- staff
- admin
- owner

Public registration must always create `customer`; the client must never choose its own role.

### loyalty_programs
- id
- business_id
- name
- description
- program_type
- currency_code
- qualifying_purchases_required nullable
- reward_definition_id nullable
- active
- sort_order
- created_at
- updated_at

Program types:
- stamp
- points

### loyalty_transactions
- id
- business_id
- location_id
- customer_id
- staff_id nullable
- program_id
- transaction_type
- quantity
- spend_amount_cents nullable
- bill_reference nullable
- notes nullable
- reason nullable
- approved_by nullable
- idempotency_key
- created_at

Create appropriate indexes and uniqueness protection for idempotency.

### reward_definitions
- id
- business_id
- name
- description
- reward_type
- value_cents nullable
- points_cost nullable
- item_reference nullable
- valid_days nullable
- welcome_reward
- active
- terms nullable
- created_at
- updated_at

Reward types:
- free_item
- voucher
- discount
- points_reward

### customer_rewards
- id
- business_id
- customer_id
- reward_definition_id
- status
- issued_at
- expires_at nullable
- redeemed_at nullable
- redeemed_by nullable
- location_id nullable
- redemption_transaction_id nullable
- issuance_key nullable
- created_at

Statuses:
- available
- redeemed
- expired
- cancelled

Use issuance keys/unique constraints to prevent duplicate reward issuance.

### loyalty_codes
These are temporary loyalty-identification codes, not login OTPs.

- id
- business_id
- customer_id
- otp_hash
- qr_token_hash
- expires_at
- used_at nullable
- created_at

Requirements:
- secure server-side generation
- 6-digit numeric OTP
- secure random QR token
- default 10-minute validity
- hashed storage
- server-side expiry enforcement
- previous active code invalidated when a new one is generated where appropriate

### menu_categories
- id
- business_id
- name
- description nullable
- image_key nullable
- sort_order
- active
- created_at
- updated_at

### menu_items
- id
- business_id
- category_id
- name
- description
- price_cents
- image_key nullable
- active
- available
- popular
- vegetarian
- spicy
- sort_order
- created_at
- updated_at

### promotions
- id
- business_id
- title
- subtitle nullable
- description nullable
- image_key nullable
- start_at
- end_at
- active
- cta_text nullable
- cta_url nullable
- created_at
- updated_at

### audit_logs
- id
- business_id
- actor_user_id
- actor_role
- action
- entity_type
- entity_id nullable
- old_value_json nullable
- new_value_json nullable
- metadata_json nullable
- created_at

### app_settings
- id
- business_id
- key
- value_json
- updated_at

## 8. Authentication

Use Better Auth inside the Cloudflare Worker with D1-backed persistence.

Implement:
- registration
- login
- logout
- session retrieval
- protected API access
- customer profile creation
- safe role mapping

Do not expose auth secrets to the frontend.

## 9. Coffee loyalty MVP

Seed:

```text
Fives Coffee Rewards
program_type = stamp
currency_code = COFFEE
threshold = 10
reward = Free Coffee
active = true
```

The threshold must be configurable by Admin. Never hard-code 10 in UI/business logic.

When Staff records a qualifying coffee:
1. validate staff session and role
2. validate customer
3. validate program
4. create an earn transaction
5. apply idempotency protection
6. calculate total qualifying coffee progress
7. determine completed reward thresholds
8. issue any missing rewards exactly once
9. return updated progress and rewards

Examples for threshold 10:
- 7 purchases → 7/10
- 10 purchases → 1 Free Coffee issued, next-cycle progress 0/10
- 12 purchases → 1 reward issued, next-cycle progress 2/10
- 20 purchases → 2 total rewards issued

Customers may hold multiple unredeemed free-coffee rewards.

## 10. Welcome reward

Seed:

```text
Name: Welcome to Fives
Type: voucher
Value: R50.00
value_cents: 5000
Validity: 30 days
welcome_reward: true
active: true
```

On eligible customer registration:
- issue exactly once
- calculate expiry
- display immediately
- prevent repeated issuance through re-login/profile recreation

Admin can later disable it or change its value, validity and type.

## 11. Temporary Fives Code

Customer screen: **MY FIVES CODE**

Endpoint concept:

```text
POST /api/customer/loyalty-code
```

Worker must generate:
- secure QR token
- secure 6-digit numeric OTP
- expiry timestamp

Store secure hashes, not plain permanent secrets.

Customer sees:

```text
[QR CODE]

485 921

Expires in 09:42
```

Text:

> Show this QR code to your waiter or give them the 6-digit code.

Allow `Generate New Code`.

Do not use a permanent customer QR as the primary loyalty transaction token.

## 12. Staff code resolution

Staff submits either QR token or OTP.

Worker validates:
- valid staff session
- active staff profile
- valid token/code
- not expired
- customer active
- correct business scope

Return minimum information:
- customer name
- coffee progress
- available free coffees
- available vouchers

Do not return unnecessary profile data.

## 13. Reward redemption

Redemption must be server-side and protected against double redemption.

Requirements:
- staff auth required
- reward belongs to customer
- status is available
- not expired
- transaction-safe update
- create redemption ledger transaction
- mark customer reward redeemed
- save redeemed_at
- save redeemed_by
- save location
- save optional bill reference
- prevent duplicate/retry/race-condition redemption

Frontend cannot set reward status directly.

## 14. Admin adjustments

Admin/Owner may make controlled loyalty adjustments.

Require:
- customer
- program
- amount/quantity
- reason
- confirmation

Create adjustment or reversal transaction. Never overwrite old ledger records. Create audit log.

## 15. Customer UI

Use mobile-first bottom navigation:

- Home
- Rewards
- **Fives Code** as prominent centre action
- Menu
- Profile

### Home
Show:
- greeting
- Fives Rewards branding
- coffee progress
- visual stamp/progress indicator
- remaining-coffees text
- reward-ready message
- Show My Fives Code CTA
- available rewards preview
- active promotion
- menu shortcut

### Rewards
Sections:
- Coffee Rewards
- Available Rewards
- Vouchers
- Redeemed
- Expired
- Transaction History

Prepare future Points UI but hide it unless a points program is active.

### Fives Code
- QR
- 6-digit code formatted XXX XXX
- countdown
- expired state
- generate/regenerate action

### Menu
- category navigation
- search
- image
- name
- description
- price
- popular badge
- vegetarian badge
- spicy badge
- unavailable/sold-out state

Do not build ordering or payment.

### Profile
- name
- email
- mobile
- birthday
- marketing preference
- notification preference
- edit profile
- reward history
- terms
- privacy
- logout
- request account deletion

## 16. Staff UI

Route: `/staff`

Optimise for a low-cost Android phone/tablet behind the bar.

Home:
- SCAN CUSTOMER QR
- ENTER CUSTOMER CODE

Resolved customer view:
- customer name
- coffee progress
- available free coffees
- available vouchers

Actions:
- ADD COFFEE
- REDEEM FREE COFFEE
- REDEEM VOUCHER

Use confirmation dialogs and clear success/error states.

## 17. QR scanning

Use a well-supported browser QR scanner library.

Put scanner behaviour behind a service abstraction so it can later be replaced by a Capacitor/native barcode scanner.

Always provide manual code entry as fallback.

## 18. Admin UI

Route: `/admin`

Sidebar:
- Dashboard
- Customers
- Loyalty
- Rewards
- Transactions
- Menu
- Promotions
- Staff
- Reports
- Settings
- Audit Log

Dashboard metrics:
- Total Members
- Active Members
- New Members This Month
- Coffees Purchased
- Free Coffees Issued
- Free Coffees Redeemed
- Outstanding Rewards
- Redemption Rate

Charts:
- New Members Over Time
- Coffee Purchases Over Time
- Rewards Earned vs Redeemed

Add date range/location filters where appropriate.

## 19. Customers admin

Search by:
- name
- email
- mobile
- membership/reference

Customer detail:
- profile
- join date
- coffee progress
- rewards
- transaction history
- redemption history
- manual adjustment

## 20. Loyalty admin

Admin can:
- list programs
- activate/deactivate
- change coffee threshold
- change associated reward
- configure expiry
- configure location applicability
- prepare future points settings

## 21. Reward admin

CRUD reward definitions.

Include:
- name
- description
- type
- value
- points cost
- validity
- welcome reward flag
- active
- terms

## 22. Transactions admin

Filters:
- customer
- staff
- date
- program
- type
- location
- bill reference

No destructive deletion.

## 23. Menu + R2

Admin can manage categories and items.

R2 stores:
- menu item images
- menu category images
- promotion images
- business logo

Do not expose unrestricted R2 writes.

Uploads go through authorised Worker endpoints or an appropriate secure signed flow.

Store R2 object keys in D1 rather than temporary URLs.

Validate file size and content type.

## 24. Promotions

Admin can manage:
- image
- title
- subtitle
- description
- start/end date
- CTA
- active state

Customer Home only shows promotions that are active, started and not expired.

## 25. Staff management

Admin/Owner can:
- list staff
- create/invite staff
- assign location
- activate/deactivate
- view roles
- safely change permitted roles

Never expose passwords.

Protect role elevation. Owner-specific permissions may be stricter than Admin.

## 26. Audit log

Track sensitive actions including:
- manual loyalty adjustments
- reversals
- role changes
- loyalty-threshold changes
- reward configuration changes
- welcome-voucher changes
- promotion changes

Admin should see timestamp, actor, role, action, entity, before/after and metadata.

## 27. WhatsApp-ready architecture

Do **not** integrate real WhatsApp yet.

Create `NotificationProvider` abstraction with methods such as:
- sendLoyaltyCode()
- sendWelcomeReward()
- sendRewardUnlocked()

Create a development provider that logs/mocks sends.

Future behaviour:
- Worker generates loyalty code
- same code is shown in app
- same code is sent through Meta WhatsApp API
- WhatsApp failure does not prevent in-app display

Future secrets belong in Cloudflare Worker Secrets, never frontend env vars.

## 28. POS-ready architecture

Do **not** integrate the real Fives POS yet.

Create a `POSProvider` interface with future methods such as:
- linkCustomerToBill()
- getBill()
- awardFromClosedBill()
- applyVoucher()
- validateBillReference()

Create `ManualPOSProvider` for MVP.

For now Staff manually records qualifying coffee purchases and may enter an optional bill reference.

Do not fabricate a POS API.

## 29. Future points wallet

Keep architecture ready for `FIVES_POINTS`.

Future support:
- points balance
- points earning
- points spending
- bonus points
- spend-based earning
- expiring points

Do not hard-code R1 = 1 point. Future rates must be configurable.

## 30. PWA

Configure vite-plugin-pwa.

Manifest:
- name: Fives Rewards
- short name: Fives
- display: standalone

Cache safe content such as app shell/static assets/menu reads where sensible.

Do **not** queue/replay sensitive mutations offline.

When offline, block:
- loyalty-code generation
- add coffee
- reward redemption
- admin adjustment

Show a clear internet-required message.

## 31. Capacitor readiness

Do not install Capacitor yet.

Abstract platform-specific behaviour:
- QR/camera
- notifications
- storage where relevant
- sharing
- future geolocation

The same Cloudflare Worker API must later serve Web, iOS and Android clients.

## 32. Turnstile readiness

Prepare Turnstile integration points for public abuse-sensitive flows such as registration/recovery.

Do not block local MVP work if keys are unavailable.

## 33. Design direction

Do not copy Bossa Rewards branding.

Create an original premium Fives Pub & Grill feel:
- near-black / charcoal
- copper / amber / warm gold
- warm off-white surfaces
- bold headings
- rounded cards
- subtle shadows
- large touch targets
- clean modern typography

Use theme variables rather than scattered hard-coded colours.

Create reusable components such as:
- Button
- Card
- Badge
- Modal
- ConfirmDialog
- Input
- Select
- TextArea
- PageHeader
- BottomNavigation
- AdminSidebar
- LoadingState
- Skeleton
- EmptyState
- ErrorState
- RewardCard
- CoffeeProgress
- PromoCard
- MenuItemCard
- QRDisplay
- CountdownTimer
- StatCard
- DataTable

## 34. Error handling

Handle explicitly:
- session expired
- offline
- invalid OTP
- expired OTP
- invalid QR
- inactive customer
- inactive staff
- expired reward
- already redeemed reward
- duplicate transaction
- R2 upload failure
- unauthorised route
- missing configuration
- API failure

Use friendly UI messages and sensible server logging.

## 35. Testing

At minimum test:
- customer cannot award own coffee
- customer cannot redeem directly
- customer cannot read another customer
- staff can add valid coffee
- staff cannot access Admin
- invalid OTP rejected
- expired OTP rejected
- valid QR resolves customer
- threshold issues reward
- reward is not issued twice
- multiple reward cycles work
- reward cannot be redeemed twice
- welcome voucher issued once
- admin adjustment creates audit log
- reversal works
- client role escalation blocked
- idempotency blocks duplicate requests

Integration-test the full MVP journey.

## 36. Seed data

Development seed:

Business:
- Fives Pub & Grill

Location:
- Fives Main Branch

Menu categories:
- Breakfast
- Burgers
- Pizza
- Grills
- Light Meals
- Coffee
- Drinks
- Desserts

Add a few clearly marked placeholder menu items.

Seed:
- Fives Coffee Rewards
- Free Coffee reward
- R50 Welcome Voucher
- Example Wednesday Burger Special

Document how to create Owner, Admin, Staff and Customer test users.

Never commit real credentials.

## 37. Environment and bindings

Create `.env.example` for frontend-safe values only, such as:

```text
VITE_API_BASE_URL=
VITE_TURNSTILE_SITE_KEY=
```

Configure Worker bindings for:
- D1 database
- R2 bucket

Document Worker secrets such as:
- BETTER_AUTH_SECRET
- TURNSTILE_SECRET_KEY
- future WHATSAPP_ACCESS_TOKEN
- future WHATSAPP_PHONE_NUMBER_ID

Never expose Worker secrets to the browser.

## 38. Suggested structure

```text
src/
  components/
  features/
  hooks/
  layouts/
  lib/
  pages/
  providers/
  routes/
  services/
  types/
  utils/

worker/
  routes/
    auth/
    customer/
    staff/
    admin/
  middleware/
  services/
    loyalty/
    rewards/
    auth/
    notifications/
    pos/
    storage/
  db/
    schema/
    migrations/
    queries/
  types/
  utils/

drizzle/
wrangler.toml
drizzle.config.ts
```

Adapt sensibly if needed, but keep frontend/backend concerns cleanly separated.

## 39. Implementation order

### Phase 1 — Foundation
- inspect repository
- scaffold React/Vite if empty
- configure TypeScript/Tailwind/Router/Query
- create Worker/Hono API
- configure Wrangler
- configure PWA
- create theme/base components
- create env example and README
- run typecheck/build

### Phase 2 — D1 & Drizzle
- schema
- migrations
- indexes
- constraints
- seed data
- local migration test

### Phase 3 — Better Auth
- D1-backed auth
- registration/login/logout/session
- profiles
- roles
- role routing

### Phase 4 — API security
- session middleware
- role middleware
- business/location scoping
- Zod validation
- 401/403 tests

### Phase 5 — Customer shell
- Home
- Rewards
- Fives Code
- Menu
- Profile

### Phase 6 — Loyalty-code service
- OTP
- QR
- hashing
- expiry
- regeneration
- staff resolution

### Phase 7 — Staff app
- scanner
- manual OTP
- customer summary
- add coffee
- redeem reward/voucher

### Phase 8 — Reward engine
- ledger progress
- threshold
- free coffee issuance
- welcome voucher
- idempotency
- redemption
- adjustments/reversals

### Phase 9 — Menu/R2
- customer menu
- admin CRUD
- image upload

### Phase 10 — Promotions
- admin CRUD
- image upload
- scheduling
- customer banner

### Phase 11 — Admin
- dashboard
- customers
- loyalty
- rewards
- transactions
- menu
- promotions
- staff
- reports
- settings
- audit

### Phase 12 — PWA/Capacitor readiness
- installability
- safe caching
- offline blocks
- platform abstractions

### Phase 13 — Testing/hardening
- unit tests
- integration tests
- security tests
- race/double-submit review
- typecheck
- lint
- production build

## 40. MVP definition of done

The MVP is complete only when this full journey works:

```text
Customer registers
↓
Profile created
↓
R50 welcome voucher issued exactly once
↓
Customer views coffee progress
↓
Customer generates temporary QR + OTP
↓
Staff logs in
↓
Staff scans QR or enters OTP
↓
Customer resolves securely
↓
Staff records qualifying coffee
↓
Ledger transaction persists
↓
Customer sees updated progress
↓
Threshold reached
↓
Free Coffee reward issued exactly once
↓
Staff resolves customer again
↓
Staff redeems reward
↓
Reward is redeemed exactly once
↓
Admin can trace earn → issue → redeem → staff → location → timestamp
```

Admin must also be able to change the coffee threshold, change welcome reward settings, manage the menu and manage promotions.

The PWA must install and work in standalone mode.

## 41. Out of scope for MVP

Do not build yet:
- online food ordering
- online payments
- delivery
- table bookings
- real POS integration
- live WhatsApp integration
- Apple Wallet
- Google Wallet
- native push notifications
- VIP tiers
- loyalty challenges
- referrals
- advanced CRM campaigns
- geofencing

Prepare architecture only.

## 42. AI agent behaviour

Before every major phase:
1. briefly state what will change
2. implement it
3. run relevant tests/typecheck/build
4. fix failures
5. update `CHECKLIST.md`
6. report progress

Use this progress format:

```text
PHASE COMPLETED:
...

FILES CREATED:
- ...

FILES CHANGED:
- ...

DATABASE CHANGES:
- ...

API CHANGES:
- ...

WHAT NOW WORKS:
- ...

TESTS RUN:
- ...

BUILD STATUS:
PASS / FAIL

KNOWN ISSUES:
- ...

NEXT PHASE:
...
```

Do not mark a phase complete while the build is broken, TypeScript errors remain, security requirements are missing, or server logic has been replaced by insecure client-side code.

## 43. Start now

Start by:
1. inspecting the repository
2. reading `CHECKLIST.md`
3. implementing **Phase 1 only**
4. running typecheck/build
5. updating the checklist
6. reporting progress
7. then proceeding to Phase 2 only after Phase 1 passes

Do not skip directly to visual screens before the Cloudflare Worker, D1 and security architecture are correctly established.
