export function ResultSurface({ isRunning }) {
  if (isRunning) {
    return (
      <section className="resultSurface loadingSurface" aria-live="polite">
        <div className="loadingMark"><span /><span /><span /></div>
        <p className="eyebrow">Backtest in progress</p>
        <h2>Building your portfolio history</h2>
        <p>Calculating certificate events, redemptions, and daily equity.</p>
        <div className="loadingSkeletons" aria-hidden="true"><span /><span /><span /></div>
      </section>
    );
  }

  return (
    <section className="resultSurface emptyResult" aria-labelledby="result-title">
      <p className="eyebrow">Backtest results</p>
      <h2 id="result-title">Your strategy, in one place.</h2>
      <p>Open the builder to define the maturity ladder, basket, certificate terms, and portfolio settings.</p>
      <div className="resultPreview" aria-hidden="true">
        <span /><span /><span /><span /><span /><span /><span /><span /><span />
      </div>
    </section>
  );
}
