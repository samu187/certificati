import { useMemo, useState } from "react";

const tickerOptions = [
  ["AAPL", "Apple"],
  ["MSFT", "Microsoft"],
  ["NVDA", "NVIDIA"],
  ["AMZN", "Amazon"],
  ["META", "Meta Platforms"],
  ["LLY", "Eli Lilly"],
];

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

function Section({ number, title, children }) {
  return (
    <section className="builderSection">
      <div className="sectionHeading">
        <span>{number}</span>
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
}

export function StrategyBuilder({ isOpen, onClose, onRun }) {
  const [basketMode, setBasketMode] = useState("random");
  const [basketSize, setBasketSize] = useState(3);
  const [selectedTickers, setSelectedTickers] = useState(["AAPL", "MSFT", "NVDA"]);
  const [tickerQuery, setTickerQuery] = useState("");

  const filteredTickers = useMemo(() => {
    const query = tickerQuery.trim().toLowerCase();
    if (!query) return tickerOptions;
    return tickerOptions.filter(([ticker, name]) =>
      `${ticker} ${name}`.toLowerCase().includes(query),
    );
  }, [tickerQuery]);

  function toggleTicker(ticker) {
    setSelectedTickers((current) => {
      if (current.includes(ticker)) return current.filter((item) => item !== ticker);
      return current.length === 5 ? current : [...current, ticker];
    });
  }

  return (
    <aside className={`strategyBuilder ${isOpen ? "isOpen" : ""}`} aria-hidden={!isOpen}>
      <div className="builderTopbar">
        <div>
          <p className="eyebrow">Strategy builder</p>
          <h2>Set up a backtest</h2>
        </div>
        <button className="iconButton" type="button" onClick={onClose} aria-label="Close strategy builder">
          <CloseIcon />
        </button>
      </div>

      <div className="builderContent">
        <Section number="1" title="Maturity ladder">
          <p className="fieldHint">
            New trades use the least represented original term in this monthly range.
          </p>
          <div className="maturityInputs">
            <label>
              From
              <div className="inputWithUnit"><input defaultValue="6" inputMode="numeric" /><span>months</span></div>
            </label>
            <span className="inputDivider">to</span>
            <label>
              To
              <div className="inputWithUnit"><input defaultValue="12" inputMode="numeric" /><span>months</span></div>
            </label>
          </div>
          <div className="termChips" aria-label="Maturity buckets">
            {[6, 7, 8, 9, 10, 11, 12].map((month) => <span key={month}>{month} mo</span>)}
          </div>
        </Section>

        <Section number="2" title="Basket">
          <div className="modeSwitch" role="group" aria-label="Basket mode">
            <button type="button" className={basketMode === "random" ? "selected" : ""} onClick={() => setBasketMode("random")}>Random</button>
            <button type="button" className={basketMode === "custom" ? "selected" : ""} onClick={() => setBasketMode("custom")}>Custom</button>
          </div>

          {basketMode === "random" ? (
            <div className="basketSizePicker">
              <span>Underlyings per certificate</span>
              <div>
                {[1, 2, 3, 4, 5].map((size) => (
                  <button key={size} className={basketSize === size ? "selected" : ""} type="button" onClick={() => setBasketSize(size)}>{size}</button>
                ))}
              </div>
            </div>
          ) : (
            <div className="tickerPicker">
              <label>
                Search available tickers
                <input value={tickerQuery} onChange={(event) => setTickerQuery(event.target.value)} placeholder="Search by ticker or company" />
              </label>
              <p className="fieldHint">Choose between one and five names. This list will use the local ticker database.</p>
              <div className="tickerOptions">
                {filteredTickers.map(([ticker, name]) => {
                  const isSelected = selectedTickers.includes(ticker);
                  return (
                    <button key={ticker} type="button" className={isSelected ? "selected" : ""} onClick={() => toggleTicker(ticker)}>
                      <strong>{ticker}</strong><span>{name}</span><i>{isSelected ? "Selected" : "Add"}</i>
                    </button>
                  );
                })}
              </div>
              <div className="selectedTickers" aria-label="Selected tickers">
                {selectedTickers.map((ticker) => <span key={ticker}>{ticker}</span>)}
              </div>
            </div>
          )}
        </Section>

        <Section number="3" title="Certificate terms">
          <div className="fieldGrid">
            <label>Barrier (%)<input defaultValue="60" inputMode="decimal" /></label>
            <label>Airbag<select defaultValue="yes"><option value="yes">Yes</option><option value="no">No</option></select></label>
            <label>Coupon (% p.a.)<input defaultValue="20" inputMode="decimal" /></label>
            <label>Coupon trigger (%)<input defaultValue="75" inputMode="decimal" /></label>
            <label>Autocall first level (%)<input defaultValue="90" inputMode="decimal" /></label>
            <label>Autocall step-down (%)<input defaultValue="5" inputMode="decimal" /></label>
            <label>Autocall floor (%)<input defaultValue="75" inputMode="decimal" /></label>
          </div>
        </Section>

        <Section number="4" title="Backtest settings">
          <div className="fieldGrid twoColumns">
            <label>Start date<input type="date" defaultValue="2016-01-04" /></label>
            <label>End date<input type="date" defaultValue="2026-07-31" /></label>
            <label>Target open trades<input defaultValue="60" inputMode="numeric" /></label>
            <label>Initial capital<input defaultValue="1000000" inputMode="decimal" /></label>
            <label>Risk-free rate (% p.a.)<input defaultValue="5" inputMode="decimal" /></label>
          </div>
        </Section>
      </div>

      <div className="builderFooter">
        <p>{basketMode === "random" ? `Random basket · ${basketSize} names` : `Custom basket · ${selectedTickers.length} names`}</p>
        <button className="runButton" type="button" onClick={onRun}>Run backtest</button>
      </div>
    </aside>
  );
}
