"""Typer command-line entry point for Certificati."""

from pathlib import Path
import typer
from platformdirs import user_data_path

from certificati.backtest import run_backtest
from certificati.database import DatabaseDownloadDeclined, check_database
from certificati.results import save_backtest_result
from certificati.web import run_web

data_dir = Path(user_data_path("Certificati", appauthor=False))
database_path = data_dir / "russell_prices.sqlite"



app = typer.Typer(
    no_args_is_help=False,
    help="Certificati local structured-products backtesting tools.",
)


@app.callback(invoke_without_command=True)
def default_command(context: typer.Context) -> None:
    if context.invoked_subcommand is None:
        _require_database()
        run_web(database_path)


@app.command()
def web() -> None:
    """Run the web application."""
    _require_database()
    run_web(database_path)


@app.command()
def mcp() -> None:
    """MCP Server placeholder."""
    typer.echo("mcp not yet developed")


@app.command()
def backtest(
    tickers: list[str] | None = typer.Argument(
        None, help="Optional custom basket, for example: AAPL META NVDA."
    ),
    start_date: str = typer.Option("2016-01-04", help="Backtest start date (YYYY-MM-DD)."),
    end_date: str = typer.Option("2026-07-31", help="Backtest end date (YYYY-MM-DD)."),
    target_open_trades: int = typer.Option(60, min=1),
    min_maturity_months: int = typer.Option(6, min=1),
    max_maturity_months: int = typer.Option(12, min=1),
    barrier: float = typer.Option(60.0, min=0.01, help="Barrier as a percentage."),
    airbag: bool = typer.Option(True, "--airbag/--no-airbag"),
    autocall: bool = typer.Option(False, "--autocall/--no-autocall"),
    autocall_level_one: float = typer.Option(90.0, min=0),
    autocall_step_down: float = typer.Option(5.0, min=0),
    autocall_floor: float = typer.Option(70.0, min=0),
    coupon_trigger: bool = typer.Option(False, "--coupon-trigger/--no-coupon-trigger"),
    coupon_trigger_level: float = typer.Option(70.0, min=0),
    annual_coupon: float = typer.Option(0.20, min=0, help="Annual coupon as a decimal."),
    initial_capital: float = typer.Option(1_000_000, min=0.01),
    risk_free_rate: float = typer.Option(0.05, min=0, help="Annual rate as a decimal."),
    random_basket_size: int = typer.Option(3, min=1, max=5),
    seed: int | None = typer.Option(None, help="Optional random seed."),
) -> None:
    """Run the certificate portfolio backtest and save its complete result."""
    _require_database()
    result = run_backtest(
        start_date=start_date,
        end_date=end_date,
        target_open_trades=target_open_trades,
        min_maturity_months=min_maturity_months,
        max_maturity_months=max_maturity_months,
        barrier=barrier,
        airbag=airbag,
        autocall=autocall,
        autocall_level_one=autocall_level_one,
        autocall_step_down=autocall_step_down,
        autocall_floor=autocall_floor,
        coupon_trigger=coupon_trigger,
        coupon_trigger_level=coupon_trigger_level,
        annual_coupon=annual_coupon,
        initial_capital=initial_capital,
        risk_free_rate=risk_free_rate,
        tickers=tickers,
        random_basket_size=random_basket_size,
        database_path=database_path,
        seed=seed,
    )
    result_path = save_backtest_result(result, data_dir)
    _display_backtest_metrics(result, result_path)


@app.command()
def expected_loss(
    tickers: list[str] | None = typer.Argument(
        None, help="Ticker basket to analyse, for example: AAPL META NVDA."
    ),
) -> None:
    """Placeholder for historical rolling worst-of and SPY scenarios."""
    typer.echo("expected-loss is not yet developed")



def _display_backtest_metrics(result: dict, result_path: Path) -> None:
    """Print the same headline realised metrics shown by the web interface."""
    config = result["config"]
    metrics = result["metrics"]
    maturity = metrics["maturity_outcomes"]
    natural_outcomes = metrics["natural_completed_trade_count"]
    basket = ", ".join(config["tickers"]) if config["tickers"] else (
        f"Random ({config['random_basket_size']} underlyings per certificate)"
    )

    typer.echo("\nBacktest complete")
    typer.echo(f"Period:  {config['start_date']} to {config['end_date']}")
    typer.echo(f"Basket:  {basket}")
    typer.echo(f"Saved:   {result_path}")
    typer.echo("\nRealised metrics")
    typer.echo(f"{'Metric':<25} {'Value':>12}  Detail")
    typer.echo(f"{'-' * 25} {'-' * 12}  {'-' * 28}")

    rows = [
        ("Equity annual growth", _percentage(metrics["equity_cagr"], sign=True), ""),
        (
            "Coupon yield p.a.",
            _percentage(metrics["realised_coupon_yield_annualised"], sign=True),
            "",
        ),
        (
            "Capital loss p.a.",
            _percentage(_negative_or_none(metrics["historical_annualised_capital_loss"])),
            "",
        ),
        (
            "Realised return p.a.",
            _percentage(metrics["realised_total_return_annualised"], sign=True),
            "",
        ),
        (
            "Autocalled",
            _percentage(metrics["autocall_rate"]),
            _count_detail(metrics["autocall_count"], natural_outcomes),
        ),
        (
            "At-par maturities",
            _percentage(maturity["at_par_maturity_rate"]),
            _count_detail(maturity["at_par_maturity_count"], maturity["maturity_count"]),
        ),
        (
            "Below-par maturities",
            _percentage(_below_par_rate(maturity)),
            _count_detail(maturity["below_par_maturity_count"], maturity["maturity_count"]),
        ),
        ("Average loss on loss", _percentage(metrics["average_loss_given_loss"]), ""),
    ]
    for label, value, detail in rows:
        typer.echo(f"{label:<25} {value:>12}  {detail}")

    excluded = metrics["end_backtest_close_count"]
    typer.echo(f"\n{natural_outcomes} natural trade outcomes; {excluded} end-of-backtest closures excluded.")


def _percentage(value: float | None, *, sign: bool = False) -> str:
    if value is None:
        return "—"
    prefix = "+" if sign and value > 0 else ""
    return f"{prefix}{value:.1%}"


def _negative_or_none(value: float | None) -> float | None:
    if value is None:
        return None
    return 0.0 if value == 0 else -value


def _below_par_rate(maturity: dict) -> float | None:
    count = maturity["maturity_count"]
    rate = maturity["at_par_maturity_rate"]
    return None if not count or rate is None else 1 - rate


def _count_detail(count: int, total: int) -> str:
    return f"{count} / {total} natural outcomes" if total else "—"



def _require_database() -> None:
    try:
        check_database(
            database_path,
            confirm_download=lambda count: typer.confirm(
                f"Do you want to download historical prices for {count:,} stocks?"
            ),
        )
    except DatabaseDownloadDeclined as error:
        typer.echo(str(error))
        raise typer.Exit() from error


def main() -> None:
    app()


if __name__ == "__main__":
    main()
