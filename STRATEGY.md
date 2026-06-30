# Perpetual Trading Chain — Strategy

Account: 903261667
Approach: Option B — always wait for pullback entry, never chase.

## Active Positions / Orders

- **SPCX**: 0.127559 shares — sell at market when `last_trade_price >= $187`
- **JOBY**: GTC limit buy, 1 share @ **$8.55** — queued, order id `6a4423a5`

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

- GitHub Actions workflow (`.github/workflows/spcx_monitor.yml`) independently
  monitors SPCX for the $187 sell trigger, as a session-independent backstop.
- This file is the durable source of truth for the chain — update it whenever
  the active position, queued order, or milestone progress changes.
