import typer
from pathlib import Path
from platformdirs import user_data_path

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
        # Launches web app if no command is supplied
        run_web(database_path)


@app.command()
def web(context: typer.Context) -> None:
    # Launches local web app
    run_web(database_path)


@app.command()
def mcp() -> None:
    # Placeholder for MCP server
    typer.echo("mcp not yet developed")


@app.command()
def backtest() -> None:
    # Placeholder for CLI backtesting command
    typer.echo("cli command not yet developed")



def main() -> None:
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
    app()


if __name__ == "__main__":
    main()
