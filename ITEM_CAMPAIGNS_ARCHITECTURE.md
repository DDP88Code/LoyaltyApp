# ITEM CAMPAIGNS — Implementation-Ready Architecture (Original)

> Note: sections 7, 12, 16, 18, 19, 22, 26 and handoff clauses 4, 5, 8 of this document were subsequently
> superseded by `ITEM_CAMPAIGNS_ARCHITECTURE_CORRECTIONS.md`. Read both together; the corrections file wins
> where they conflict.

## 1. Relevant existing architecture found

| Area | Fact established from code |
|---|---|
| Programs | `worker/db/schema/loyalty.ts` — `loyalty_programs` unique on `(business_id, currency_code)`. Live codes: `COFFEE` (stamp), `REWARD_POINTS` (points). |
| Ledger | `loyalty_transactions` append-only, signed `quantity`, **global** unique `idempotency_key`, `location_id` NOT NULL, `program_id` nullable. |
| Points award | `worker/db/schema/points.ts` — `points_awards` with `dedupe_guard_key` UNIQUE, `UNIQUE(business_id, request_idempotency_key)`, `released_guard_key`, `duplicate_override*`, `reversed_at`. |
| **Blocking constraint** | `points_awards_positive_chk`: `eligible_spend_cents > 0 AND ... AND total_points > 0`. A campaign-only bill **cannot** be represented as a `points_awards` row. |
| Guard construction | `bill:<businessId>:<locationId>:<businessDay>:<billReferenceKey>`; `normalizeBillReference()` + `businessDayKey()` in `worker/lib/points/service.ts`. |
| Calculation | `calculatePointsQuote()` in `worker/lib/points/calculate.ts` — pure, integer-only, highest-multiplier + highest-fixed-bonus. |
| Rewards | `worker/db/schema/rewards.ts` — `customer_rewards.issuance_key` nullable + unique (SQLite NULL-distinct). Statuses `available/redeemed/expired/cancelled`. |
| Cycle precedent | `recordCoffeeEarn()` issues `stamp:<programId>:<customerId>:<cycle>` with `onConflictDoNothing`. |
| Atomicity | `db.batch()` is one implicit D1 transaction. D1 remote rejects explicit `BEGIN/COMMIT`. |
| Staff flow | `worker/routes/staffPoints.ts` `quote` + `award`; UI in `src/features/staff/ResolvedCustomerView.tsx`. |
| Customer flow | `PointsPanel` inside `src/pages/customer/RewardsPage.tsx`. |
| Notifications | `createNotification` + typed helpers in `worker/lib/notifications/service.ts`. |

**Conclusion:** Item Campaigns are *quantity* progress, not a currency. They must not create a `loyalty_programs` row and must not touch `REWARD_POINTS` balance semantics.

## 2. Recommended parent bill/event model

A neutral parent is **required**, purely because of `points_awards_positive_chk`.

Introduce **`bill_events`** — one row per physical bill operation. It owns identity (duplicate guard + request idempotency). `points_awards` becomes an *optional* child; campaign quantity rows are another child.

```
bill_events (1)
 ├─ 0..1 points_awards ─→ 1..2 loyalty_transactions (earn/bonus)
 ├─ 0..n item_campaign_transactions
 └─ 0..n item_campaign_reward_issuances → customer_rewards
```

A bill may produce: campaigns only, points only, both, or both + reward unlocks. No fake `+0` ledger row is ever written.

## 3. Exact schema additions

New file `worker/db/schema/bills.ts` (**relative imports only** — drizzle-kit does not resolve `@worker/*`):

```
bill_events
  id                        pk
  business_id               TEXT NOT NULL → businesses.id ON DELETE CASCADE
  location_id               TEXT NOT NULL → locations.id ON DELETE RESTRICT
  customer_id               TEXT NOT NULL → profiles.id ON DELETE RESTRICT
  staff_id                  TEXT NULL → profiles.id ON DELETE RESTRICT
  source                    TEXT NOT NULL DEFAULT 'staff_manual'   -- staff_manual | pos
  bill_total_cents          INTEGER NOT NULL
  campaign_spend_cents      INTEGER NOT NULL DEFAULT 0
  excluded_campaign_spend_cents INTEGER NOT NULL DEFAULT 0
  other_excluded_spend_cents    INTEGER NOT NULL DEFAULT 0
  eligible_spend_cents      INTEGER NOT NULL DEFAULT 0
  total_points              INTEGER NOT NULL DEFAULT 0
  bill_reference            TEXT NOT NULL
  bill_reference_key        TEXT NOT NULL
  business_day              TEXT NOT NULL
  dedupe_guard_key          TEXT NULL
  released_guard_key        TEXT NULL
  duplicate_override        INTEGER NOT NULL DEFAULT 0
  duplicate_override_reason TEXT NULL
  duplicate_override_by     TEXT NULL → profiles.id RESTRICT
  request_idempotency_key   TEXT NOT NULL
  rewards_settled_at        INTEGER NULL
  reversed_at / reversed_by / reversal_reason
  calculation_json          TEXT NULL
  created_at                INTEGER NOT NULL

UNIQUE bill_events_dedupe_guard_unq (dedupe_guard_key)
UNIQUE bill_events_request_idem_unq (business_id, request_idempotency_key)
INDEX  (customer_id, created_at) (business_id, created_at) (location_id, business_day) (staff_id)
INDEX  bill_events_settlement_idx (rewards_settled_at)
CHECK  bill_total_cents > 0
CHECK  campaign_spend_cents >= 0 AND other_excluded_spend_cents >= 0 AND eligible_spend_cents >= 0
CHECK  campaign_spend_cents + other_excluded_spend_cents <= bill_total_cents
CHECK  duplicate_override = 0 OR (reason IS NOT NULL AND by IS NOT NULL)
```

`points_awards` — **additive only**:

```
ALTER TABLE points_awards ADD COLUMN bill_event_id TEXT NULL REFERENCES bill_events(id);
CREATE INDEX points_awards_bill_event_idx ON points_awards(bill_event_id);
```

No CHECK, no column type, no existing index is altered.

## 4. Must `points_awards` change?

**No behavioural change.** Only the nullable `bill_event_id` column + index. `points_awards_positive_chk` stays exactly as-is — it remains a correct invariant, because a `points_awards` row is now only written when points are genuinely earned. Zero-point bills simply have no child award row.

## 5. Item Campaign table

New file `worker/db/schema/itemCampaigns.ts`:

```
item_campaigns
  id                     pk
  business_id            TEXT NOT NULL → businesses.id CASCADE
  name                   TEXT NOT NULL
  description            TEXT NULL                      -- customer-facing
  item_reference         TEXT NOT NULL
  item_reference_key     TEXT NOT NULL                  -- normalized: trim/upper/strip [\s\-_/.]
  active_item_key        TEXT NULL                      -- = item_reference_key unless archived
  unit_price_cents       INTEGER NOT NULL
  target_quantity        INTEGER NOT NULL
  reward_definition_id   TEXT NOT NULL → reward_definitions.id RESTRICT
  earns_reward_points    INTEGER NOT NULL DEFAULT 0
  status                 TEXT NOT NULL DEFAULT 'active' -- active | disabled | archived
  start_at               INTEGER NULL
  end_at                 INTEGER NULL
  max_quantity_per_bill  INTEGER NULL                   -- null → ITEM_CAMPAIGN_MAX_QTY_PER_BILL (50)
  sort_order             INTEGER NOT NULL DEFAULT 0
  archived_at            INTEGER NULL
  created_at / updated_at

UNIQUE item_campaigns_active_item_unq (business_id, active_item_key)
INDEX  item_campaigns_listing_idx (business_id, status, sort_order)
INDEX  item_campaigns_reward_idx (reward_definition_id)
CHECK  unit_price_cents > 0
CHECK  target_quantity >= 2 AND target_quantity <= 1000
CHECK  max_quantity_per_bill IS NULL OR (max_quantity_per_bill > 0 AND max_quantity_per_bill <= 500)
CHECK  start_at IS NULL OR end_at IS NULL OR end_at > start_at
CHECK  (status = 'archived') = (archived_at IS NOT NULL)
CHECK  (active_item_key IS NULL) = (status = 'archived')
```

`active_item_key` uses the repo's proven NULL-distinct pattern instead of a partial index (see the known SQLite partial-index gotcha).

## 6. Item Campaign quantity ledger

```
item_campaign_transactions
  id                       pk
  business_id              TEXT NOT NULL → businesses.id CASCADE
  campaign_id              TEXT NOT NULL → item_campaigns.id RESTRICT
  customer_id              TEXT NOT NULL → profiles.id RESTRICT
  location_id              TEXT NOT NULL → locations.id RESTRICT
  staff_id                 TEXT NULL → profiles.id RESTRICT
  bill_event_id            TEXT NOT NULL → bill_events.id RESTRICT
  transaction_type         TEXT NOT NULL   -- purchase | reversal | deficit | adjustment
  quantity                 INTEGER NOT NULL          -- signed
  unit_price_cents         INTEGER NOT NULL          -- snapshot
  campaign_spend_cents     INTEGER NOT NULL          -- signed = quantity * unit_price_cents
  earns_reward_points      INTEGER NOT NULL          -- snapshot
  campaign_name_snapshot   TEXT NOT NULL
  item_reference_snapshot  TEXT NOT NULL
  bill_reference           TEXT NULL
  reason                   TEXT NULL
  approved_by              TEXT NULL → profiles.id RESTRICT
  idempotency_key          TEXT NOT NULL
  related_transaction_id   TEXT NULL
  created_at

UNIQUE item_campaign_tx_idem_unq (idempotency_key)
UNIQUE item_campaign_tx_bill_campaign_unq (bill_event_id, campaign_id, transaction_type)
INDEX  (customer_id, campaign_id, created_at)   -- serves the progress SUM
INDEX  (campaign_id, created_at) (business_id, created_at) (bill_event_id)
CHECK  quantity <> 0
CHECK  unit_price_cents >= 0
CHECK  (transaction_type = 'purchase') = (quantity > 0) OR transaction_type = 'adjustment'
CHECK  campaign_spend_cents = quantity * unit_price_cents
```

**Progress is always derived:** `SUM(quantity) WHERE customer_id = ? AND campaign_id = ?`. There is no mutable progress column anywhere — identical to coffee stamps and points balance.

Derived ledger keys:

- `campaign:<billEventId>:<campaignId>`
- `campaign-reversal:<billEventId>:<campaignId>`
- `campaign-deficit:<billEventId>:<campaignId>:<cycleIndex>`

## 7. Reward-cycle issuance model

```
item_campaign_reward_issuances
  id                  pk
  business_id         TEXT NOT NULL → businesses.id CASCADE
  campaign_id         TEXT NOT NULL → item_campaigns.id RESTRICT
  customer_id         TEXT NOT NULL → profiles.id RESTRICT
  cycle_index         INTEGER NOT NULL                  -- 1-based
  active_cycle_key    TEXT NULL     -- "<campaignId>:<customerId>:<cycleIndex>", NULL when cancelled
  customer_reward_id  TEXT NOT NULL → customer_rewards.id RESTRICT
  bill_event_id       TEXT NOT NULL → bill_events.id RESTRICT
  issued_at           INTEGER NOT NULL
  cancelled_at        INTEGER NULL
  deficit_applied_at  INTEGER NULL
  created_at

UNIQUE item_campaign_issuance_cycle_unq (active_cycle_key)
INDEX  (campaign_id, customer_id, cycle_index) (bill_event_id) (customer_reward_id)
CHECK  cycle_index > 0
CHECK  (active_cycle_key IS NULL) = (cancelled_at IS NOT NULL)
```

Double lock, no new engine:

1. `customer_rewards.issuance_key = 'campaign:<campaignId>:<customerId>:<cycleIndex>'` (existing unique index).
2. `item_campaign_reward_issuances.active_cycle_key` unique.

Cycle arithmetic (pure function, `worker/lib/campaigns/calculate.ts`):

```
netBefore    = SUM(quantity)                      // may be negative after deficits
cyclesBefore = floor(max(0, netBefore) / target)
netAfter     = netBefore + billQuantity
cyclesAfter  = floor(max(0, netAfter) / target)
newCycles    = max(0, cyclesAfter - cyclesBefore) // cycle_index = cyclesBefore+1 .. cyclesAfter
remainder    = max(0, netAfter) % target
```

Verified: `9 + 3 → 1 reward, remainder 2`; `8 + 25 → 3 rewards, remainder 3`. Excess quantity is never discarded.

## 8. Idempotency model

| Concern | Key | Enforcement |
|---|---|---|
| Client retry of whole bill | `bill_events.request_idempotency_key` | `UNIQUE(business_id, request_idempotency_key)` + pre-flight read → replay original payload, zero writes |
| Same physical receipt twice | `bill_events.dedupe_guard_key` | `UNIQUE(dedupe_guard_key)` → 409 |
| Points ledger rows | `points-earn:<awardId>`, `points-bonus:<awardId>` | existing global unique (unchanged) |
| Campaign ledger rows | `campaign:<billEventId>:<campaignId>` | global unique |
| Reward cycle | `campaign:<campaignId>:<customerId>:<cycle>` + `active_cycle_key` | two unique indexes |

Error disambiguation on batch failure follows the existing proven order: lookup by `request_idempotency_key` → replay; else lookup by `dedupe_guard_key` → 409 with existing bill details; else 500. **No error-string parsing.**

## 9. Duplicate receipt integration

Guard key construction is byte-identical to today and reuses the extracted helpers:

```
bill:<businessId>:<locationId>:<businessDay>:<billReferenceKey>
```

It now lives on `bill_events`, so **one** guard covers points-bearing, campaign-only, and mixed bills. Admin/Owner duplicate override sets `dedupe_guard_key = NULL`, `duplicate_override = 1`, requires a ≥5-char reason, and writes `audit_logs` action `admin.bill_event_duplicate_override`.

For points-bearing bills the same guard value is **also** written to `points_awards.dedupe_guard_key` (dual-write) so the legacy index stays coherent with historical rows. Override and reversal null both in the same batch. `points_awards.dedupe_guard_key` becomes redundant-derived and may be dropped in a later phase.

## 10. Campaign-only zero-points transaction handling

The required case (`1 × Double Up @ R80`, `earns_reward_points = false`) produces:

- 1 × `bill_events` row (`eligible_spend_cents = 0`, `total_points = 0`)
- 1 × `item_campaign_transactions` row (`quantity = +1`)
- **0** × `points_awards`
- **0** × `loyalty_transactions`

The transaction succeeds. No CHECK is relaxed, no `+0` ledger row is fabricated.

New rule in the bill engine: `quote.totalPoints <= 0` is a **valid outcome**, not an error. The legacy `quotePointsAward()` keeps its existing throw so the old endpoint is unchanged; the new engine uses a separate pure path.

## 11. Composite bill calculation algorithm

Input: `billTotalCents`, `otherExcludedSpendCents`, `lines[{ campaignId, quantity }]`, `locationId`, `billReference`.

```
1  reject duplicate campaignId within lines                       → 422
2  for each line: load campaign; assert business, status='active',
   now within [start_at, end_at], quantity integer 1..maxQty      → 422
3  spend_i          = quantity_i * campaign_i.unit_price_cents    (server price)
4  excludedCampaign = Σ spend_i where earns_reward_points = 0
5  includedCampaign = Σ spend_i where earns_reward_points = 1
6  totalCampaign    = excludedCampaign + includedCampaign
7  assert otherExcluded >= 0
8  assert totalCampaign + otherExcluded <= billTotal              → 422
9  eligible = billTotal - excludedCampaign - otherExcluded        (>= 0 by step 8)
10 quote = eligible > 0
           ? calculatePointsQuote(eligible, programRate, activePromotions)
           : ZERO_QUOTE
11 cycles_i = cycle arithmetic per campaign (section 7)
```

Worked example: `590 − 240 − 40 = 310` → `+310` points, Double Up `+3`. With `earns_reward_points = YES`, the R240 is not subtracted and eligible stays `550`.

## 12. Multiple campaigns algorithm

Identical — steps 3–6 and 11 iterate all lines. Included and excluded campaigns are partitioned only at step 4/5.

Brief's multi-campaign example (A qty2@80 = 480 excl, B qty1@120 = 120 incl, C qty2@150 = 300 excl, bill 900, other 40): `totalCampaign = 900`, `900 + 40 = 940 > 900` → **rejected 422** as an impossible bill. With `other = 0`: `eligible = 900 − 780 = 120` → points on R120 only. Staff never computes a difference; the server does, and the preview shows it.

> Superseded: `2 × R80 = R160`, not R480. See the corrections document — this bill is valid and yields `eligible = R400`.

## 13. Coffee / other excluded spend handling

`other_excluded_spend_cents` is a single Rand field for non-campaign spend that must not earn points (primarily qualifying Coffee purchases). It is subtracted verbatim at step 9, snapshotted on `bill_events`, and surfaced in the preview and in Admin reporting. Coffee stamp capture remains a completely separate existing action — this feature does not alter `recordCoffeeEarn()`.

## 14. Universal Reward Points interaction

`REWARD_POINTS` remains the single spendable currency. Campaigns never mint, spend, or shadow points. No campaign currency code is created; `loyalty_programs` gains no rows. Campaign progress lives exclusively in `item_campaign_transactions` and never enters `loyalty_transactions`. Balances are never blended in any payload or UI.

## 15. Threshold / cycle calculation

See section 7. Lifetime net 27 with target 10 → 2 cycles earned, remainder 7. Cycles are derived from the ledger on every read; the issuance table records only *what was already granted*, never the progress itself.

## 16. Reward issuance

1. Load campaign's `reward_definition` (must be `active`).
2. `expiresAt = validDays ? now + validDays*DAY_MS : null`.
3. For each new cycle: `INSERT customer_rewards { issuance_key: 'campaign:<c>:<cu>:<n>' } ON CONFLICT DO NOTHING RETURNING id`.
4. If inserted → `INSERT item_campaign_reward_issuances ON CONFLICT DO NOTHING`.
5. Notify once per bill (section 25).
6. `UPDATE bill_events SET rewards_settled_at = now`.

Reward lands in the customer's existing **Available** wallet and is redeemed by Staff through the unchanged QR/reward flow. No points are spent. No catalogue entry is required.

## 17. Concurrent transaction safety

Two-stage, deliberately:

**Stage 1 — one `db.batch()` (atomic, all-or-nothing):** `bill_events` → `item_campaign_transactions` → `points_awards` (if points) → `loyalty_transactions` earn/bonus (if points).

**Stage 2 — post-commit settlement (idempotent, retry-safe):** reward issuance via `onConflictDoNothing`, then notifications, then `rewards_settled_at`.

Rationale: if issuance were inside Stage 1, two concurrent bills racing the same cycle would make the loser's unique-index violation roll back *legitimate purchase quantity*. With Stage 2, the loser's purchases persist and the duplicate cycle is simply skipped — exactly the `issueWelcomeReward` / `recordCoffeeEarn` precedent.

**Settlement sweep:** the existing `*/5 * * * *` scheduled handler re-runs settlement for any `bill_events` where `rewards_settled_at IS NULL AND reversed_at IS NULL AND created_at < now-60s`. Because settlement is derived from the ledger and conflict-safe, replay is harmless.

## 18. Reversal behaviour

New: `POST /api/admin/points/bills/:billEventId/reverse` (admin/owner, reason ≥5 chars). One `db.batch()`:

1. Points portion — unchanged existing philosophy: compensating `loyalty_transactions` rows `points-reversal-earn:<awardId>` / `points-reversal-bonus:<awardId>`, and `points_awards` gets `reversed_at/by/reason`, `released_guard_key = dedupe_guard_key`, `dedupe_guard_key = NULL`.
2. Campaign portion — for each campaign line, one compensating row: `transaction_type='reversal'`, `quantity = -original`, same `unit_price_cents` snapshot, `related_transaction_id` = original, key `campaign-reversal:<billEventId>:<campaignId>`.
3. `bill_events`: `reversed_at/by/reason`, guard released to `released_guard_key`, `dedupe_guard_key = NULL` (so the receipt may be legitimately re-captured).
4. Audit: `admin.bill_event_reversed`.

History is never rewritten or deleted. Then the threshold pass runs (section 19).

## 19. Already-redeemed reward reversal edge case

After compensating rows, recompute `cyclesEntitled = floor(max(0, net)/target)`. For every live issuance with `cycle_index > cyclesEntitled`, branch on the linked `customer_rewards.status`:

| Status | Action | Rationale |
|---|---|---|
| `available` (not expired) | `status='cancelled'`, `issuance_key = NULL`, issuance `cancelled_at=now`, `active_cycle_key=NULL` | No value consumed. Nulling both keys frees the cycle so it can be legitimately re-earned later — the same NULL-distinct release used by `released_guard_key`. |
| `expired` | same as `available` | Customer received no value; do not penalise. |
| `cancelled` | no-op | Already released. |
| **`redeemed`** | **no clawback of the reward.** Keep issuance live. Write `item_campaign_transactions` row `transaction_type='deficit'`, `quantity = -target_quantity`, key `campaign-deficit:<billEventId>:<campaignId>:<cycle>`; set `deficit_applied_at`. | History is immutable and the free item is already consumed. Net progress goes negative, so the customer must re-earn that cycle's worth of quantity before the next unlock — philosophically identical to the existing points *recovery* (negative balance) model. |

Customer UI clamps display at `0 / target` and shows a neutral catch-up note; it never shows a negative number. Admin reporting exposes `campaignDeficitQuantity` explicitly.

> Superseded in full by the corrections document: the `redeemed` row must perform **no** compensating action.

## 20. Admin endpoints

Mount in `worker/routes/adminPoints.ts` (or a new `adminCampaigns.ts` routed under `/points`), all `requireSession + requireAdminOrOwner`:

- `GET    /api/admin/points/campaigns` → campaigns + `eligibleRewards[]`
- `POST   /api/admin/points/campaigns`
- `PATCH  /api/admin/points/campaigns/:campaignId` (fields + `status` transitions)
- `GET    /api/admin/points/campaigns/:campaignId/activity`
- `GET    /api/admin/points/campaigns/report`
- `POST   /api/admin/points/bills/:billEventId/reverse`
- `POST   /api/admin/points/awards/:awardId/reverse` — **retained**; delegates to bill-event reversal when `bill_event_id` is set, else legacy path.

Reward eligibility validator `assertRewardDefinitionEligibleForCampaign()`: must be same business, `active = 1`, `reward_type ∈ {free_item, voucher}`, **not** `welcome_reward = 1`, **not** the reserved Birthday reward, **not** referenced by any active `loyalty_programs.reward_definition_id` (protects Free Coffee). A points-catalogue entry may coexist and is never auto-modified.

## 21. Staff endpoints / workflow

- `POST /api/staff/points/customers/:customerId/bill/quote` — **writes nothing**, returns the full preview.
- `POST /api/staff/points/customers/:customerId/bill` — commits; accepts `requestIdempotencyKey`, optional `duplicateOverrideReason` (admin/owner only, existing rule).
- `GET /api/staff/customers/:customerId/resolve` (existing) — extend the `points` context with `campaigns[]` including each campaign's current `netQuantity`, `target`, `remainder`, so the capture screen shows live progress in one round-trip.
- Legacy `POST .../quote` and `POST .../award` remain, reimplemented as thin adapters over the bill engine with zero campaign lines — guaranteeing exactly one guard/idempotency path.

Request shape:

```jsonc
{
  "locationId": "...",
  "billTotalRand": "590.00",
  "otherExcludedSpendRand": "40.00",
  "campaignLines": [{ "campaignId": "...", "quantity": 3 }],
  "billReference": "12345",
  "requestIdempotencyKey": "...",
  "duplicateOverrideReason": null
}
```

The client **never** sends a unit price. Rand strings reuse the existing `moneySchema` + `randToCents()`.

Preview payload mirrors the brief exactly: per-campaign purchases, campaign spend, `progressBefore → progressAfter`, `rewardsUnlocked` count and reward name; then other excluded spend, eligible spend, and points earned. Final confirmation **recalculates everything server-side** and ignores the quote.

## 22. Customer endpoints / UI

No new route. `GET /api/customer/points` payload gains:

```ts
campaigns: {
  id: string; name: string; description: string | null;
  targetQuantity: number; currentQuantity: number;   // clamped >= 0
  remainingToTarget: number; cyclesCompleted: number;
  rewardName: string; rewardValidDays: number | null;
  inCatchUp: boolean; recentlyUnlockedRewardName: string | null;
}[]
```

UI: a new `ITEM CAMPAIGNS` section inside `PointsPanel` in `src/pages/customer/RewardsPage.tsx` — card with `6 / 10`, progress bar, `6 purchased • 4 to go`, `Buy 10 and unlock: Free Double Up Special`. Mobile-first Fives styling, matching existing card/badge primitives. **Never** renders a campaign points figure. When a cycle has just completed, the card shows a one-off "Reward unlocked" badge (driven by the most recent issuance within 48h) and the bar continues at the next cycle's remainder.

## 23. Admin UI

Extend `src/pages/admin/AdminPointsPage.tsx` with an **Item Campaigns** tab alongside Program / Promotions / Catalogue:

- List: name, item reference, unit price, target, reward, earns-points flag, status, active window.
- Create/Edit form with all section-5 fields; reward selector limited to eligible definitions; inline validation mirroring the server Zod schema (repo convention — surface `error.details` field messages, never a generic-only banner).
- Status actions: Activate / Disable / Archive, with a guard explaining archive is non-destructive.
- Per-campaign activity drawer: recent transactions, reversals, deficits, rewards unlocked.

## 24. Permissions

| Actor | Allowed |
|---|---|
| Customer | View own campaign progress; receive issued rewards. No writes. |
| Staff | Record campaign quantities on a QR-resolved customer; quote and commit bills. |
| Admin / Owner | All staff rights + create/edit/disable/archive campaigns, set price/target/reward/earn-flag, duplicate override, bill reversal, reporting. |

Staff **cannot** change unit price, target, earn-flag, multipliers, or manually grant a campaign reward. Price and earn-flag are read server-side from the campaign row on every quote and every commit.

## 25. Notifications

Reuse `createNotification` with existing `reward_earned` type and `pushAudience: 'account'` (follows `notification_opt_in`, consistent with the promotions change).

- Fire **once per bill event**, only when `rewardsUnlocked > 0`.
- Multiple cycles in one bill → one message ("You've earned 3 × Free Double Up Special").
- **Never** notify on ordinary campaign purchases.
- `source_type = 'campaign_reward'`, `source_id = billEventId` for dedupe.
- Reversal cancellation sends no notification (avoids confusing churn); it is captured in audit + admin reporting.

## 26. Reporting

`GET /api/admin/points/campaigns/report`:

- Per campaign: purchases recorded, gross qualifying quantity, reversed quantity, deficit quantity, net quantity, rewards unlocked, rewards redeemed/cancelled/expired, active customers with progress, customers currently in catch-up, configured unit price, total campaign spend, and whether spend was included in or excluded from Reward Points.
- Recent campaign transactions with staff, location, bill reference, business day.
- Bill-event view: campaign spend vs other excluded spend vs eligible spend vs points awarded.

Phrased as loyalty activity, not financial accounting.

## 27. Campaign lifecycle

`active` → capturable. `disabled` → hidden from Staff and Customer, existing progress preserved, still holds its item slot. `archived` → read-only, releases the item slot, `archived_at` set. Campaigns referenced by any transaction are never deleted (`RESTRICT`). Name, item reference, unit price, and earn-flag are snapshotted on every ledger row so historical records stay readable after edits. Price changes are forward-only: existing progress quantity is untouched, old rows keep R80, new rows use R85.

## 28. Same-item overlap rules (Phase 1)

**Rule:** at most one non-archived (`active` *or* `disabled`) campaign per `(business_id, item_reference_key)`, enforced by `UNIQUE(business_id, active_item_key)`. Attempting to create or re-enable a second returns `409` naming the conflicting campaign. Archiving releases the slot. This makes it structurally impossible for one physical Double Up to be counted into two quantity campaigns. Deliberate stacking is explicitly deferred to a future phase.

## 29. Future POS integration

The engine's input contract is an adapter-neutral struct:

```ts
{ source, externalReceiptId, locationId, customerId, billTotalCents,
  otherExcludedSpendCents, lines: [{ itemReferenceKey | campaignId, quantity }],
  occurredAt, requestIdempotencyKey }
```

`bill_events.source` already supports `pos`. A POS adapter supplies its receipt id as `billReference` and resolves SKUs to campaigns via `item_reference_key` — which is why the normalized key column exists and why the uniqueness rule in section 28 matters. The manual Staff form is simply the first adapter; no campaign logic is coupled to form fields.

## 30. Migration / backwards compatibility

`drizzle/migrations/0010_item_campaigns.sql`, no explicit transaction statements (D1 remote rejects them):

1. `CREATE TABLE bill_events` + indexes.
2. `CREATE TABLE item_campaigns`, `item_campaign_transactions`, `item_campaign_reward_issuances` + indexes.
3. `ALTER TABLE points_awards ADD COLUMN bill_event_id TEXT` + index.
4. **Backfill:** one `bill_events` row per existing `points_awards` row, copying `location_id`, `customer_id`, `staff_id`, `bill_reference`, `bill_reference_key`, `business_day`, `dedupe_guard_key`, `released_guard_key`, `duplicate_override*`, `request_idempotency_key`, `reversed_at/by/reason`, `created_at`; `bill_total_cents = eligible_spend_cents`, `eligible_spend_cents = eligible_spend_cents`, `total_points = total_points`, `rewards_settled_at = created_at`; then set `points_awards.bill_event_id`. Backfill is mandatory — without it a campaign-only bill could reuse a historical receipt reference.

Backwards compatibility: no existing column, constraint, or index is modified or dropped. Coffee, points, catalogue, promotions, rewards, QR/OTP all unchanged. Legacy staff endpoints keep their exact request/response shapes.

Deploy order (repo standing rule): `npm run db:migrate:remote` **before** `npm run deploy:prod`.

## 31. Test matrix

Unit (pure, `calculate.ts`):

1. Cycles: `9+3→1/rem 2`; `8+25→3/rem 3`; `0+10→1/rem 0`; `27 target 10 → 2 cycles/rem 7`.
2. Negative net after deficit clamps to `0/target`, issues nothing until repaid.
3. Eligible spend: `590−240−40=310`; earn-flag YES keeps R240 in; all-campaign bill → 0.
4. `totalCampaign + otherExcluded > billTotal` → rejected.
5. Integer-cents only; no float anywhere.

Integration (`scripts/item-campaigns-smoke.mjs`, mirrors `points-smoke.mjs`):

6. Campaign-only bill, earn-flag NO → quantity `+1`, points `0`, **HTTP 200**, zero `points_awards`, zero `loyalty_transactions`.
7. Mixed bill → both children written, totals match the quote.
8. Quote endpoint writes nothing (row counts identical before/after).
9. Request-idempotency replay → identical `billEventId`, no extra rows.
10. Duplicate receipt, same location/day → 409; different location → allowed.
11. Admin duplicate override → succeeds, flagged, audit row written; staff override → 403.
12. Threshold crossing issues exactly one `customer_rewards` row; replay issues none.
13. Multi-cycle single bill issues exact count with sequential `cycle_index`.
14. Concurrent bills racing one cycle → both quantities persist, exactly one reward.
15. Reversal of an unredeemed-threshold bill → reward `cancelled`, cycle freed, re-purchase re-earns it.
16. Reversal of a **redeemed**-threshold bill → reward untouched, `deficit` row written, progress goes into catch-up.
17. Reversal releases the guard; the same receipt can be re-captured.
18. Second active campaign for the same item reference → 409; after archiving the first → allowed.
19. Disabled campaign rejected at quote and at commit.
20. Out-of-window campaign (`start_at`/`end_at`) rejected.
21. Quantity `0`, negative, non-integer, and `9999` (over max) all rejected.
22. Cross-business campaign id → 404/403.
23. Client-supplied unit price is ignored; server price is authoritative; price edit does not alter historical snapshots or existing progress.
24. Staff cannot create/edit/archive campaigns (403).
25. Exactly one notification per multi-cycle bill; none for ordinary purchases.
26. Settlement sweep re-settles a bill whose Stage 2 was interrupted, without duplicating rewards.

Regression (must remain green): `npm run test:points`, coffee earn/redeem, welcome, birthday, QR/OTP lifecycle, points catalogue claim, staff reward redemption, `phase13-smoke.ps1`, `auth-regression-smoke.ps1`, menu/promotions media caching.

## 32. Implementation phases

1. **Schema + migration** — tables, `bill_event_id`, backfill. Verify locally, then remote. No behaviour change yet.
2. **Bill engine** — extract `billIdentity.ts`; build `worker/lib/campaigns/*`; re-point legacy staff quote/award through the engine with zero campaign lines; prove points regression suite green.
3. **Campaign capture** — staff bill quote/commit endpoints, campaign ledger writes, zero-point path.
4. **Cycle issuance + settlement sweep + notifications.**
5. **Admin CRUD + eligibility validator + lifecycle + overlap rule.**
6. **Reversal + deficit handling.**
7. **Customer UI** (`ITEM CAMPAIGNS` section).
8. **Staff UI** (bill capture dialog with server preview).
9. **Admin UI** (Item Campaigns tab) + reporting.
10. **Smoke script, full regression, checklist tick, deploy.**

## 33. Files likely created / changed

**Created**

- `shared/itemCampaigns.ts`
- `worker/db/schema/bills.ts`
- `worker/db/schema/itemCampaigns.ts`
- `drizzle/migrations/0010_item_campaigns.sql`
- `worker/lib/points/billIdentity.ts`
- `worker/lib/campaigns/config.ts`
- `worker/lib/campaigns/calculate.ts`
- `worker/lib/campaigns/service.ts`
- `worker/lib/campaigns/issuance.ts`
- `worker/lib/bills/service.ts`
- `worker/routes/adminCampaigns.ts`
- `src/features/staff/BillCaptureDialog.tsx`
- `src/features/customer/ItemCampaignCard.tsx`
- `src/features/admin/campaigns/*`
- `scripts/item-campaigns-smoke.mjs`

**Changed**

- `worker/db/schema/index.ts`, `worker/db/schema/points.ts`
- `worker/lib/points/service.ts`, `worker/lib/points/config.ts`
- `worker/routes/staffPoints.ts`, `worker/routes/staff.ts`, `worker/routes/adminPoints.ts`, `worker/routes/customer.ts`, `worker/index.ts` (scheduled sweep)
- `shared/rewardPoints.ts`, `shared/domain.ts` (campaign tx-type vocabulary)
- `src/features/staff/ResolvedCustomerView.tsx`, `src/features/staff/api.ts`
- `src/pages/customer/RewardsPage.tsx`, `src/pages/admin/AdminPointsPage.tsx`
- `src/features/customer/api.ts` / `src/features/admin/api.ts`
- `package.json`, `CHECKLIST.md`

---

# FINAL CODEX IMPLEMENTATION HANDOFF

Implement exactly as specified. Non-negotiable invariants:

1. **Never** create a campaign-specific currency or `loyalty_programs` row. `REWARD_POINTS` stays the only spendable currency.
2. **Never** relax `points_awards_positive_chk` and **never** write a `+0` ledger row. Campaign-only bills write `bill_events` + `item_campaign_transactions` only.
3. `bill_events` is the sole owner of `dedupe_guard_key` and `request_idempotency_key` for all new bills. Backfill it from `points_awards` in migration `0010` before any new code path goes live.
4. Progress is **always** `SUM(item_campaign_transactions.quantity)`. No mutable progress column, ever.
5. Stage 1 (`bill_events` + campaign rows + points award + ledger) is one `db.batch()`. Stage 2 (reward issuance + notification + `rewards_settled_at`) is post-commit and `onConflictDoNothing`. Never put issuance in Stage 1.
6. Unit price and `earns_reward_points` are read server-side per request and snapshotted on every ledger row. Reject any client-supplied price field.
7. Cycle identity is double-locked: `customer_rewards.issuance_key = 'campaign:<campaignId>:<customerId>:<cycle>'` **and** `item_campaign_reward_issuances.active_cycle_key`.
8. Reversal of a **redeemed** cycle writes a `deficit` row of `-target_quantity`. It must never cancel or delete the redeemed reward.
9. Overlap rule: `UNIQUE(business_id, active_item_key)`, NULL only when archived. Use the NULL-distinct pattern, not a partial index.
10. Schema files under `worker/db/schema/**` must use **relative** imports (drizzle-kit ignores the `@worker/*` alias).
11. Migration SQL must contain no `BEGIN`/`COMMIT`/`SAVEPOINT`.
12. Run `npm run db:migrate:remote` before `npm run deploy:prod`.
13. Do not modify the existing "Free Double Up Special" points-catalogue entry.
14. Full regression suite must pass before deploy: points, coffee, welcome, birthday, QR/OTP, catalogue claim, staff redemption, Phase 13 hardening.

NO Build My New App resources were modified.
