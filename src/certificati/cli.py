"""Typer command-line entry point for Certificati."""

import json
from pathlib import Path
import typer
from platformdirs import user_data_path

from certificati.backtest import run_backtest
from certificati.database import DatabaseDownloadDeclined, check_database
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
    """Run the certificate portfolio backtest and print its JSON result."""
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
    typer.echo(json.dumps(result['metrics'], indent=2))


@app.command()
def expected_loss(
    tickers: list[str] | None = typer.Argument(
        None, help="Ticker basket to analyse, for example: AAPL META NVDA."
    ),
) -> None:
    """Placeholder for historical rolling worst-of and SPY scenarios."""
    typer.echo("historical-scenarios is not yet developed")



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
