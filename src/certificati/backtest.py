"""Certificate portfolio backtest engine."""

import datetime as dt
from pathlib import Path
import random
import sqlite3

from dateutil.relativedelta import relativedelta


def run_backtest(
    *,
    start_date: str | dt.date,
    end_date: str | dt.date,
    target_open_trades: int,
    min_maturity_months: int,
    max_maturity_months: int,
    barrier: float,
    airbag: bool,
    autocall: bool,
    autocall_level_one: float,
    autocall_step_down: float,
    autocall_floor: float,
    coupon_trigger: bool,
    coupon_trigger_level: float,
    annual_coupon: float,
    initial_capital: float = 1_000_000,
    risk_free_rate: float = 0.05,
    tickers: list[str] | None = None,
    random_basket_size: int = 3,
    database_path: Path,
    seed: int | None = None,
) -> dict:
    """Run one certificate portfolio backtest and return JSON-ready results.

    Pass ``tickers`` for a fixed basket. Leave it as ``None`` to choose a fresh
    random basket for every new certificate.
    """
    start = _as_date(start_date)
    end = _as_date(end_date)
    fixed_tickers = _normalise_tickers(tickers)
    _validate_inputs(
        start=start,
        end=end,
        target_open_trades=target_open_trades,
        min_maturity_months=min_maturity_months,
        max_maturity_months=max_maturity_months,
        barrier=barrier,
        random_basket_size=random_basket_size,
        tickers=fixed_tickers,
    )

    rng = random.Random(seed)
    cash = float(initial_capital)
    open_trades: list[dict] = []
    closed_trades: list[dict] = []
    equity = [_equity_point(start, cash, 0, 0)]
    market_prices: dict[str, list[dict]] = {}

    # Do not issue a certificate that cannot reach its longest selected term.
    last_trade_date = end - relativedelta(months=min_maturity_months)

    with sqlite3.connect(database_path) as database:
        _validate_fixed_tickers(database, fixed_tickers, start, end)

        def price(ticker: str, date: dt.date) -> float:
            row = database.execute(
                """
                SELECT close FROM prices
                WHERE ticker = ? AND date <= ?
                ORDER BY date DESC LIMIT 1
                """,
                (ticker, date.isoformat()),
            ).fetchone()
            if row is None:
                raise RuntimeError(f"No price available for {ticker} on {date.isoformat()}.")
            return float(row[0])

        def random_stock(date: dt.date, excluded_tickers: set[str]) -> str:
            rows = database.execute(
                """
                SELECT ticker FROM tickers
                WHERE first_date <= ? AND last_date > ?
                """,
                (date.isoformat(), date.isoformat()),
            ).fetchall()
            eligible_tickers = [ticker for (ticker,) in rows if ticker not in excluded_tickers]
            if not eligible_tickers:
                raise RuntimeError(f"No eligible stocks available on {date.isoformat()}.")
            return rng.choice(eligible_tickers)

        def create_certificate(date: dt.date, quantity: float) -> None:
            basket_tickers = fixed_tickers or _random_basket(
                date, random_basket_size, random_stock
            )
            underlyings = [
                {
                    "name": ticker,
                    "strike": price(ticker, date),
                    "current": price(ticker, date),
                }
                for ticker in basket_tickers
            ]
            maturity_months = _least_represented_maturity_month(
                open_trades,
                min_maturity_months,
                max_maturity_months,
                rng,
            )
            observation_day = rng.randint(1, 28)
            maturity_date = (date + relativedelta(months=maturity_months)).replace(
                day=observation_day
            )
            observation_date = (date + relativedelta(months=1)).replace(
                day=observation_day
            )
            open_trades.append(
                {
                    "trade_date": date,
                    "quantity": quantity,
                    "underlyings": underlyings,
                    "maturity_months": maturity_months,
                    "maturity_date": maturity_date,
                    "observation_day": observation_day,
                    "last_coupon_date": date,
                    "next_observation_date": observation_date,
                    "autocall_level": autocall_level_one,
                    "coupons": [],
                    "unrealized": 0.0,
                }
            )

        def worst_performance(trade: dict, date: dt.date) -> float:
            performances = []
            for underlying in trade["underlyings"]:
                current_price = price(underlying["name"], date)
                underlying["current"] = current_price
                performances.append(current_price / underlying["strike"] * 100)
            return min(performances)

        def pay_coupon(trade: dict, date: dt.date, performance: float) -> float:
            if coupon_trigger and performance < coupon_trigger_level:
                return 0.0
            amount = trade["quantity"] * annual_coupon * (
                (date - trade["last_coupon_date"]).days / 365
            )
            trade["coupons"].append({"date": date, "amount": amount})
            return amount

        def close_trade(
            trade: dict,
            date: dt.date,
            performance: float,
            reason: str,
            autocalled: bool = False,
        ) -> float:
            if autocalled or performance >= barrier:
                redemption = trade["quantity"]
            elif airbag:
                redemption = trade["quantity"] * performance / barrier
            else:
                redemption = trade["quantity"] * performance / 100

            trade.update(
                unrealized=0.0,
                redemption_date=date,
                redemption=redemption,
                worst_performance_at_redemption=performance,
                reason_for_redemption=reason,
            )
            open_trades.remove(trade)
            closed_trades.append(trade)
            return redemption

        today = start
        while today < end:
            for trade in open_trades[:]:
                performance = worst_performance(trade, today)

                if trade["maturity_date"] == today:
                    cash += pay_coupon(trade, today, performance)
                    cash += close_trade(trade, today, performance, "Maturity")
                    continue

                if trade["next_observation_date"] == today:
                    cash += pay_coupon(trade, today, performance)
                    if autocall and performance >= trade["autocall_level"]:
                        cash += close_trade(
                            trade,
                            today,
                            performance,
                            f"Autocall {trade['autocall_level']}",
                            autocalled=True,
                        )
                        continue
                    trade["last_coupon_date"] = today
                    trade["next_observation_date"] = today + relativedelta(months=1)
                    if autocall:
                        trade["autocall_level"] = max(
                            autocall_floor,
                            trade["autocall_level"] - autocall_step_down,
                        )

                trade["unrealized"] = _unrealized_loss(
                    trade["quantity"], performance, barrier, airbag
                )

            new_trade_count = target_open_trades - len(open_trades)
            if new_trade_count > 0 and today <= last_trade_date:
                quantity = cash / new_trade_count
                for _ in range(new_trade_count):
                    create_certificate(today, quantity)
                    cash -= quantity

            open_trade_value = sum(trade["quantity"] for trade in open_trades)
            unrealized_value = sum(trade["unrealized"] for trade in open_trades)
            equity.append(_equity_point(today, cash, open_trade_value, unrealized_value))
            today += dt.timedelta(days=1)

        # Close all open trades at the end of the backtest period
        for trade in open_trades[:]:
            performance = worst_performance(trade, today)
            cash += pay_coupon(trade, today, performance)
            cash += close_trade(trade, today, performance, "End Backtest")
        equity.append(_equity_point(today, cash, 0, 0))
        market_prices = _market_prices(database, start, end, fixed_tickers)

        # Calculate performance metrics
        # metrics = calc_metrics(equity, closed_trades, initial_capital, risk_free_rate)

    return _serialise(
        {
            "config": {
                "start_date": start,
                "end_date": end,
                "target_open_trades": target_open_trades,
                "min_maturity_months": min_maturity_months,
                "max_maturity_months": max_maturity_months,
                "barrier": barrier,
                "airbag": airbag,
                "autocall": autocall,
                "autocall_level_one": autocall_level_one,
                "autocall_step_down": autocall_step_down,
                "autocall_floor": autocall_floor,
                "coupon_trigger": coupon_trigger,
                "coupon_trigger_level": coupon_trigger_level,
                "annual_coupon": annual_coupon,
                "initial_capital": initial_capital,
                "risk_free_rate": risk_free_rate,
                "tickers": fixed_tickers,
                "random_basket_size": random_basket_size,
            },
            "equity": equity,
            "closed_trades": closed_trades,
            "market_prices": market_prices,
        }
    )


def _random_basket(date: dt.date, size: int, choose_ticker) -> list[str]:
    selected_tickers: list[str] = []
    while len(selected_tickers) < size:
        ticker = choose_ticker(date, set(selected_tickers))
        if ticker not in selected_tickers:
            selected_tickers.append(ticker)
    return list(selected_tickers)


def _market_prices(
    database: sqlite3.Connection,
    start: dt.date,
    end: dt.date,
    fixed_tickers: list[str] | None,
) -> dict[str, list[dict]]:
    """Return benchmark prices, plus the selected custom basket when applicable."""
    requested_tickers = ["SPY", *(fixed_tickers or [])]
    price_series: dict[str, list[dict]] = {}

    for ticker in requested_tickers:
        table = "spy" if ticker == "SPY" else "prices"
        ticker_filter = "" if ticker == "SPY" else "AND ticker = ?"
        parameters = [start.isoformat(), end.isoformat()]
        if ticker != "SPY":
            parameters.append(ticker)
        rows = database.execute(
            f"""
            SELECT date, close
            FROM {table}
            WHERE date >= ? AND date <= ? {ticker_filter}
            ORDER BY date
            """,
            parameters,
        ).fetchall()
        if not rows:
            raise RuntimeError(f"No market prices available for {ticker} in the selected period.")
        price_series[ticker] = [
            {"date": price_date, "close": float(close)}
            for price_date, close in rows
            if close is not None
        ]

    return price_series


def _least_represented_maturity_month(
    open_trades: list[dict],
    minimum: int,
    maximum: int,
    rng: random.Random,
) -> int:
    """Choose the least-used original maturity term; break ties at random."""
    months = range(minimum, maximum + 1)
    counts = {
        month: sum(trade["maturity_months"] == month for trade in open_trades)
        for month in months
    }
    smallest_count = min(counts.values())
    least_represented = [
        month for month, count in counts.items() if count == smallest_count
    ]
    return rng.choice(least_represented)


def _validate_fixed_tickers(
    database: sqlite3.Connection,
    tickers: list[str] | None,
    start: dt.date,
    end: dt.date,
) -> None:
    if not tickers:
        return
    placeholders = ", ".join("?" for _ in tickers)
    rows = database.execute(
        f"SELECT ticker, first_date, last_date FROM tickers WHERE ticker IN ({placeholders})",
        tickers,
    ).fetchall()
    availability = {ticker: (first_date, last_date) for ticker, first_date, last_date in rows}
    unavailable = [
        ticker
        for ticker in tickers
        if ticker not in availability
        or availability[ticker][0] is None
        or availability[ticker][0] > start.isoformat()
        or availability[ticker][1] < end.isoformat()
    ]
    if unavailable:
        raise ValueError(
            "The selected tickers do not cover the full backtest period: "
            + ", ".join(unavailable)
        )


def _validate_inputs(**values) -> None:
    if values["end"] <= values["start"]:
        raise ValueError("End date must be after start date.")
    if values["target_open_trades"] < 1:
        raise ValueError("Target open trades must be at least one.")
    if not 1 <= values["min_maturity_months"] <= values["max_maturity_months"]:
        raise ValueError("Maturity months must be a valid minimum/maximum range.")
    if values["barrier"] <= 0:
        raise ValueError("Barrier must be greater than zero.")
    if not 1 <= values["random_basket_size"] <= 5:
        raise ValueError("Random basket size must be between one and five.")
    if values["tickers"] is not None and not 1 <= len(values["tickers"]) <= 5:
        raise ValueError("A custom basket must contain between one and five tickers.")


def _normalise_tickers(tickers: list[str] | None) -> list[str] | None:
    if tickers is None:
        return None
    cleaned = [ticker.strip().upper() for ticker in tickers if ticker.strip()]
    if not cleaned:
        raise ValueError("A custom basket must contain between one and five tickers.")
    if len(cleaned) != len(set(cleaned)):
        raise ValueError("Custom basket tickers must be distinct.")
    return cleaned


def _unrealized_loss(quantity: float, performance: float, barrier: float, airbag: bool) -> float:
    if performance >= barrier:
        return 0.0
    denominator = barrier if airbag else 100
    return quantity * (performance / denominator - 1)


def _equity_point(date: dt.date, cash: float, open_trades: float, unrealized: float) -> dict:
    return {
        "date": date,
        "cash": cash,
        "open_trades": open_trades,
        "equity": cash + open_trades,
        "unrealized_pnl": unrealized,
        "equity_including_unrealized": cash + open_trades + unrealized,
    }


def _as_date(value: str | dt.date) -> dt.date:
    return value if isinstance(value, dt.date) else dt.date.fromisoformat(value)


def _serialise(value):
    if isinstance(value, dt.date):
        return value.isoformat()
    if isinstance(value, list):
        return [_serialise(item) for item in value]
    if isinstance(value, dict):
        return {key: _serialise(item) for key, item in value.items()}
    return value
