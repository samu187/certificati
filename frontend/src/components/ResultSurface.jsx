import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useEffect, useState } from "react";

const money = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function chartValue(value) {
  return money.format(value ?? 0);
}

function indexedValue(value) {
  return `${Number(value ?? 0).toFixed(1)}`;
}

function tradeCouponTotal(trade) {
  return trade.coupons.reduce((total, coupon) => total + coupon.amount, 0);
}

function tradeProfit(trade) {
  return tradeCouponTotal(trade) + trade.redemption - trade.quantity;
}

function percentage(value, { positiveSign = false } = {}) {
  if (value === null || value === undefined) return "—";
  const formatted = `${Math.abs(Number(value) * 100).toFixed(1)}%`;
  if (value < 0) return `−${formatted}`;
  return positiveSign && value > 0 ? `+${formatted}` : formatted;
}

function countRate(count, total) {
  if (!total) return "—";
  return `${count} / ${total}`;
}

function MetricsPanel({ metrics }) {
  if (!metrics) return null;

  const maturity = metrics.maturity_outcomes ?? {};
  const naturalCount = metrics.natural_completed_trade_count ?? 0;
  const historicalCapitalLoss = metrics.historical_annualised_capital_loss;
  const cards = [
    { label: "Equity annual growth", value: percentage(metrics.equity_cagr, { positiveSign: true }), tone: metrics.equity_cagr },
    { label: "Coupon yield p.a.", value: percentage(metrics.realised_coupon_yield_annualised, { positiveSign: true }), tone: metrics.realised_coupon_yield_annualised },
    { label: "Capital loss p.a.", value: percentage(historicalCapitalLoss == null ? null : -historicalCapitalLoss), tone: historicalCapitalLoss == null ? null : -historicalCapitalLoss },
    { label: "Realised return p.a.", value: percentage(metrics.realised_total_return_annualised, { positiveSign: true }), tone: metrics.realised_total_return_annualised },
    { label: "Autocalled", value: percentage(metrics.autocall_rate), detail: countRate(metrics.autocall_count ?? 0, naturalCount) },
    { label: "At-par maturities", value: percentage(maturity.at_par_maturity_rate), detail: countRate(maturity.at_par_maturity_count ?? 0, maturity.maturity_count ?? 0) },
    { label: "Below-par maturities", value: percentage((maturity.maturity_count ?? 0) ? 1 - (maturity.at_par_maturity_rate ?? 0) : null), detail: countRate(maturity.below_par_maturity_count ?? 0, maturity.maturity_count ?? 0) },
    { label: "Average loss on loss", value: percentage(metrics.average_loss_given_loss), tone: metrics.average_loss_given_loss },
  ];

  return <section className="resultCard metricsPanel"><div className="metricsHeading"><div><p className="eyebrow">Realised metrics</p><h3>Performance and outcomes</h3></div><p>{naturalCount} natural trade outcomes · {metrics.end_backtest_close_count ?? 0} end-of-backtest closures excluded</p></div><div className="metricsGrid">{cards.map((card) => <div className="metric" key={card.label}><span>{card.label}</span><strong className={card.tone > 0 ? "positiveMetric" : card.tone < 0 ? "negativeMetric" : ""}>{card.value}</strong>{card.detail && <small>{card.detail}</small>}</div>)}</div></section>;
}

const marketColours = ["#d97706", "#7c3aed", "#0f766e", "#be123c", "#65a30d", "#c2410c"];

function EquityChart({ equity, marketPrices, selectedMarketSeries, marketView, maxMaturityMonths, barrier }) {
  const marketSeries = Object.fromEntries(
    selectedMarketSeries.map((ticker) => {
      const prices = marketPrices[ticker] ?? [];
      const startingPrice = prices[0]?.close;
      const rollingHighs = [];
      const dates = prices.map((point) => new Date(`${point.date}T00:00:00`));
      return [
        ticker,
        new Map(prices.map((point, index) => {
          const windowStart = new Date(dates[index]);
          windowStart.setMonth(windowStart.getMonth() - maxMaturityMonths);
          while (rollingHighs.length && dates[rollingHighs[0]] < windowStart) rollingHighs.shift();
          while (rollingHighs.length && prices[rollingHighs.at(-1)].close <= point.close) rollingHighs.pop();
          rollingHighs.push(index);
          const rollingPeak = prices[rollingHighs[0]].close;
          const value = marketView === "drawdown"
            ? (point.close / rollingPeak) * 100
            : (point.close / startingPrice) * 100;
          return [point.date, value];
        })),
      ];
    }),
  );
  const data = equity.map((point) => ({
    date: point.date,
    equity: point.equity,
    equityIncludingUnrealized: point.equity_including_unrealized,
    ...Object.fromEntries(selectedMarketSeries.map((ticker) => [
      `market_${ticker}`,
      marketSeries[ticker]?.get(point.date),
    ])),
  }));

  return (
    <div className="resultChart">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 18, right: selectedMarketSeries.length ? 26 : 14, bottom: 4, left: 14 }}>
          <CartesianGrid stroke="rgba(37, 99, 235, 0.14)" strokeDasharray="3 5" vertical={false} />
          <XAxis dataKey="date" minTickGap={70} tickLine={false} axisLine={false} />
          <YAxis yAxisId="equity" tickFormatter={chartValue} tickLine={false} axisLine={false} width={72} />
          {selectedMarketSeries.length > 0 && <YAxis yAxisId="market" orientation="right" tickFormatter={indexedValue} tickLine={false} axisLine={false} width={42} />}
          <Tooltip formatter={(value, name) => [name.includes("index)") ? indexedValue(value) : chartValue(value), name]} labelStyle={{ color: "#334155", fontWeight: 700 }} />
          <Legend verticalAlign="top" align="right" iconType="plainline" />
          <Line yAxisId="equity" type="monotone" dataKey="equity" name="Equity" stroke="#2563eb" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
          <Line yAxisId="equity" type="monotone" dataKey="equityIncludingUnrealized" name="Equity incl. unrealized" stroke="#0f766e" strokeWidth={1.6} dot={false} activeDot={{ r: 4 }} />
          {marketView === "drawdown" && selectedMarketSeries.length > 0 && <ReferenceLine yAxisId="market" y={barrier} stroke="#dc2626" strokeDasharray="5 4" label={{ value: `Barrier ${barrier}%`, fill: "#dc2626", fontSize: 11 }} ifOverflow="extendDomain" />}
          {selectedMarketSeries.map((ticker, index) => <Line key={ticker} yAxisId="market" type="monotone" dataKey={`market_${ticker}`} name={`${ticker} (${marketView === "drawdown" ? "drawdown" : "price"} index)`} stroke={marketColours[index % marketColours.length]} strokeWidth={1.35} strokeDasharray="6 4" dot={false} activeDot={{ r: 3 }} connectNulls />)}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function MarketSeriesPicker({ marketPrices, selectedSeries, marketView, onChange, onMarketViewChange }) {
  const tickers = Object.keys(marketPrices);
  if (!tickers.length) return null;

  return <fieldset className="marketSeriesPicker"><legend>Market series</legend><label className="marketViewSelect">View<select value={marketView} onChange={(event) => onMarketViewChange(event.target.value)}><option value="price">Price index</option><option value="drawdown">Rolling drawdown index</option></select></label><div>{tickers.map((ticker) => <label key={ticker}><input type="checkbox" checked={selectedSeries.includes(ticker)} onChange={() => onChange(ticker)} /> <span>{ticker}</span></label>)}</div></fieldset>;
}

function shiftedMonth(date, months) {
  const value = new Date(`${date}T00:00:00`);
  value.setMonth(value.getMonth() + months);
  return value.toISOString().slice(0, 10);
}

function TradeDetailChart({ trade, marketPrices, marketView, barrier, selectedSeries }) {
  const start = shiftedMonth(trade.trade_date, -1);
  const end = shiftedMonth(trade.redemption_date, 1);
  const events = new Map([[trade.trade_date, 0]]);
  trade.coupons.forEach((coupon) => events.set(coupon.date, (events.get(coupon.date) ?? 0) + coupon.amount));
  events.set(trade.redemption_date, (events.get(trade.redemption_date) ?? 0) + trade.redemption - trade.quantity);
  let cumulativePnl = 0;
  const pnlByDate = new Map([...events.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([date, change]) => {
    cumulativePnl += change;
    return [date, cumulativePnl];
  }));
  const availableUnderlyings = trade.underlyings.filter((underlying) => marketPrices[underlying.name]);
  const series = [
    ...availableUnderlyings.map((underlying) => ({ ticker: underlying.name, base: underlying.strike })),
    ...(marketPrices.SPY ? [{ ticker: "SPY", base: marketPrices.SPY.find((point) => point.date >= trade.trade_date)?.close }] : []),
  ].filter((item) => item.base && selectedSeries.includes(item.ticker));
  const seriesValues = Object.fromEntries(series.map(({ ticker, base }) => {
    const points = (marketPrices[ticker] ?? []).filter((point) => point.date >= start && point.date <= end);
    return [ticker, new Map(points.map((point) => {
      const strikeIndexedValue = (point.close / base) * 100;
      return [point.date, marketView === "drawdown" ? Math.min(strikeIndexedValue, 100) : strikeIndexedValue];
    }))];
  }));
  const dates = [...new Set([...series.flatMap(({ ticker }) => [...seriesValues[ticker].keys()]), ...pnlByDate.keys()])].sort();
  const data = dates.map((date) => ({ date, pnl: pnlByDate.get(date), ...Object.fromEntries(series.map(({ ticker }) => [ticker, seriesValues[ticker].get(date)])) }));

  return <><div className="resultChart tradeDetailChart"><ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ top: 18, right: 26, bottom: 4, left: 14 }}><CartesianGrid stroke="rgba(37, 99, 235, 0.14)" strokeDasharray="3 5" vertical={false} /><XAxis dataKey="date" minTickGap={70} tickLine={false} axisLine={false} /><YAxis yAxisId="pnl" tickFormatter={chartValue} tickLine={false} axisLine={false} width={72} /><YAxis yAxisId="market" orientation="right" tickFormatter={indexedValue} tickLine={false} axisLine={false} width={42} /><Tooltip formatter={(value, name) => [name === "Cumulative P&L" ? chartValue(value) : indexedValue(value), name]} labelStyle={{ color: "#334155", fontWeight: 700 }} /><Legend verticalAlign="top" align="right" iconType="plainline" /><ReferenceLine yAxisId="pnl" y={0} stroke="#94a3b8" strokeDasharray="3 3" /><ReferenceLine yAxisId="market" y={barrier} stroke="#dc2626" strokeDasharray="5 4" label={{ value: `Barrier ${barrier}%`, fill: "#dc2626", fontSize: 11 }} ifOverflow="extendDomain" /><Line yAxisId="pnl" type="stepAfter" dataKey="pnl" name="Cumulative P&L" stroke="#2563eb" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} connectNulls />{series.map(({ ticker }, index) => <Line key={ticker} yAxisId="market" type="monotone" dataKey={ticker} name={ticker} stroke={ticker === "SPY" ? "#64748b" : marketColours[index % marketColours.length]} strokeWidth={1.35} dot={false} activeDot={{ r: 3 }} connectNulls />)}</LineChart></ResponsiveContainer></div>{availableUnderlyings.length < trade.underlyings.length && <p className="tradeDataNote">Underlying histories are not returned for random-basket trades yet. SPY is shown as the market reference.</p>}</>;
}

function TradeSeriesPicker({ availableSeries, selectedSeries, onToggle }) {
  return <fieldset className="tradeSeriesPicker"><legend>Series</legend><div>{availableSeries.map((ticker) => <label key={ticker}><input type="checkbox" checked={selectedSeries.includes(ticker)} onChange={() => onToggle(ticker)} /><span>{ticker}</span></label>)}</div></fieldset>;
}

function TradeDetail({ trade, tradeIndex, marketPrices, marketView, barrier, selectedSeries, onBack, onMarketViewChange, onToggleSeries }) {
  const availableSeries = [...new Set(["SPY", ...trade.underlyings.map((underlying) => underlying.name)])].filter((ticker) => marketPrices[ticker]);
  return <div className="resultCard chartCard tradeDetail"><div className="resultHeading"><div><p className="eyebrow">Trade {tradeIndex + 1}</p><h2>Certificate detail</h2><p>{trade.trade_date} – {trade.redemption_date} · {trade.underlyings.map((underlying) => underlying.name).join(", ")}</p></div><div className="tradeDetailControls"><TradeSeriesPicker availableSeries={availableSeries} selectedSeries={selectedSeries} onToggle={onToggleSeries} /><label className="marketViewSelect">View<select value={marketView} onChange={(event) => onMarketViewChange(event.target.value)}><option value="price">Price index</option><option value="drawdown">Rolling drawdown index</option></select></label><button className="backToPortfolio" type="button" onClick={onBack}>Portfolio equity</button></div></div><TradeDetailChart trade={trade} marketPrices={marketPrices} marketView={marketView} barrier={barrier} selectedSeries={selectedSeries} /></div>;
}

function ClosedTradesTable({ trades, selectedTradeIndex, onSelectTrade }) {
  return (
    <section className="tradesCard">
      <div className="tradesHeading">
        <div>
          <p className="eyebrow">Closed trades</p>
          <h3>{trades.length} completed certificates</h3>
        </div>
      </div>
      <div className="tradesTableWrap">
        <table className="tradesTable">
          <thead>
            <tr><th>Trade</th><th>Opened</th><th>Closed</th><th>Term</th><th>Basket</th><th>Reason</th><th>Coupon</th><th>Quantity</th><th>Redemption</th><th>P&amp;L</th></tr>
          </thead>
          <tbody>
            {trades.map((trade, index) => {
              const profit = tradeProfit(trade);
              return (
                <tr key={`${trade.trade_date}-${index}`} className={selectedTradeIndex === index ? "selected" : ""}>
                  <td><button className="tradeSelectButton" type="button" onClick={() => onSelectTrade(index)} aria-label={`Show details for trade ${index + 1}`}>{index + 1}</button></td>
                  <td>{trade.trade_date}</td>
                  <td>{trade.redemption_date}</td>
                  <td>{trade.maturity_months} mo</td>
                  <td>{trade.underlyings.map((underlying) => underlying.name).join(", ")}</td>
                  <td>{trade.reason_for_redemption}</td>
                  <td>{money.format(tradeCouponTotal(trade))}</td>
                  <td>{money.format(trade.quantity)}</td>
                  <td>{money.format(trade.redemption)}</td>
                  <td className={profit >= 0 ? "positivePnl" : "negativePnl"}>{money.format(profit)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function ResultSurface({ isRunning, result, error, onOpenBuilder }) {
  const [selectedMarketSeries, setSelectedMarketSeries] = useState([]);
  const [marketView, setMarketView] = useState("price");
  const [selectedTradeIndex, setSelectedTradeIndex] = useState(null);
  const [selectedTradeSeries, setSelectedTradeSeries] = useState([]);
  useEffect(() => {
    setSelectedMarketSeries([]);
    setSelectedTradeIndex(null);
    setSelectedTradeSeries([]);
  }, [result]);

  function toggleMarketSeries(ticker) {
    setSelectedMarketSeries((selected) => selected.includes(ticker)
      ? selected.filter((item) => item !== ticker)
      : [...selected, ticker]);
  }

  function selectTrade(index) {
    const trade = result.closed_trades[index];
    const availableSeries = [...new Set(["SPY", ...trade.underlyings.map((underlying) => underlying.name)])]
      .filter((ticker) => result.market_prices?.[ticker]);
    setSelectedTradeSeries(availableSeries);
    setSelectedTradeIndex(index);
  }

  function toggleTradeSeries(ticker) {
    setSelectedTradeSeries((selected) => selected.includes(ticker)
      ? selected.filter((item) => item !== ticker)
      : [...selected, ticker]);
  }

  if (isRunning) return <section className="resultSurface loadingSurface" aria-live="polite"><div className="loadingMark"><span /><span /><span /></div><p className="eyebrow">Backtest in progress</p><h2>Building your portfolio history</h2><p>Calculating certificate events, redemptions, and daily equity.</p><div className="loadingSkeletons" aria-hidden="true"><span /><span /><span /></div></section>;
  if (error) return <section className="resultSurface emptyResult"><p className="eyebrow">Backtest unavailable</p><h2>Something needs attention.</h2><p>{error}</p></section>;
  if (result) { const selectedTrade = selectedTradeIndex === null ? null : result.closed_trades[selectedTradeIndex]; return <section className="resultData">{selectedTrade ? <TradeDetail trade={selectedTrade} tradeIndex={selectedTradeIndex} marketPrices={result.market_prices ?? {}} marketView={marketView} barrier={result.config.barrier} selectedSeries={selectedTradeSeries} onBack={() => setSelectedTradeIndex(null)} onMarketViewChange={setMarketView} onToggleSeries={toggleTradeSeries} /> : <><MetricsPanel metrics={result.metrics} /><div className="resultCard chartCard"><div className="resultHeading"><div><p className="eyebrow">Backtest results</p><h2>Portfolio equity</h2><p>{result.config.start_date} – {result.config.end_date} · {result.closed_trades.length} closed trades</p></div><MarketSeriesPicker marketPrices={result.market_prices ?? {}} selectedSeries={selectedMarketSeries} marketView={marketView} onChange={toggleMarketSeries} onMarketViewChange={setMarketView} /></div><EquityChart equity={result.equity} marketPrices={result.market_prices ?? {}} selectedMarketSeries={selectedMarketSeries} marketView={marketView} maxMaturityMonths={result.config.max_maturity_months} barrier={result.config.barrier} /></div></>}<ClosedTradesTable trades={result.closed_trades} selectedTradeIndex={selectedTradeIndex} onSelectTrade={selectTrade} /></section>; }
  return <section className="resultSurface emptyResult emptyLanding" aria-labelledby="result-title"><div className="emptyLandingCopy"><p className="eyebrow">Run a backtest</p><h2 id="result-title">Nothing to show yet.</h2><p>Open Strategy builder to create a backtest.</p><button className="openBuilderButton" type="button" onClick={onOpenBuilder}>Open Strategy builder</button></div></section>;
}
