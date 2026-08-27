import { useEffect, useRef, useState } from "react";
import { StrategyBuilder } from "./components/StrategyBuilder.jsx";
import { ResultSurface } from "./components/ResultSurface.jsx";

function SlidersIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h10M18 7h2M4 17h3M11 17h9M14 4v6M7 14v6" />
    </svg>
  );
}

function FlockBackground({ pointerRef }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    const spacing = 72;
    let nodes = [];
    let frame;

    function resize() {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * ratio;
      canvas.height = window.innerHeight * ratio;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      const columns = Math.ceil(window.innerWidth / spacing) + 2;
      const rows = Math.ceil(window.innerHeight / spacing) + 2;
      nodes = Array.from({ length: rows }, (_, row) => Array.from({ length: columns }, (_, column) => ({
        baseX: column * spacing - spacing / 2,
        baseY: row * spacing - spacing / 2,
        x: column * spacing - spacing / 2,
        y: row * spacing - spacing / 2,
      })));
    }

    function animate() {
      const { x: pointerX, y: pointerY } = pointerRef.current;
      context.clearRect(0, 0, window.innerWidth, window.innerHeight);

      nodes.flat().forEach((node) => {
        const deltaX = node.baseX - pointerX;
        const deltaY = node.baseY - pointerY;
        const distance = Math.hypot(deltaX, deltaY);
        const influence = distance < 250 ? ((250 - distance) / 250) ** 2 : 0;
        const targetX = node.baseX + (distance ? (deltaX / distance) * influence * 35 : 0);
        const targetY = node.baseY + (distance ? (deltaY / distance) * influence * 35 : 0);
        node.x += (targetX - node.x) * 0.08;
        node.y += (targetY - node.y) * 0.08;
      });

      context.strokeStyle = "rgba(71, 85, 105, 0.075)";
      context.lineWidth = 0.7;
      nodes.forEach((row, rowIndex) => row.forEach((node, columnIndex) => {
        const right = row[columnIndex + 1];
        const below = nodes[rowIndex + 1]?.[columnIndex];
        context.beginPath();
        if (right) { context.moveTo(node.x, node.y); context.lineTo(right.x, right.y); }
        if (below) { context.moveTo(node.x, node.y); context.lineTo(below.x, below.y); }
        context.stroke();
      }));
      context.fillStyle = "rgba(71, 85, 105, 0.14)";
      nodes.flat().forEach((node) => {
        context.beginPath();
        context.arc(node.x, node.y, 1.15, 0, Math.PI * 2);
        context.fill();
      });
      frame = requestAnimationFrame(animate);
    }

    resize();
    window.addEventListener("resize", resize);
    frame = requestAnimationFrame(animate);
    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(frame);
    };
  }, [pointerRef]);

  return <canvas className="flockBackground" ref={canvasRef} aria-hidden="true" />;
}

export function App() {
  const pointerRef = useRef({ x: -1000, y: -1000 });
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

  function updateBackground(event) {
    pointerRef.current = { x: event.clientX, y: event.clientY };
  }

  return (
    <main className="appShell" onPointerMove={updateBackground}>
      <FlockBackground pointerRef={pointerRef} />
      <header className="appHeader">
        <div>
          <p className="eyebrow">Structured products</p>
          <h1>Certificati</h1>
        </div>
        <p className="headerStatus">Local backtesting workspace</p>
      </header>

      <ResultSurface isRunning={isRunning} result={result} error={error} />

      <button
        className="builderToggle"
        type="button"
        aria-label={isBuilderOpen ? "Close strategy builder" : "Open strategy builder"}
        aria-expanded={isBuilderOpen}
        onClick={() => setIsBuilderOpen((open) => !open)}
      >
        <SlidersIcon />
      </button>

      <StrategyBuilder
        isOpen={isBuilderOpen}
        onRun={runBacktest}
      />
    </main>
  );
}
