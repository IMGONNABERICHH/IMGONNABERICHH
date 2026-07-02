# Perpetual Trading Chain — Strategy

Account: 903261667
Approach: Option B — always wait for pullback entry, never chase.

## Active Positions / Orders (Agentic Account 903261667)

- **SPCX**: 0.127559 shares, avg cost $156.79
  - Goal: sell at $187 if hit before 10:30am ET
  - Exit: sell at market if goal not hit by 10:30am OR price < prev close (downtrend)
- **JOBY**: 1 share, avg cost $9.29 (filled)
  - Goal: sell at $9.29 break-even
  - Exit: sell at market if not hit by 10:30am OR price < prev close (downtrend)
- Both monitored by GitHub Actions workflow (`spcx_monitor.yml`) every 5 minutes

## Chain Logic

1. Monitor active position/order every 5 minutes.
2. When a sell triggers (target hit), execute market sell.
3. After a sell, scan the watchlist and pick the next best setup.
4. Option B entry rule:
   - If ticker is up **more than 10%** today → limit buy **8-10% below** current price.
   - If ticker is up **less than 10%** today → limit buy **3-5% below** current price.
   - Note: limit orders require whole shares (fractional shares only work on
     market orders) — pick a stock priced low enough to afford 1+ whole share
     within the position size.
5. Target sell price: **15-30% above** entry.
6. Position size: **$20** normally (scaled down to $10 for the JOBY test trade).
7. After each completed round-trip, repeat from step 3 — indefinitely, until
   told otherwise.

## Watchlist

RKLB, ASTS, KTOS, RIVN, NVDA, ACHR, JOBY, AUR

## Milestones

- **$500** realized gains → checkpoint, review and consider sizing up equity
  positions.
- **$1,000** realized gains → switch to options (RKLB/ASTS/NVDA calls, ITM,
  30-60 DTE expiry), same Option B entry discipline carried over.

## Notes

- GitHub Actions workflow (`.github/workflows/spcx_monitor.yml`) monitors both
  SPCX and JOBY every 5 minutes; disables itself once all positions are sold.
- This file is the durable source of truth for the chain — update it whenever
  the active position, queued order, or milestone progress changes.
