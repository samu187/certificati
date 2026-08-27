import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
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

const marketColours = ["#8b5e34", "#6f5aa5", "#bd6b48", "#286b91", "#9c5a78", "#477557"];

function EquityChart({ equity, marketPrices, selectedMarketSeries }) {
  const marketSeries = Object.fromEntries(
    selectedMarketSeries.map((ticker) => {
      const prices = marketPrices[ticker] ?? [];
      const startingPrice = prices[0]?.close;
      return [
        ticker,
        new Map(prices.map((point) => [point.date, (point.close / startingPrice) * 100])),
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
          <CartesianGrid stroke="rgba(75, 36, 21, 0.12)" strokeDasharray="3 5" vertical={false} />
          <XAxis dataKey="date" minTickGap={70} tickLine={false} axisLine={false} />
          <YAxis yAxisId="equity" tickFormatter={chartValue} tickLine={false} axisLine={false} width={72} />
          {selectedMarketSeries.length > 0 && <YAxis yAxisId="market" orientation="right" tickFormatter={indexedValue} tickLine={false} axisLine={false} width={42} />}
          <Tooltip formatter={(value, name) => [name.endsWith("(indexed)") ? indexedValue(value) : chartValue(value), name]} labelStyle={{ color: "#5d685f", fontWeight: 700 }} />
          <Legend verticalAlign="top" align="right" iconType="plainline" />
          <Line yAxisId="equity" type="monotone" dataKey="equity" name="Equity" stroke="#4b2415" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
          <Line yAxisId="equity" type="monotone" dataKey="equityIncludingUnrealized" name="Equity incl. unrealized" stroke="#287062" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
          {selectedMarketSeries.map((ticker, index) => <Line key={ticker} yAxisId="market" type="monotone" dataKey={`market_${ticker}`} name={`${ticker} (indexed)`} stroke={marketColours[index % marketColours.length]} strokeWidth={2} strokeDasharray="6 4" dot={false} activeDot={{ r: 3 }} connectNulls />)}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function MarketSeriesPicker({ marketPrices, selectedSeries, onChange }) {
  const tickers = Object.keys(marketPrices);
  if (!tickers.length) return null;

  return <fieldset className="marketSeriesPicker"><legend>Prices</legend><div>{tickers.map((ticker) => <label key={ticker}><input type="checkbox" checked={selectedSeries.includes(ticker)} onChange={() => onChange(ticker)} /> <span>{ticker}</span></label>)}</div></fieldset>;
}

function ClosedTradesTable({ trades }) {
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
            <tr><th>Trade</th><th>Opened</th><th>Closed</th><th>Term</th><th>Basket</th><th>Reason</th><th>Coupon</th><th>Redemption</th><th>P&amp;L</th></tr>
          </thead>
          <tbody>
            {trades.map((trade, index) => {
              const profit = tradeProfit(trade);
              return (
                <tr key={`${trade.trade_date}-${index}`}>
                  <td>{index + 1}</td>
                  <td>{trade.trade_date}</td>
                  <td>{trade.redemption_date}</td>
                  <td>{trade.maturity_months} mo</td>
                  <td>{trade.underlyings.map((underlying) => underlying.name).join(", ")}</td>
                  <td>{trade.reason_for_redemption}</td>
                  <td>{money.format(tradeCouponTotal(trade))}</td>
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

export function ResultSurface({ isRunning, result, error }) {
  const [selectedMarketSeries, setSelectedMarketSeries] = useState([]);

  useEffect(() => {
    setSelectedMarketSeries([]);
  }, [result]);

  function toggleMarketSeries(ticker) {
    setSelectedMarketSeries((selected) => selected.includes(ticker)
      ? selected.filter((item) => item !== ticker)
      : [...selected, ticker]);
  }

  if (isRunning) return <section className="resultSurface loadingSurface" aria-live="polite"><div className="loadingMark"><span /><span /><span /></div><p className="eyebrow">Backtest in progress</p><h2>Building your portfolio history</h2><p>Calculating certificate events, redemptions, and daily equity.</p><div className="loadingSkeletons" aria-hidden="true"><span /><span /><span /></div></section>;
  if (error) return <section className="resultSurface emptyResult"><p className="eyebrow">Backtest unavailable</p><h2>Something needs attention.</h2><p>{error}</p></section>;
  if (result) return <section className="resultData"><div className="resultCard chartCard"><div className="resultHeading"><div><p className="eyebrow">Backtest results</p><h2>Portfolio equity</h2><p>{result.config.start_date} – {result.config.end_date} · {result.closed_trades.length} closed trades</p></div><MarketSeriesPicker marketPrices={result.market_prices ?? {}} selectedSeries={selectedMarketSeries} onChange={toggleMarketSeries} /></div><EquityChart equity={result.equity} marketPrices={result.market_prices ?? {}} selectedMarketSeries={selectedMarketSeries} /></div><ClosedTradesTable trades={result.closed_trades} /></section>;
  return <section className="resultSurface emptyResult" aria-labelledby="result-title"><p className="eyebrow">Backtest results</p><h2 id="result-title">Your strategy, in one place.</h2><p>Open the builder to define the maturity ladder, basket, certificate terms, and portfolio settings.</p><div className="resultPreview" aria-hidden="true"><span /><span /><span /><span /><span /><span /><span /><span /><span /></div></section>;
}
