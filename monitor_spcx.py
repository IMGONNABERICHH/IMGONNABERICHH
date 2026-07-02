#!/usr/bin/env python3
"""
Agentic account morning monitor — account 903261667
SPCX: sell 0.127559 shares at $187 goal; exit at market after 10:30am ET or if trending down
JOBY: sell 1 share at $9.29 break-even; same cutoff/downtrend rules
"""

import os
import sys
import pyotp
import pytz
import robin_stocks.robinhood as rh
from datetime import datetime, time

ACCOUNT   = "903261667"
SPCX_GOAL = 187.00
JOBY_GOAL = 9.29
CUTOFF    = time(10, 30)
ET        = pytz.timezone("America/New_York")
WATCH     = {"SPCX", "JOBY"}


def login():
    secret = os.environ.get("RH_MFA_CODE", "")
    rh.login(
        os.environ["RH_USERNAME"],
        os.environ["RH_PASSWORD"],
        mfa_code=pyotp.TOTP(secret).now() if secret else None,
        store_session=False,
    )


def open_positions():
    """Returns {symbol: qty} for WATCH symbols still held in the account."""
    held = {}
    for p in rh.account.get_open_stock_positions(account_number=ACCOUNT) or []:
        qty = float(p.get("quantity", 0))
        if qty <= 0:
            continue
        instr = rh.stocks.get_instrument_by_url(p["instrument"])
        sym = (instr or {}).get("symbol", "")
        if sym in WATCH:
            held[sym] = qty
    return held


def get_quote(symbol):
    q = rh.stocks.get_stock_quote_by_symbol(symbol)
    if not q or not q.get("last_trade_price"):
        return None, None
    price = float(q["last_trade_price"])
    prev  = float(q.get("adjusted_previous_close") or q.get("previous_close", price))
    return price, prev


def sell(symbol, qty):
    return rh.orders.order_sell_fractional_by_quantity(
        symbol, float(qty), account_number=ACCOUNT, timeInForce="gfd"
    )


def check_and_sell(symbol, goal, held, past_cutoff):
    price, prev = get_quote(symbol)
    if price is None:
        print(f"{symbol}: quote unavailable")
        return False

    down = price < prev
    print(f"{symbol} ${price:.4f} | prev_close ${prev:.2f} | downtrend={down} | past_cutoff={past_cutoff}")

    if price >= goal:
        print(f"{symbol} GOAL ${goal} HIT — selling")
        o = sell(symbol, held[symbol])
        print(f"{symbol} order: id={o.get('id')} state={o.get('state')}")
        print(f"{symbol} SELL TRIGGERED")
        return True

    if past_cutoff or down:
        reason = "10:30am cutoff" if past_cutoff else "downtrend"
        print(f"{symbol} break-even exit ({reason}) — selling at market ${price:.4f}")
        o = sell(symbol, held[symbol])
        print(f"{symbol} order: id={o.get('id')} state={o.get('state')}")
        print(f"{symbol} SELL TRIGGERED")
        return True

    print(f"{symbol}: holding — ${goal - price:.4f} from goal")
    return False


def main():
    now_et = datetime.now(ET).time()

    if not (time(9, 30) <= now_et <= time(16, 0)):
        print(f"Market closed ({now_et.strftime('%H:%M')} ET) — no action.")
        sys.exit(0)

    past_cutoff = now_et >= CUTOFF
    login()

    held = open_positions()
    print(f"Open positions in {ACCOUNT}: {held}")

    if not held:
        print("ALL POSITIONS SOLD")
        sys.exit(0)

    sold = set(WATCH) - set(held)

    for sym, goal in [("SPCX", SPCX_GOAL), ("JOBY", JOBY_GOAL)]:
        if sym in held:
            if check_and_sell(sym, goal, held, past_cutoff):
                sold.add(sym)

    if sold >= WATCH:
        print("ALL POSITIONS SOLD")


if __name__ == "__main__":
    main()
