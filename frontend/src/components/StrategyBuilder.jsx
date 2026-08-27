import { useEffect, useState } from "react";

const initialSettings = {
  min_maturity_months: "6",
  max_maturity_months: "12",
  barrier: "60",
  airbag: true,
  autocall: false,
  annual_coupon: "20",
  coupon_trigger: false,
  coupon_trigger_level: "70",
  autocall_level_one: "90",
  autocall_step_down: "5",
  autocall_floor: "70",
  start_date: "2016-01-04",
  end_date: "2026-07-31",
  target_open_trades: "60",
  initial_capital: "1000000",
  risk_free_rate: "5",
  benchmark: "SPY",
};

function Section({ title, children }) {
  return <section className="builderSection"><div className="sectionHeading"><h2>{title}</h2></div>{children}</section>;
}

export function StrategyBuilder({ isOpen, onRun }) {
  const [settings, setSettings] = useState(initialSettings);
  const [basketMode, setBasketMode] = useState("random");
  const [basketSize, setBasketSize] = useState(3);
  const [selectedTickers, setSelectedTickers] = useState([]);
  const [tickerQuery, setTickerQuery] = useState("");
  const [tickerMatches, setTickerMatches] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [tickerError, setTickerError] = useState("");
  const [formError, setFormError] = useState("");

  const minimum = Number(settings.min_maturity_months);
  const maximum = Number(settings.max_maturity_months);
  const hasValidMaturityRange = Number.isFinite(minimum) && Number.isFinite(maximum) && maximum >= minimum;

  useEffect(() => {
    if (basketMode !== "custom" || !tickerQuery.trim()) {
      setTickerMatches([]);
      setTickerError("");
      return undefined;
    }

    const controller = new AbortController();
    setIsSearching(true);
    setTickerError("");
    fetch(`/api/tickers?query=${encodeURIComponent(tickerQuery)}&limit=20`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Ticker search is unavailable.");
        return response.json();
      })
      .then((matches) => {
        setTickerMatches(matches);
        if (!matches.length) setTickerError(`“${tickerQuery.toUpperCase()}” is not an available ticker.`);
      })
      .catch((error) => {
        if (error.name !== "AbortError") setTickerError(error.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsSearching(false);
      });

    return () => controller.abort();
  }, [basketMode, tickerQuery]);

  function setField(name, value) {
    setSettings((current) => ({ ...current, [name]: value }));
  }

  function toggleTicker(ticker) {
    setSelectedTickers((current) => {
      if (current.includes(ticker)) return current.filter((item) => item !== ticker);
      return current.length === 5 ? current : [...current, ticker];
    });
  }

  function selectTicker(ticker) {
    toggleTicker(ticker);
    setTickerQuery("");
    setTickerMatches([]);
    setTickerError("");
  }

  function addSuggestedTicker() {
    const ticker = tickerMatches[0]?.ticker;
    if (!ticker) return;
    setSelectedTickers((current) => (current.includes(ticker) || current.length === 5 ? current : [...current, ticker]));
    setTickerQuery("");
    setTickerMatches([]);
    setTickerError("");
  }

  function submit() {
    if (basketMode === "custom" && !selectedTickers.length) {
      setFormError("Choose at least one ticker from the search results.");
      return;
    }
    if (!hasValidMaturityRange) {
      setFormError("Choose a valid maturity range.");
      return;
    }

    setFormError("");
    const { benchmark, ...backtestSettings } = settings;
    onRun({
      ...backtestSettings,
      min_maturity_months: Number(settings.min_maturity_months),
      max_maturity_months: Number(settings.max_maturity_months),
      target_open_trades: Number(settings.target_open_trades),
      barrier: Number(settings.barrier),
      annual_coupon: Number(settings.annual_coupon) / 100,
      coupon_trigger_level: Number(settings.coupon_trigger_level),
      autocall_level_one: Number(settings.autocall_level_one),
      autocall_step_down: Number(settings.autocall_step_down),
      autocall_floor: Number(settings.autocall_floor),
      initial_capital: Number(settings.initial_capital),
      risk_free_rate: Number(settings.risk_free_rate) / 100,
      tickers: basketMode === "custom" ? selectedTickers : null,
      random_basket_size: basketSize,
    });
  }

  return (
    <aside className={`strategyBuilder ${isOpen ? "isOpen" : ""}`} aria-hidden={!isOpen}>
      <div className="builderTopbar"><h2>Strategy builder</h2></div>
      <div className="builderContent">
        <Section title="Maturity ladder">
          <p className="fieldHint">New trades use the least represented original term in this monthly range.</p>
          <div className="maturityInputs">
            <label>From<div className="inputWithUnit"><input value={settings.min_maturity_months} onChange={(event) => setField("min_maturity_months", event.target.value)} inputMode="numeric" /><span>months</span></div></label>
            <span className="inputDivider">to</span>
            <label>To<div className="inputWithUnit"><input value={settings.max_maturity_months} onChange={(event) => setField("max_maturity_months", event.target.value)} inputMode="numeric" /><span>months</span></div></label>
          </div>
        </Section>
        <Section title="Basket">
          <div className="modeSwitch" role="group" aria-label="Basket mode"><button type="button" className={basketMode === "random" ? "selected" : ""} onClick={() => setBasketMode("random")}>Random</button><button type="button" className={basketMode === "custom" ? "selected" : ""} onClick={() => setBasketMode("custom")}>Custom</button></div>
          {basketMode === "random" ? <div className="basketSizePicker"><span>Underlyings per certificate</span><div>{[1, 2, 3, 4, 5].map((size) => <button key={size} className={basketSize === size ? "selected" : ""} type="button" onClick={() => setBasketSize(size)}>{size}</button>)}</div></div> : (
            <div className="tickerPicker">
              <label>Search available tickers<input value={tickerQuery} onChange={(event) => setTickerQuery(event.target.value.toUpperCase())} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addSuggestedTicker(); } }} placeholder="Start typing a ticker" autoComplete="off" /></label>
              <p className="fieldHint">Select one to five existing symbols. Typed text alone is never added to the basket.</p>
              {isSearching && <p className="tickerMessage">Searching tickers…</p>}
              {tickerError && <p className="tickerMessage error">{tickerError}</p>}
              {!!tickerMatches.length && <div className="tickerOptions">{tickerMatches.map(({ ticker, first_date: firstDate, last_date: lastDate }) => {
                const isSelected = selectedTickers.includes(ticker);
                return <button key={ticker} type="button" className={isSelected ? "selected" : ""} onClick={() => selectTicker(ticker)}><strong>{ticker}</strong><span>{firstDate} – {lastDate}</span><i>{isSelected ? "Selected" : "Add"}</i></button>;
              })}</div>}
              {!!selectedTickers.length && <div className="selectedTickers" aria-label="Selected tickers">{selectedTickers.map((ticker) => <button key={ticker} type="button" onClick={() => toggleTicker(ticker)}>{ticker} ×</button>)}</div>}
            </div>
          )}
        </Section>
        <Section title="Certificate terms"><div className="fieldGrid">
          <label>Barrier (%)<input value={settings.barrier} onChange={(event) => setField("barrier", event.target.value)} inputMode="decimal" /></label>
          <label>Airbag<select value={String(settings.airbag)} onChange={(event) => setField("airbag", event.target.value === "true")}><option value="true">Yes</option><option value="false">No</option></select></label>
          <label>Coupon (% p.a.)<input value={settings.annual_coupon} onChange={(event) => setField("annual_coupon", event.target.value)} inputMode="decimal" /></label>
          <label>Coupon trigger<select value={String(settings.coupon_trigger)} onChange={(event) => setField("coupon_trigger", event.target.value === "true")}><option value="true">Yes</option><option value="false">No</option></select></label>
          {settings.coupon_trigger && <label>Coupon trigger level (%)<input value={settings.coupon_trigger_level} onChange={(event) => setField("coupon_trigger_level", event.target.value)} inputMode="decimal" /></label>}
          <label>Autocall<select value={String(settings.autocall)} onChange={(event) => setField("autocall", event.target.value === "true")}><option value="true">Yes</option><option value="false">No</option></select></label>
          {settings.autocall && <><label>Autocall first level (%)<input value={settings.autocall_level_one} onChange={(event) => setField("autocall_level_one", event.target.value)} inputMode="decimal" /></label><label>Autocall step-down (%)<input value={settings.autocall_step_down} onChange={(event) => setField("autocall_step_down", event.target.value)} inputMode="decimal" /></label><label>Autocall floor (%)<input value={settings.autocall_floor} onChange={(event) => setField("autocall_floor", event.target.value)} inputMode="decimal" /></label></>}
        </div></Section>
        <Section title="Backtest settings"><div className="fieldGrid twoColumns">
          <label>Start date<input type="date" value={settings.start_date} onChange={(event) => setField("start_date", event.target.value)} /></label>
          <label>End date<input type="date" value={settings.end_date} onChange={(event) => setField("end_date", event.target.value)} /></label>
          <label>Target open trades<input value={settings.target_open_trades} onChange={(event) => setField("target_open_trades", event.target.value)} inputMode="numeric" /></label>
          <label>Initial capital<input value={settings.initial_capital} onChange={(event) => setField("initial_capital", event.target.value)} inputMode="decimal" /></label>
          <label>Risk-free rate (% p.a.)<input value={settings.risk_free_rate} onChange={(event) => setField("risk_free_rate", event.target.value)} inputMode="decimal" /></label>
          <label>Benchmark<select value={settings.benchmark} onChange={(event) => setField("benchmark", event.target.value)} aria-label="Benchmark"><option value="SPY">SPY</option></select></label>
        </div></Section>
      </div>
      <div className="builderFooter"><div><p>{basketMode === "random" ? `Random basket · ${basketSize} names` : `Custom basket · ${selectedTickers.length} names`}</p>{formError && <p className="formError">{formError}</p>}</div><button className="runButton" type="button" onClick={submit}>Run backtest</button></div>
    </aside>
  );
}
