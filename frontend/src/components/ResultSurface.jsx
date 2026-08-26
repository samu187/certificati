function EquityChart({ equity }) {
  const values = equity.filter((point) => Number.isFinite(point.equity));
  const width = 860;
  const height = 330;
  const padding = { top: 24, right: 20, bottom: 34, left: 64 };
  const allValues = values.flatMap((point) => [point.equity, point.equity_including_unrealized]);
  const minimum = Math.min(...allValues);
  const maximum = Math.max(...allValues);
  const range = maximum - minimum || 1;
  const x = (index) => padding.left + (index / Math.max(values.length - 1, 1)) * (width - padding.left - padding.right);
  const y = (value) => height - padding.bottom - ((value - minimum) / range) * (height - padding.top - padding.bottom);
  const line = (field) => values.map((point, index) => `${x(index)},${y(point[field])}`).join(" ");
  const midPoint = values[Math.floor(values.length / 2)];

  return <svg className="equityChart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Backtest equity and equity including unrealized profit and loss"><line x1={padding.left} x2={width - padding.right} y1={height - padding.bottom} y2={height - padding.bottom} /><line x1={padding.left} x2={padding.left} y1={padding.top} y2={height - padding.bottom} /><polyline className="equityLine" points={line("equity")} /><polyline className="unrealizedLine" points={line("equity_including_unrealized")} /><text x="5" y={padding.top + 4}>{maximum.toLocaleString(undefined, { maximumFractionDigits: 0 })}</text><text x="5" y={height - padding.bottom}>{minimum.toLocaleString(undefined, { maximumFractionDigits: 0 })}</text><text x={padding.left} y={height - 10}>{values[0].date}</text><text x={width / 2} y={height - 10} textAnchor="middle">{midPoint.date}</text><text x={width - padding.right} y={height - 10} textAnchor="end">{values.at(-1).date}</text></svg>;
}

export function ResultSurface({ isRunning, result, error }) {
  if (isRunning) return <section className="resultSurface loadingSurface" aria-live="polite"><div className="loadingMark"><span /><span /><span /></div><p className="eyebrow">Backtest in progress</p><h2>Building your portfolio history</h2><p>Calculating certificate events, redemptions, and daily equity.</p><div className="loadingSkeletons" aria-hidden="true"><span /><span /><span /></div></section>;
  if (error) return <section className="resultSurface emptyResult"><p className="eyebrow">Backtest unavailable</p><h2>Something needs attention.</h2><p>{error}</p></section>;
  if (result) return <section className="resultSurface resultData"><div className="resultHeading"><div><p className="eyebrow">Backtest results</p><h2>Portfolio equity</h2><p>{result.config.start_date} – {result.config.end_date} · {result.closed_trades.length} closed trades</p></div><div className="chartLegend"><span><i className="equitySwatch" />Equity</span><span><i className="unrealizedSwatch" />Equity incl. unrealized</span></div></div><EquityChart equity={result.equity} /></section>;
  return <section className="resultSurface emptyResult" aria-labelledby="result-title"><p className="eyebrow">Backtest results</p><h2 id="result-title">Your strategy, in one place.</h2><p>Open the builder to define the maturity ladder, basket, certificate terms, and portfolio settings.</p><div className="resultPreview" aria-hidden="true"><span /><span /><span /><span /><span /><span /><span /><span /><span /></div></section>;
}
