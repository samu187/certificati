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

  function runBacktest() {
    setIsBuilderOpen(false);
    setIsRunning(true);
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

      <ResultSurface isRunning={isRunning} />

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
