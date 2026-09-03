# Fives Rewards MVP — Cloudflare Build Checklist

> **AI AGENT EXECUTION CHECKLIST**
>
> Stack: **React + Vite + TypeScript + Cloudflare Workers + Hono + D1 + Drizzle + Better Auth + R2**
>
> Future native wrapper: **Capacitor**
>
> Roles: **Customer / Staff / Admin / Owner**
>
> Primary MVP mechanic: **Coffee Rewards**

---

# 0. Agent rules

- [x] Inspect repository before changing code.
- [x] Read the master prompt and this checklist.
- [x] Preserve useful existing work.
- [x] Keep project buildable after every phase.
- [x] Run typecheck/build after major changes.
- [x] Fix failures before progressing.
- [x] Never fabricate credentials or APIs.
- [x] Never expose secrets to the browser.
- [x] Never expose D1 directly to the browser.
- [x] Do not use Supabase.
- [x] Do not use PostgreSQL-specific SQL.
- [x] Do not use `coffee_count` as source of truth.
- [x] Do not allow customer-controlled loyalty mutations.
- [x] Do not destructively edit transaction history.
- [x] Do not build out-of-scope features.

---

# 1. Stack

## Frontend
- [x] React
- [x] Vite
- [x] TypeScript strict
- [x] React Router
- [x] Tailwind
- [x] TanStack Query
- [x] React Hook Form
- [x] Zod
- [x] Lucide
- [x] vite-plugin-pwa

## Backend
- [x] Cloudflare Worker
- [x] Hono
- [x] Wrangler

## Data/Auth/Storage
- [x] Cloudflare D1
- [x] Drizzle ORM
- [x] Drizzle migrations
- [x] Better Auth
- [x] D1-backed sessions/auth
- [x] Cloudflare R2
- [ ] Turnstile integration points

---

# 2. Phase 1 — Foundation

## Repository
- [x] Repo inspected.
- [x] Existing files understood.
- [x] No useful work overwritten.

## Frontend
- [x] React/Vite app scaffolded if needed.
- [x] TypeScript strict mode enabled.
- [x] Tailwind configured.
- [x] React Router configured.
- [x] TanStack Query configured.
- [x] React Hook Form installed.
- [x] Zod installed.
- [x] Lucide installed.

## Worker
- [x] Cloudflare Worker created.
- [x] Hono configured.
- [x] `/api/health` works.
- [x] Standard API response/error shape created.
- [x] Environment bindings typed.

## Config
- [x] Wrangler config created.
- [x] D1 binding placeholder/config created.
- [x] R2 binding placeholder/config created.
- [x] Drizzle config created.
- [x] `.env.example` created.
- [x] `.gitignore` correct.
- [x] README updated.

## PWA
- [x] vite-plugin-pwa configured.
- [x] Manifest name = Fives Rewards.
- [x] Short name = Fives.
- [x] display = standalone.
- [x] Placeholder icons added.

### Gate 1
- [x] Frontend starts.
- [x] Worker starts.
- [x] Health endpoint responds.
- [x] Typecheck passes.
- [x] Production build passes.

---

# 3. Design system

## Theme
- [x] Premium pub/grill direction.
- [x] Charcoal/near-black.
- [x] Warm copper/amber/gold.
- [ ] Warm off-white surfaces. *(dark-first surfaces for Customer/Staff; light Admin surfaces land in Phase 11)*
- [x] Strong headings.
- [x] Rounded cards.
- [x] Large touch targets.

## Theme variables
- [x] `--brand-primary`
- [x] `--brand-secondary`
- [x] `--brand-background`
- [x] `--brand-surface`
- [x] `--brand-text`
- [x] `--brand-muted`
- [x] `--brand-success`
- [x] `--brand-danger`

## Shared components
- [x] Button
- [x] Card
- [x] Badge
- [ ] Modal
- [ ] ConfirmDialog
- [x] Input
- [ ] Select
- [ ] TextArea
- [x] PageHeader
- [ ] BottomNavigation
- [ ] AdminSidebar
- [x] LoadingState
- [ ] Skeleton
- [x] EmptyState
- [x] ErrorState
- [ ] RewardCard
- [ ] CoffeeProgress
- [ ] PromoCard
- [ ] MenuItemCard
- [ ] QRDisplay
- [ ] CountdownTimer
- [ ] StatCard
- [ ] DataTable

---

# 4. Phase 2 — D1 & Drizzle

## businesses
- [x] Table created.
- [x] name/slug/currency/timezone/active/timestamps.
- [x] Seed Fives Pub & Grill.
- [x] Currency ZAR.
- [x] Timezone Africa/Johannesburg.

## locations
- [x] Table created.
- [x] Business FK.
- [x] Name/address/active/timestamps.
- [x] Seed Fives Main Branch.

## profiles
- [x] Table created.
- [x] Better Auth user link.
- [x] business_id.
- [x] full_name.
- [x] email.
- [x] mobile_number.
- [x] role.
- [x] birthday.
- [x] avatar_url.
- [x] marketing_opt_in.
- [x] notification_opt_in.
- [x] active.
- [x] timestamps.

Roles:
- [x] customer
- [x] staff
- [x] admin
- [x] owner

## loyalty_programs
- [x] Table created.
- [x] Supports stamp.
- [x] Supports points.
- [x] Configurable threshold.
- [x] Configurable reward.
- [x] Active/sort/timestamps.

## loyalty_transactions
- [x] Table created.
- [x] business_id.
- [x] location_id.
- [x] customer_id.
- [x] staff_id.
- [x] program_id.
- [x] transaction_type.
- [x] quantity.
- [x] spend_amount_cents.
- [x] bill_reference.
- [x] notes.
- [x] reason.
- [x] approved_by.
- [x] idempotency_key.
- [x] created_at.

Types:
- [x] earn
- [x] bonus
- [x] redeem
- [x] adjustment
- [x] reversal

Indexes:
- [x] customer
- [x] program
- [x] staff
- [x] location
- [x] date
- [x] idempotency

## reward_definitions
- [x] Table created.
- [x] free_item.
- [x] voucher.
- [x] discount.
- [x] points_reward.
- [x] value cents.
- [x] points cost.
- [x] validity.
- [x] welcome flag.
- [x] terms.

## customer_rewards
- [x] Table created.
- [x] available.
- [x] redeemed.
- [x] expired.
- [x] cancelled.
- [x] issuance key.
- [x] redemption transaction.
- [x] timestamps.

## loyalty_codes
- [x] Table created.
- [x] OTP hash.
- [x] QR hash.
- [x] expiry.
- [x] used_at.
- [x] indexes.

## menu_categories
- [x] Table created.
- [x] image key.
- [x] sort order.
- [x] active.

## menu_items
- [x] Table created.
- [x] price stored cents.
- [x] image key.
- [x] active/available.
- [x] popular/vegetarian/spicy.
- [x] sort order.

## promotions
- [x] Table created.
- [x] image key.
- [x] start/end.
- [x] active.
- [x] CTA.

## audit_logs
- [x] Table created.
- [x] actor/role/action/entity.
- [x] before/after JSON.
- [x] metadata JSON.

## app_settings
- [x] Table created.
- [x] business/key/value_json.

### Gate 2
- [x] D1 migrations run locally.
- [x] Seed succeeds.
- [x] Required indexes exist.
- [x] No PostgreSQL-specific SQL.

---

# 5. Phase 3 — Better Auth

- [x] Better Auth integrated into Worker.
- [x] D1 persistence configured.
- [x] Secure sessions work.
- [x] Registration works.
- [x] Login works.
- [x] Logout works.
- [x] Session retrieval works.
- [x] Fives profile links to auth user.
- [x] Public registration always creates customer.
- [x] Client cannot select its own role.
- [x] Inactive users blocked.

Role routing:
- [x] Customer → `/app`
- [x] Staff → `/staff`
- [x] Admin → `/admin`
- [x] Owner → `/admin`

### Gate 3
- [x] Customer auth tested.
- [x] Staff auth tested.
- [x] Admin auth tested.
- [x] Owner auth tested.
- [x] Invalid session rejected.

---

# 6. Phase 4 — API authorization

Reusable middleware:
- [x] requireSession
- [x] requireCustomer
- [x] requireStaff
- [x] requireAdmin
- [x] requireOwner
- [x] requireAdminOrOwner

Every protected endpoint:
- [x] Session checked.
- [x] Profile checked.
- [x] Active status checked.
- [x] Role checked.
- [x] Business scope checked.
- [x] Location scope checked when relevant.
- [x] Zod input validation.

### Security Gate
- [x] Customer cannot access Staff API.
- [x] Customer cannot access Admin API.
- [x] Staff cannot access Admin API.
- [x] Staff cannot browse all customers.
- [x] Client-supplied role ignored.
- [x] Browser cannot access D1 directly.

---

# 7. Loyalty ledger

- [x] No `coffee_count` source-of-truth field.
- [ ] Every earn creates ledger transaction.
- [ ] Bonus creates ledger transaction.
- [ ] Redemption creates ledger transaction.
- [ ] Adjustment creates ledger transaction.
- [ ] Reversal creates ledger transaction.
- [x] Coffee progress derived from ledger.
- [x] Idempotency protection implemented.

---

# 8. Coffee program

Seed:
- [x] Fives Coffee Rewards.
- [x] type = stamp.
- [x] currency code = COFFEE.
- [x] threshold = 10.
- [x] reward = Free Coffee.
- [x] active.

Rules:
- [x] Threshold comes from DB.
- [x] No hard-coded 10 in UI/business logic.
- [ ] Reward issuance uses unique issuance key.
- [ ] Multiple reward cycles supported.
- [ ] Multiple unredeemed free coffees supported.

Tests:
- [ ] 7 purchases → 7/10.
- [ ] 10 purchases → reward issued.
- [ ] 12 purchases → next-cycle 2/10.
- [ ] 20 purchases → two total rewards.

---

# 9. Welcome voucher

Seed:
- [x] Welcome to Fives.
- [x] voucher.
- [x] value = 5000 cents.
- [x] validity = 30 days.
- [x] welcome flag true.
- [x] active true.

Registration:
- [x] Issued automatically.
- [x] Issued once only.
- [x] Expiry correct.
- [x] Visible immediately.
- [ ] Admin can disable/change later.

---

# 10. Phase 5 — Customer shell

Navigation:
- [x] Home
- [x] Rewards
- [x] Fives Code
- [x] Menu
- [x] Profile
- [x] Fives Code visually prominent.

Home:
- [x] Greeting.
- [x] Coffee progress.
- [x] Visual progress/stamps.
- [x] Remaining coffees text.
- [x] Reward-ready state.
- [x] Show Fives Code CTA.
- [x] Available rewards preview.
- [x] Active promotion.
- [x] Menu shortcut.

Rewards:
- [x] Coffee Rewards.
- [x] Available Rewards.
- [ ] Vouchers.
- [x] Redeemed.
- [x] Expired.
- [x] Transaction History.
- [x] Future points hidden unless active.

Menu:
- [x] Categories.
- [x] Search.
- [ ] Images.
- [x] Name/description/price.
- [x] Popular badge.
- [x] Vegetarian badge.
- [x] Spicy badge.
- [x] Sold-out/unavailable state.
- [x] No ordering/payment.

Profile:
- [x] Name.
- [x] Email.
- [x] Mobile.
- [x] Birthday.
- [x] Marketing preference.
- [x] Notification preference.
- [x] Edit profile.
- [x] Terms/privacy.
- [x] Logout.
- [x] Account deletion request.

### Gate 5
- [x] Mobile navigation works.
- [x] Customer routes protected.
- [x] No loyalty mutation exposed to Customer UI.

---

# 11. Phase 6 — Loyalty code service

Generation:
- [x] Customer auth required.
- [x] Secure 6-digit OTP server-generated.
- [x] Secure random QR token server-generated.
- [x] Hashed values stored.
- [x] Default 10-minute expiry.
- [x] Previous active code invalidated where appropriate.
- [x] Raw display values returned only at generation.

Customer UI:
- [x] QR displayed.
- [x] OTP displayed XXX XXX.
- [x] Countdown.
- [x] Expired state.
- [x] Generate New Code.

Staff resolution:
- [x] Staff auth required.
- [x] OTP validated server-side.
- [x] QR validated server-side.
- [x] Expired rejected.
- [x] Invalid rejected.
- [x] Inactive customer rejected.
- [x] Wrong business rejected.
- [x] Minimum customer data returned.

### Gate 6
- [x] Valid OTP resolves.
- [x] Valid QR resolves.
- [x] Expired fails.
- [x] Invalid fails.
- [x] Old regenerated code fails.

---

# 12. Phase 7 — Staff app

Route:
- [x] `/staff`

Home:
- [x] Scan Customer QR.
- [x] Enter Customer Code.

Scanner:
- [x] Browser scanner works.
- [x] Camera permission handled.
- [x] Scanner behind service abstraction.
- [x] Manual fallback.

Manual code:
- [x] Six-digit input.
- [x] Numeric keyboard.
- [x] Errors clear.

Resolved customer:
- [x] Customer name.
- [x] Coffee progress.
- [x] Available free coffees.
- [x] Available vouchers.

Actions:
- [x] Add Coffee.
- [x] Redeem Free Coffee.
- [x] Redeem Voucher.

Add coffee:
- [x] Default quantity 1.
- [x] Optional bill reference.
- [x] Confirmation dialog.
- [x] Button disabled while processing.
- [x] Idempotency key.
- [x] Success state.
- [x] Updated progress returned.
- [x] New reward shown immediately.

Redemption:
- [x] Confirmation dialog.
- [x] Atomic backend operation.
- [x] Duplicate redemption impossible.
- [x] Staff saved.
- [x] Location saved.
- [x] Timestamp saved.
- [x] Optional bill reference saved.

### Gate 7
- [ ] QR flow works end-to-end.
- [x] OTP flow works end-to-end.
- [x] Earn works.
- [x] Redeem works.
- [x] Staff cannot access Admin.

---

# 13. Phase 8 — Reward engine

Coffee issuance:
- [x] Progress correct.
- [x] DB threshold used.
- [x] Completed thresholds detected.
- [x] Duplicate issuance blocked.
- [x] Multiple cycles supported.

Welcome reward:
- [x] Once-only issuance protection.

Expiry:
- [x] Expired rewards recognised.
- [x] Expired rewards not redeemable.

Redemption:
- [x] Reward belongs to customer.
- [x] Must be available.
- [x] Must not be expired.
- [x] Atomic/idempotent logic.
- [x] Redemption transaction created.
- [x] redeemed_at set.
- [x] redeemed_by set.
- [x] location set.

Adjustments:
- [x] Admin-only.
- [x] Reason required.
- [x] Adjustment/reversal transaction.
- [x] Audit log.
- [x] Historical transactions never overwritten.

### Gate 8
- [x] Duplicate reward issuance test passes.
- [x] Duplicate redemption test passes.
- [x] Multi-cycle test passes.
- [x] Welcome reward once-only test passes.

---

# 14. Phase 9 — Menu + R2

R2:
- [ ] Bucket binding configured.
- [ ] Authorised upload endpoint.
- [ ] Object keys stored in D1.
- [ ] Secure retrieval strategy.
- [ ] File type validation.
- [ ] File size validation.
- [ ] Replace/delete handled safely.

Admin categories:
- [ ] Create.
- [ ] Edit.
- [ ] Activate/deactivate.
- [ ] Sort.

Admin items:
- [ ] Name.
- [ ] Description.
- [ ] Price cents.
- [ ] Category.
- [ ] Image.
- [ ] Available.
- [ ] Active.
- [ ] Popular.
- [ ] Vegetarian.
- [ ] Spicy.
- [ ] Sort order.

### Gate 9
- [ ] Admin menu changes appear in Customer Menu.
- [ ] Sold-out state works.
- [ ] R2 uploads protected.

---

# 15. Phase 10 — Promotions

Admin:
- [ ] Create.
- [ ] Edit.
- [ ] Deactivate/delete safely.
- [ ] Image.
- [ ] Title.
- [ ] Subtitle.
- [ ] Description.
- [ ] Start/end.
- [ ] CTA.
- [ ] Active.

Customer:
- [ ] Future promotion hidden.
- [ ] Current promotion shown.
- [ ] Expired promotion hidden.

### Gate 10
- [ ] Promotion timing logic tested.

---

# 16. Phase 11 — Admin app

Route:
- [ ] `/admin`

Sidebar:
- [ ] Dashboard
- [ ] Customers
- [ ] Loyalty
- [ ] Rewards
- [ ] Transactions
- [ ] Menu
- [ ] Promotions
- [ ] Staff
- [ ] Reports
- [ ] Settings
- [ ] Audit Log

Dashboard cards:
- [ ] Total Members
- [ ] Active Members
- [ ] New Members This Month
- [ ] Coffees Purchased
- [ ] Free Coffees Issued
- [ ] Free Coffees Redeemed
- [ ] Outstanding Rewards
- [ ] Redemption Rate

Charts:
- [ ] New members over time.
- [ ] Coffee purchases over time.
- [ ] Rewards earned vs redeemed.

Customers:
- [ ] Search name.
- [ ] Search email.
- [ ] Search mobile.
- [ ] Search reference.
- [ ] Pagination.
- [ ] Detail view.
- [ ] Coffee progress.
- [ ] Rewards.
- [ ] Transactions.
- [ ] Redemptions.
- [ ] Manual adjustment.

Loyalty:
- [ ] View programs.
- [ ] Activate/deactivate.
- [ ] Edit coffee threshold.
- [ ] Edit reward.
- [ ] Edit expiry.
- [ ] Location applicability.
- [ ] Future points fields ready.

Rewards:
- [ ] CRUD reward definitions.
- [ ] Welcome flag.
- [ ] Values in cents.
- [ ] Validity.
- [ ] Terms.

Transactions:
- [ ] Filter customer.
- [ ] Filter staff.
- [ ] Filter date.
- [ ] Filter program.
- [ ] Filter type.
- [ ] Filter location.
- [ ] Filter bill reference.
- [ ] No destructive delete.

Staff management:
- [ ] List staff.
- [ ] Create/invite.
- [ ] Assign location.
- [ ] Activate/deactivate.
- [ ] Safe role changes.
- [ ] Role elevation protected.

Audit:
- [ ] Timestamp.
- [ ] Actor.
- [ ] Role.
- [ ] Action.
- [ ] Entity.
- [ ] Before/after.
- [ ] Metadata.
- [ ] Filters.

### Gate 11
Admin can trace:

```text
Customer
→ Coffee Earn
→ Reward Issued
→ Reward Redeemed
→ Staff
→ Location
→ Date/Time
```

---

# 17. Notification abstraction

Do not integrate live WhatsApp.

- [ ] `NotificationProvider` created.
- [ ] Development/mock implementation.
- [ ] `sendLoyaltyCode`.
- [ ] `sendWelcomeReward`.
- [ ] `sendRewardUnlocked`.
- [ ] Future WhatsApp flow documented.
- [ ] WhatsApp failure will not block in-app code.
- [ ] Future secrets use Worker Secrets.

---

# 18. POS abstraction

Do not integrate real POS.

- [ ] `POSProvider` created.
- [ ] `ManualPOSProvider` created.
- [ ] `linkCustomerToBill` interface prepared.
- [ ] `getBill` prepared.
- [ ] `awardFromClosedBill` prepared.
- [ ] `applyVoucher` prepared.
- [ ] `validateBillReference` prepared.
- [ ] MVP manually adds coffee.
- [ ] Optional bill reference supported.
- [ ] No fabricated POS API.

---

# 19. Points readiness

- [ ] Program type supports points.
- [ ] `FIVES_POINTS` possible.
- [ ] Points balance design prepared.
- [ ] Points UI hidden when inactive.
- [ ] No hard-coded R1 = 1 point.
- [ ] Future rate configurable.

---

# 20. Phase 12 — PWA / Capacitor readiness

PWA:
- [ ] Manifest complete.
- [ ] Icons complete enough for MVP.
- [ ] Install works.
- [ ] Standalone navigation works.

Safe cache:
- [ ] App shell.
- [ ] Static assets.
- [ ] Menu reads where appropriate.

Never offline-replay:
- [ ] Loyalty code generation.
- [ ] Add coffee.
- [ ] Reward redemption.
- [ ] Admin adjustment.

Offline UX:
- [ ] Clear internet-required messages.

Capacitor readiness:
- [ ] Scanner behind abstraction.
- [ ] Notifications behind abstraction.
- [ ] Storage abstracted where needed.
- [ ] Backend independent from browser shell.
- [ ] No critical browser-only assumptions.

### Gate 12
- [ ] Installed PWA works.
- [ ] Sensitive mutations require connectivity.

---

# 21. Turnstile readiness

- [ ] Integration component/service prepared.
- [ ] Registration hook point.
- [ ] Frontend site-key placeholder.
- [ ] Worker secret placeholder.
- [ ] Local development works without keys.

---

# 22. Accessibility

- [ ] Proper form labels.
- [ ] Focus states.
- [ ] Keyboard access.
- [ ] Good contrast.
- [ ] Large touch targets.
- [ ] Clear validation.
- [ ] Icons not sole meaning.
- [ ] Confirmations for sensitive actions.

---

# 23. Error handling

- [ ] Session expired.
- [ ] Offline.
- [ ] Invalid OTP.
- [ ] Expired OTP.
- [ ] Invalid QR.
- [ ] Customer inactive.
- [ ] Staff inactive.
- [ ] Reward expired.
- [ ] Already redeemed.
- [ ] Duplicate request.
- [ ] R2 upload failure.
- [ ] API failure.
- [ ] Forbidden route.
- [ ] Missing configuration.

---

# 24. Performance

- [ ] TanStack Query caching.
- [ ] Targeted invalidation.
- [ ] Admin pagination.
- [ ] Indexed DB queries.
- [ ] Heavy Admin pages lazy-loaded.
- [ ] Images optimised.
- [ ] No N+1 patterns.
- [ ] No full transaction-history fetches without pagination.

---

# 25. Development seed data

- [ ] Fives Pub & Grill.
- [ ] Fives Main Branch.

Categories:
- [ ] Breakfast
- [ ] Burgers
- [ ] Pizza
- [ ] Grills
- [ ] Light Meals
- [ ] Coffee
- [ ] Drinks
- [ ] Desserts

Demo content:
- [ ] Placeholder menu items.
- [ ] Fives Coffee Rewards.
- [ ] Free Coffee reward.
- [ ] R50 Welcome Voucher.
- [ ] Wednesday Burger Special.

Test-user setup documented:
- [ ] Owner
- [ ] Admin
- [ ] Staff
- [ ] Customer
- [ ] No real credentials committed.

---

# 26. Phase 13 — Testing & hardening

Security:
- [ ] Customer cannot call earn endpoint.
- [ ] Customer cannot call redeem endpoint directly.
- [ ] Customer cannot access other customer data.
- [ ] Staff cannot access Admin.
- [ ] Inactive user rejected.
- [ ] Unauthenticated user rejected.
- [ ] Client role escalation blocked.

Loyalty:
- [ ] Staff can add coffee.
- [ ] Idempotency prevents duplicate earn.
- [ ] Threshold issues reward.
- [ ] Reward not issued twice.
- [ ] Multiple cycles work.
- [ ] Welcome reward once only.
- [ ] Expired reward rejected.
- [ ] Double redemption blocked.
- [ ] Adjustment audited.
- [ ] Reversal works.

Codes:
- [ ] Valid OTP.
- [ ] Invalid OTP.
- [ ] Expired OTP.
- [ ] Valid QR.
- [ ] Invalid QR.
- [ ] Old regenerated code invalid.

Full journey:
- [ ] Register.
- [ ] Welcome reward.
- [ ] Generate code.
- [ ] Staff resolves customer.
- [ ] Add coffee.
- [ ] Customer progress updates.
- [ ] Reach threshold.
- [ ] Free coffee appears.
- [ ] Redeem.
- [ ] Admin traces everything.

Quality:
- [ ] Typecheck passes.
- [ ] Lint passes.
- [ ] Tests pass.
- [ ] Production build passes.
- [ ] Mobile customer review.
- [ ] Tablet staff review.
- [ ] Desktop admin review.
- [ ] Double-click/race review.

### Gate 13
- [ ] Release candidate passes all critical tests.

---

# 27. MVP definition of done

The MVP is complete only when:

- [ ] Customer registers.
- [ ] Profile is created.
- [ ] Welcome voucher is issued exactly once.
- [ ] Customer logs in.
- [ ] Customer sees coffee progress.
- [ ] Customer generates temporary QR + OTP.
- [ ] Staff logs in.
- [ ] Staff scans QR or enters OTP.
- [ ] Customer resolves securely.
- [ ] Staff records a qualifying coffee.
- [ ] Ledger transaction persists.
- [ ] Customer sees updated progress.
- [ ] Threshold issues Free Coffee exactly once.
- [ ] Customer sees available reward.
- [ ] Staff redeems reward exactly once.
- [ ] Customer sees redemption history.
- [ ] Admin sees earn/issue/redeem chain.
- [ ] Admin sees responsible staff/location/time.
- [ ] Admin can change coffee threshold.
- [ ] Admin can change welcome reward settings.
- [ ] Admin can manage menu.
- [ ] Admin can manage promotions.
- [ ] PWA installs.
- [ ] Security boundaries pass.
- [ ] Production build passes.

---

# 28. Out of scope

DO NOT BUILD YET:
- [ ] Online ordering.
- [ ] Online payments.
- [ ] Delivery.
- [ ] Table bookings.
- [ ] Real POS integration.
- [ ] Live WhatsApp integration.
- [ ] Apple Wallet.
- [ ] Google Wallet.
- [ ] Native push notifications.
- [ ] VIP tiers.
- [ ] Loyalty challenges.
- [ ] Referrals.
- [ ] Advanced CRM campaigns.
- [ ] Geofencing.

---

# 29. Final release checklist

Functional:
- [ ] Auth works.
- [ ] Coffee earn works.
- [ ] Welcome voucher works.
- [ ] QR/OTP works.
- [ ] Reward issuance works.
- [ ] Redemption works.
- [ ] Menu works.
- [ ] Promotions work.
- [ ] Admin works.
- [ ] Audit trail works.

Security:
- [ ] D1 never browser-exposed.
- [ ] Role middleware works.
- [ ] Client cannot change role.
- [ ] Loyalty mutations server-side.
- [ ] Redemption protected against duplicates/races.
- [ ] Secrets protected.
- [ ] R2 writes protected.

Documentation:
- [ ] Local setup documented.
- [ ] D1 migrations documented.
- [ ] R2 documented.
- [ ] Better Auth documented.
- [ ] Role creation documented.
- [ ] POS abstraction documented.
- [ ] WhatsApp abstraction documented.
- [ ] Capacitor path documented.

Build:
- [ ] Typecheck passes.
- [ ] Lint passes.
- [ ] Tests pass.
- [ ] Production build passes.
- [ ] No critical console errors.

---

# 30. Agent progress format

After each phase, report:

```text
PHASE COMPLETED:
[phase]

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

Also update this checklist.

Do not mark a phase complete if:
- [ ] Build is broken.
- [ ] TypeScript errors remain.
- [ ] Critical security is incomplete.
- [ ] Server logic was replaced with insecure client logic.

---

# 31. Immediate next action

1. [x] Inspect repository.
2. [x] Read master prompt and checklist.
3. [x] Implement missing Phase 1 items only.
4. [x] Run typecheck/build.
5. [x] Update checklist.
6. [x] Report progress.
7. [ ] Proceed to Phase 2 only after Gate 1 passes.
