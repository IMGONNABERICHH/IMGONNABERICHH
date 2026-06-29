#!/usr/bin/env python3
"""
SPCX price monitor — sells 0.127559 shares from account 903261667
when SPCX last_trade_price >= 187.00.
"""

import os
import sys
import pyotp
import robin_stocks.robinhood as rh

TARGET_PRICE = 187.00
SYMBOL = "SPCX"
ACCOUNT_NUMBER = "903261667"
QUANTITY = "0.127559"


def login():
    username = os.environ["RH_USERNAME"]
    password = os.environ["RH_PASSWORD"]
    totp_secret = os.environ.get("RH_MFA_CODE", "")

    mfa_code = pyotp.TOTP(totp_secret).now() if totp_secret else None
    rh.login(username, password, mfa_code=mfa_code, store_session=False)


def get_price():
    quotes = rh.stocks.get_latest_price(SYMBOL, priceType="ask_price", includeExtendedHours=False)
    if not quotes or quotes[0] is None:
        raise ValueError(f"No quote returned for {SYMBOL}")
    return float(quotes[0])


def sell():
    return rh.orders.order_sell_fractional_by_quantity(
        SYMBOL,
        float(QUANTITY),
        account_number=ACCOUNT_NUMBER,
        timeInForce="gfd",
    )


def main():
    login()

    try:
        price = get_price()
    except ValueError as e:
        print(f"Quote unavailable (market may be closed): {e}")
        sys.exit(0)

    print(f"SPCX current price: ${price:.4f} (target: ${TARGET_PRICE})")

    if price >= TARGET_PRICE:
        print(f"Price ${price:.4f} >= ${TARGET_PRICE} — placing sell order...")
        order = sell()
        order_id = order.get("id", "unknown")
        state = order.get("state", "unknown")
        print(f"Order placed: id={order_id} state={state}")
        print(f"SELL TRIGGERED: SPCX @ ${price:.4f}")
    else:
        gap = TARGET_PRICE - price
        print(f"Below target by ${gap:.4f} — no action.")


if __name__ == "__main__":
    main()
