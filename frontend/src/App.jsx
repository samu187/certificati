import { useState } from "react";
import { StrategyBuilder } from "./components/StrategyBuilder.jsx";
import { ResultSurface } from "./components/ResultSurface.jsx";

function SlidersIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h10M18 7h2M4 17h3M11 17h9M14 4v6M7 14v6" />
    </svg>
  );
}

export function App() {
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function runBacktest(request) {
    setIsBuilderOpen(false);
    setIsRunning(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/backtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.detail || "The backtest could not be completed.");
      setResult(payload);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <main className="appShell">
      <header className="appHeader">
        <div>
          <p className="eyebrow">Structured products</p>
          <h1>Certificati</h1>
        </div>
        <p className="headerStatus">Local backtesting workspace</p>
      </header>

      <ResultSurface isRunning={isRunning} result={result} error={error} />

      <button
        className={`builderToggle ${isBuilderOpen ? "isHidden" : ""}`}
        type="button"
        aria-label="Open strategy builder"
        aria-expanded={isBuilderOpen}
        onClick={() => setIsBuilderOpen(true)}
      >
        <SlidersIcon />
      </button>

      <StrategyBuilder
        isOpen={isBuilderOpen}
        onClose={() => setIsBuilderOpen(false)}
        onRun={runBacktest}
      />
    </main>
  );
}
