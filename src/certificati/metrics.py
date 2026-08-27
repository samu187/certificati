"""Performance metrics calculated from a completed certificate backtest."""

import datetime as dt
from collections.abc import Sequence
from typing import Any


END_BACKTEST_REASON = "End Backtest"
_FLOAT_TOLERANCE = 1e-9


def calc_metrics(
    equity: Sequence[dict[str, Any]],
    closed_trades: Sequence[dict[str, Any]],
    initial_capital: float,
    risk_free_rate: float,
) -> dict[str, Any]:
    """Return JSON-ready realised performance and product-outcome metrics.

    Trade metrics use only certificates that reached a natural outcome. Trades
    closed solely because the backtest ended are reported separately and do not
    affect coupon, redemption, autocall, or loss statistics. Annualised trade
    metrics use actual capital-years, which accounts for early autocalls.
    """
    del risk_free_rate  # Reserved for future risk-adjusted metrics.

    natural_trades = [
        trade
        for trade in closed_trades
        if trade["reason_for_redemption"] != END_BACKTEST_REASON
    ]
    end_backtest_close_count = len(closed_trades) - len(natural_trades)
    capital_years = sum(_capital_years(trade) for trade in natural_trades)
    total_coupons = sum(_coupon_total(trade) for trade in natural_trades)
    capital_redemption_pnl = sum(
        float(trade["redemption"]) - float(trade["quantity"])
        for trade in natural_trades
    )
    loss_trades = [
        trade
        for trade in natural_trades
        if float(trade["redemption"]) < float(trade["quantity"]) - _FLOAT_TOLERANCE
    ]
    maturity_trades = [
        trade for trade in natural_trades if trade["reason_for_redemption"] == "Maturity"
    ]
    at_par_maturity_trades = [
        trade
        for trade in maturity_trades
        if abs(float(trade["redemption"]) - float(trade["quantity"])) <= _FLOAT_TOLERANCE
    ]
    autocall_trades = [
        trade for trade in natural_trades if trade["reason_for_redemption"].startswith("Autocall ")
    ]

    coupon_yield = _per_capital_year(total_coupons, capital_years)
    capital_redemption_return = _per_capital_year(capital_redemption_pnl, capital_years)

    return {
        "equity_cagr": _equity_cagr(equity, initial_capital),
        "realised_coupon_yield_annualised": coupon_yield,
        "capital_redemption_return_annualised": capital_redemption_return,
        "historical_annualised_capital_loss": _per_capital_year(
            sum(float(trade["quantity"]) - float(trade["redemption"]) for trade in loss_trades),
            capital_years,
        ),
        "realised_total_return_annualised": _per_capital_year(
            total_coupons + capital_redemption_pnl, capital_years
        ),
        "autocall_rate": _ratio(len(autocall_trades), len(natural_trades)),
        "autocall_count": len(autocall_trades),
        "loss_event_rate": _ratio(len(loss_trades), len(natural_trades)),
        "loss_event_count": len(loss_trades),
        "average_loss_given_loss": _average(
            [float(trade["redemption"]) / float(trade["quantity"]) - 1 for trade in loss_trades]
        ),
        "average_holding_days": _average(
            [_holding_days(trade) for trade in natural_trades]
        ),
        "natural_completed_trade_count": len(natural_trades),
        "end_backtest_close_count": end_backtest_close_count,
        "maturity_outcomes": {
            "maturity_count": len(maturity_trades),
            "at_par_maturity_count": len(at_par_maturity_trades),
            "below_par_maturity_count": len(maturity_trades) - len(at_par_maturity_trades),
            "at_par_maturity_rate": _ratio(
                len(at_par_maturity_trades), len(maturity_trades)
            ),
        },
    }


def _coupon_total(trade: dict[str, Any]) -> float:
    return sum(float(coupon["amount"]) for coupon in trade["coupons"])


def _holding_days(trade: dict[str, Any]) -> int:
    return (_as_date(trade["redemption_date"]) - _as_date(trade["trade_date"])).days


def _capital_years(trade: dict[str, Any]) -> float:
    return float(trade["quantity"]) * _holding_days(trade) / 365


def _equity_cagr(equity: Sequence[dict[str, Any]], initial_capital: float) -> float | None:
    if len(equity) < 2:
        return None
    elapsed_days = (_as_date(equity[-1]["date"]) - _as_date(equity[0]["date"])).days
    final_equity = float(equity[-1]["equity"])
    if elapsed_days <= 0 or initial_capital <= 0 or final_equity < 0:
        return None
    return (final_equity / initial_capital) ** (365 / elapsed_days) - 1


def _per_capital_year(value: float, capital_years: float) -> float | None:
    return value / capital_years if capital_years > 0 else None


def _ratio(numerator: int, denominator: int) -> float | None:
    return numerator / denominator if denominator else None


def _average(values: Sequence[float | int]) -> float | None:
    return sum(values) / len(values) if values else None


def _as_date(value: str | dt.date) -> dt.date:
    return value if isinstance(value, dt.date) else dt.date.fromisoformat(value)
