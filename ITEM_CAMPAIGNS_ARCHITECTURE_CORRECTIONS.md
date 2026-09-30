# ITEM CAMPAIGNS — Approved Architecture Corrections

Both corrections accepted. Correction 1 is a genuine arithmetic fault in the original design — the issuance record already encodes cycle consumption, so a `-target` deficit double-penalised the customer. Correction 2's arithmetic is right (`2 × R80 = R160`, not R480).

Returning only the affected sections.

---

# 1. CORRECTED — Cycle model, settlement, and reversal (replaces §7 arithmetic, §16 step logic, §18 step 4, §19)

## 1.1 Schema corrections implied

These three items from the approved spec are **withdrawn**:

| Withdrawn | Replacement |
|---|---|
| `item_campaign_transactions.transaction_type` value `deficit` | Enum becomes `purchase \| reversal \| adjustment` only |
| Ledger key `campaign-deficit:<billEventId>:<campaignId>:<cycleIndex>` | Removed entirely — no such row is ever written |
| `item_campaign_reward_issuances.deficit_applied_at` | Removed. Add `released_cycle_key TEXT NULL` instead (audit mirror of `released_guard_key`) |

`item_campaign_reward_issuances` final shape for the cycle columns:

```
cycle_index        INTEGER NOT NULL
active_cycle_key   TEXT NULL   -- "<campaignId>:<customerId>:<cycleIndex>"; NULL once released
released_cycle_key TEXT NULL   -- permanent copy of the key at release time
cancelled_at       INTEGER NULL
CHECK (active_cycle_key IS NULL) = (cancelled_at IS NOT NULL)
```

## 1.2 Canonical derived quantities

All four are computed from state on every read and every settlement. None is stored.

```
netQuantity      = SUM(item_campaign_transactions.quantity)
                   WHERE customer_id = ? AND campaign_id = ?
                   -- purchases (+), reversals (−), admin adjustments (±). Nothing else. Ever.

cyclesEarned     = floor(max(0, netQuantity) / target)

consumedCycles   = COALESCE(MAX(cycle_index), 0)
                   FROM item_campaign_reward_issuances
                   WHERE campaign_id = ? AND customer_id = ?
                     AND active_cycle_key IS NOT NULL      -- live issuances only

nextEligibleCycle = max(cyclesEarned, consumedCycles) + 1
```

`consumedCycles` is the *permanent* record of cycles already granted. A redeemed reward's issuance row stays live forever, so its cycle can never be re-granted — which is precisely why no compensating quantity is needed.

## 1.3 Settlement algorithm (state-based, replaces the delta-based formula)

The old `newCycles = cyclesAfter − cyclesBefore` is **withdrawn**. Settlement is now a pure function of current state, which makes it idempotent, replay-safe, and automatically correct after any reversal.

```
settleCampaignRewards(campaign, customer, billEventId):
  net            = netQuantity(campaign, customer)
  cyclesEarned   = floor(max(0, net) / target)
  consumedCycles = liveIssuanceMaxCycle(campaign, customer)

  for cycle in (consumedCycles + 1) .. cyclesEarned:
      INSERT customer_rewards
        { issuance_key: 'campaign:<campaignId>:<customerId>:<cycle>' }
        ON CONFLICT DO NOTHING RETURNING id
      if inserted:
        INSERT item_campaign_reward_issuances
          { cycle_index: cycle,
            active_cycle_key: '<campaignId>:<customerId>:<cycle>',
            customer_reward_id, bill_event_id }
          ON CONFLICT DO NOTHING

  if cyclesEarned <= consumedCycles: issue nothing
  UPDATE bill_events SET rewards_settled_at = now
```

The loop is empty whenever `cyclesEarned <= consumedCycles`, which is exactly the catch-up state. No special-casing, no branch.

## 1.4 Reversal — corrected §18 step 4 and §19

Reversal writes **only** truthful compensating quantity. Steps 1–3 of §18 are unchanged (points compensation, campaign `reversal` rows at `quantity = −original` with the original `unit_price_cents` snapshot, guard release on `bill_events` and `points_awards`).

Step 4 becomes the **cycle reconciliation pass**. Recompute `cyclesEarned` from the new `netQuantity`, then for every **live** issuance with `cycle_index > cyclesEarned`:

| Linked `customer_rewards.status` | Action | Effect on `consumedCycles` |
|---|---|---|
| `available` (not past `expires_at`) | Release: `status='cancelled'`, `issuance_key=NULL`, issuance `cancelled_at=now`, `released_cycle_key=active_cycle_key`, `active_cycle_key=NULL` | Decreases — cycle becomes legitimately re-earnable |
| `expired` | Same release as `available` | Decreases — no value was consumed |
| `cancelled` | No-op (already released) | Unchanged |
| **`redeemed`** | **No action at all.** Reward untouched, issuance stays live, **no quantity row written** | Unchanged — cycle stays permanently consumed |

Releases are processed in descending `cycle_index` so `consumedCycles` settles monotonically. Audit row `admin.campaign_cycle_released` per release, recording campaign, cycle index, customer reward id, and originating bill event.

**No artificial negative quantity is ever inserted.** The quantity ledger reflects purchases, reversals, and explicit admin adjustments — nothing else.

## 1.5 Worked cases

**Case A —** target 10, net after reversal 9, one **redeemed** cycle-1 issuance.

```
cyclesEarned      = floor(9 / 10)              = 0
consumedCycles    = 1                           (redeemed, stays live)
cycle 1 > cyclesEarned but status = redeemed   → no action, no deficit row
nextEligibleCycle = max(0, 1) + 1              = 2
required lifetime = 2 × 10                     = 20
additional purchases = 20 − 9                  = 11   ✔ matches expected
```

**Case B —** target 10, net after reversal 5, two **redeemed** issuances (cycles 1 and 2).

```
cyclesEarned      = floor(5 / 10)              = 0
consumedCycles    = 2
nextEligibleCycle = max(0, 2) + 1              = 3
required lifetime = 3 × 10                     = 30
additional purchases = 30 − 5                  = 25   ✔ matches expected
```

**Case C —** target 10, net 12 → cycle 1 issued and still `available`; a 3-quantity purchase is reversed.

```
net               = 12 − 3                     = 9
cyclesEarned      = 0
cycle 1 > 0 and status = available             → released (cancelled, keys nulled)
consumedCycles    = 0
nextEligibleCycle = 1
required lifetime = 10
additional purchases = 10 − 9                  = 1    ✔ cycle re-earnable
```

Under the withdrawn deficit design Case A would have demanded 21 purchases and Case B 35. Both are now correct.

---

# 2. CORRECTED — Customer catch-up / progress derivation (replaces §22 payload semantics)

Catch-up is **derived for display only**. It never touches, offsets, or reinterprets stored quantity.

```
cycleStartQuantity      = (nextEligibleCycle − 1) × target
targetLifetimeQuantity  = nextEligibleCycle × target

remainingToNextReward   = max(0, targetLifetimeQuantity − netQuantity)
progressInCycle         = clamp(netQuantity − cycleStartQuantity, 0, target)

inCatchUp               = netQuantity < cycleStartQuantity
catchUpQuantity         = inCatchUp ? (cycleStartQuantity − netQuantity) : 0
```

Invariant: when `inCatchUp = false`, `progressInCycle + remainingToNextReward = target`, so the familiar `6 / 10 • 4 to go` card is unchanged for every normal customer.

Corrected customer payload:

```ts
campaigns: {
  id: string; name: string; description: string | null;
  targetQuantity: number;
  progressInCycle: number;          // 0..target, display only
  remainingToNextReward: number;    // authoritative headline number
  cyclesCompleted: number;          // = consumedCycles
  nextEligibleCycle: number;
  inCatchUp: boolean;
  catchUpQuantity: number;
  rewardName: string; rewardValidDays: number | null;
  recentlyUnlockedRewardName: string | null;
}[]
```

Rendering rule in `src/pages/customer/RewardsPage.tsx`:

- `inCatchUp = false` → unchanged card: `6 / 10`, bar at `progressInCycle / target`, `6 purchased • 4 to go`.
- `inCatchUp = true` → bar renders empty and the headline is `remainingToNextReward`, e.g. Case A: **"11 more to unlock your next Free Double Up Special"**, with a single neutral secondary line explaining that a previous purchase was corrected. Never render a `0 / 10` alongside `11 to go`, and never render a negative number.

`cyclesCompleted` is always the count of live issuances, so a redeemed reward is permanently reflected as an earned cycle in the customer's history.

---

# 3. CORRECTED — Multi-campaign example (replaces §12 example)

The algorithm in §11/§12 is unchanged; only the worked numbers were wrong.

| Campaign | Qty | Unit | Spend | Earns normal points |
|---|---|---|---|---|
| A | 2 | R80.00 | **R160.00** | NO |
| B | 1 | R120.00 | R120.00 | YES |
| C | 2 | R150.00 | R300.00 | NO |

```
totalCampaignSpend     = 160 + 120 + 300          = R580.00
excludedCampaignSpend  = 160 + 300                = R460.00
includedCampaignSpend  = 120                      = R120.00
billTotal                                          = R900.00
otherExcludedSpend                                 = R40.00

step 8 guard: 580 + 40 = 620 ≤ 900                 → valid bill (accepted)
eligibleSpend = 900 − 460 − 40                     = R400.00
points @ default R1 = 1 point                      = +400
quantity progress: A +2, B +1, C +2
```

The earlier statement that this bill is rejected was a consequence of the bad multiplication and is withdrawn — this is a **valid, accepted** bill. The step-8 rejection rule itself (`totalCampaignSpend + otherExcludedSpend ≤ billTotal`) remains correct and is retained; it now needs its own dedicated over-declaration test rather than borrowing this example.

---

# 4. AFFECTED TEST CASES (replaces the listed items in §31)

**Unit — replaces old items 1, 2, 4**

1. **State-based settlement:** `net=9, consumed=0 → 0 issued`; `net=10, consumed=0 → cycle 1`; `net=33, consumed=0 → cycles 1,2,3`; `net=33, consumed=3 → 0 issued`. Settlement called twice in a row issues nothing the second time.
2. **Case A:** `target=10, net=9, one redeemed live issuance` → `cyclesEarned=0`, `consumedCycles=1`, `nextEligibleCycle=2`, `remainingToNextReward=11`, `inCatchUp=true`, `catchUpQuantity=1`, `progressInCycle=0`.
3. **Case B:** `target=10, net=5, two redeemed live issuances` → `nextEligibleCycle=3`, `remainingToNextReward=25`, `catchUpQuantity=5`.
4. **Case C:** `target=10, net=12, cycle 1 available` → reverse 3 → cycle 1 released, `consumedCycles=0`, `nextEligibleCycle=1`, `remainingToNextReward=1`, `inCatchUp=false`.
5. **Non-catch-up invariant:** for any `net ≥ cycleStartQuantity`, `progressInCycle + remainingToNextReward = target`.
6. **Corrected multi-campaign eligible spend:** A `2×R80`, B `1×R120` (earns YES), C `2×R150` → `excluded=R460`, `eligible=R400`, `points=+400`, quantities `+2/+1/+2`.
7. **Over-declaration rejection (new, dedicated):** `billTotal=R500`, campaign spend `R480`, other excluded `R40` → `520 > 500` → **422**.
8. Existing arithmetic checks retained unchanged: `9+3→1 reward/rem 2`; `8+25→3 rewards/rem 3`; `590−240−40=310`; earn-flag YES keeps campaign spend in the eligible base; integer cents only.

**Integration — replaces old item 16, adds 27–29**

16. **Redeemed-cycle reversal:** reach 10/10, reward issued and redeemed by Staff, then reverse one qualifying purchase → redeemed reward still `redeemed`; **zero** new `item_campaign_transactions` rows beyond the single `reversal` row; `netQuantity = 9`; issuance for cycle 1 still live; customer payload reports `remainingToNextReward = 11`. Then record 11 purchases → cycle 2 issues exactly once. Record only 10 → nothing issues.
17. **Expired-cycle reversal:** linked reward `expired` → released like `available`, cycle re-earnable, no deficit row.
27. **No-deficit invariant:** across the entire suite, `SELECT COUNT(*) FROM item_campaign_transactions WHERE transaction_type NOT IN ('purchase','reversal','adjustment')` is `0`.
28. **Two redeemed cycles then reversal:** reach 20, both cycles redeemed, reverse 15 → `net=5`, `consumedCycles=2`, next reward requires 25 further purchases; at 24 nothing issues, at 25 cycle 3 issues once.
29. **Mixed release ordering:** cycles 1 (redeemed) and 2 (available) live, reversal drops `cyclesEarned` to 0 → cycle 2 released, cycle 1 untouched, `consumedCycles=1`, `nextEligibleCycle=2`.

**Reporting (§26 correction):** the `campaignDeficitQuantity` metric is withdrawn. Replace with `cyclesConsumed`, `cyclesReleased`, and `customersInCatchUp`.

---

# 5. UPDATED FINAL CODEX IMPLEMENTATION HANDOFF

Clauses 1–3, 6, 7, 9–14 from the approved handoff stand unchanged. Clauses 4, 5 and 8 are superseded, and clause 15 is added.

**4 (superseded).** Quantity progress is **always** `SUM(item_campaign_transactions.quantity)` and that ledger records **only** real purchases, real reversals, and explicit admin adjustments. No mutable progress column, and **no synthetic quantity of any kind** — never write a negative row to represent a consumed reward.

**5 (superseded).** Stage 1 (`bill_events` + campaign rows + points award + ledger) is one `db.batch()`. Stage 2 is post-commit settlement and must be **state-based, not delta-based**:

```
cyclesEarned   = floor(max(0, netQuantity) / target)
consumedCycles = MAX(cycle_index) WHERE active_cycle_key IS NOT NULL, else 0
issue cycles (consumedCycles + 1) .. cyclesEarned   using onConflictDoNothing
```

Never compute cycles from a before/after delta. Never put issuance inside Stage 1.

**8 (superseded).** Reversal of a cycle whose reward is **`redeemed`** performs **no compensating action whatsoever** — no quantity row, no clawback, no status change. The live issuance row alone permanently consumes that cycle. Reversal of an `available` or `expired` reward releases the cycle: `status='cancelled'`, `customer_rewards.issuance_key=NULL`, `cancelled_at=now`, `released_cycle_key=active_cycle_key`, `active_cycle_key=NULL`. Process releases in descending `cycle_index`. The next reward then falls at `nextEligibleCycle × target` lifetime quantity — verified: target 10 / net 9 / 1 redeemed → **11** further purchases; target 10 / net 5 / 2 redeemed → **25** further purchases.

**15 (new).** Catch-up is **derived for display only** — `inCatchUp`, `catchUpQuantity`, `progressInCycle`, `remainingToNextReward` are computed per request from `netQuantity` and `consumedCycles`. They must never be persisted, and must never be implemented by adjusting, offsetting, or reinterpreting stored quantity. The customer UI shows `remainingToNextReward` as the headline when `inCatchUp` is true, renders the bar empty, and never displays a negative value.

Also drop from the approved spec before implementing: the `deficit` transaction type, the `campaign-deficit:` idempotency key, the `deficit_applied_at` column (replaced by `released_cycle_key`), and the `campaignDeficitQuantity` report metric.

NO Build My New App resources were modified.
