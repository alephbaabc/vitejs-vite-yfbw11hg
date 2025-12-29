import { useState, useEffect, useRef } from 'react';

// EXACT CONFIG FROM YOUR 7.5 TXT FILE
const CONFIG = {
  GARCH: { ALPHA: 0.12, BETA: 0.85, OMEGA: 0.03 },
  FLUX_SMOOTH: 0.65
};

export default function App() {
  const [price, setPrice] = useState(0);
  const [metrics, setMetrics] = useState<any>({
    ticks: { up: 0, down: 0 },
    stealth: { buy: 0, sell: 0 },
    flux: 50,
    vol: 0,
    riskPremium: 0.045
  });

  const [history, setHistory] = useState<number[]>([]);
  const [fluxHistory, setFluxHistory] = useState<number[]>([]);
  
  const rawHistory = useRef<number[]>([]);
  const lastVar = useRef(0.0001);
  const persistentCounters = useRef({ up: 0, down: 0, sBuy: 0, sSell: 0 });
  const minuteBuffer = useRef<number[]>([]);

  useEffect(() => {
    const runSentinel = async () => {
      try {
        const res = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=PAXGUSDT');
        const data = await res.json();
        const val = parseFloat(data.price);
        if (!val) return;

        setPrice((prev) => {
          // --- 7.5 CUMULATIVE COUNTER LOGIC ---
          if (prev !== 0) {
            if (val > prev) persistentCounters.current.up += 1;
            else if (val < prev) persistentCounters.current.down += 1;
            else {
              // STEALTH TRADE (Absorption)
              if (metrics.flux > 50) persistentCounters.current.sBuy += 1;
              else persistentCounters.current.sSell += 1;
            }
          }
          return val;
        });

        rawHistory.current = [...rawHistory.current, val].slice(-100);
        const ret = prevPrice !== 0 ? (val - prevPrice) / prevPrice : 0;

        // --- GARCH-M ENGINE (7.5 ALPHA/BETA) ---
        const h = CONFIG.GARCH.OMEGA + 
                  CONFIG.GARCH.ALPHA * Math.pow(ret, 2) + 
                  CONFIG.GARCH.BETA * lastVar.current;
        lastVar.current = h;
        const vol = Math.sqrt(h);
        const riskPremium = vol * 0.5; // Linked to Mean

        // --- RSI FLUX AGGREGATION (Visual Waves) ---
        const mom = 50 + (ret * 20000);
        const newFlux = (mom * (1 - CONFIG.FLUX_SMOOTH)) + (metrics.flux * CONFIG.FLUX_SMOOTH);

        // 1-Minute Aggregation for the Chart
        minuteBuffer.current.push(val);
        if (minuteBuffer.current.length >= 12) {
          setHistory(h => [...h, val].slice(-40));
          setFluxHistory(f => [...f, newFlux].slice(-40));
          minuteBuffer.current = [];
        }

        setMetrics((prev: any) => ({
          ...prev,
          ticks: { up: persistentCounters.current.up, down: persistentCounters.current.down },
          stealth: { buy: persistentCounters.current.sBuy, sell: persistentCounters.current.sSell },
          flux: newFlux,
          vol: vol,
          riskPremium: riskPremium
        }));

      } catch (err) { console.log("Engine Lag..."); }
    };

    const prevPrice = price;
    const id = setInterval(runSentinel, 5000);
    return () => clearInterval(id);
  }, [price, metrics.flux]);

  const tTotal = metrics.ticks.up + metrics.ticks.down || 1;
  const sTotal = metrics.stealth.buy + metrics.stealth.sell || 1;

  return (
    <div style={{ background: '#050505', color: '#e5e5e5', minHeight: '100vh', padding: '20px', fontFamily: 'monospace' }}>
      {/* 7.5 STYLE HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', opacity: 0.5, fontSize: '9px' }}>
        <span>V7.5 SUPER HYBRID CORE</span>
        <span>GARCH-M STABLE</span>
      </div>

      <div style={{ marginTop: '20px', borderLeft: '3px solid #00ffcc', paddingLeft: '15px' }}>
        <h1 style={{ fontSize: '42px', margin: '0' }}>${price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h1>
        <div style={{ color: '#fbbf24', fontSize: '11px' }}>RISK PREMIUM: +{metrics.riskPremium.toFixed(6)}%</div>
      </div>

      {/* TICK COUNTERS (AGGRESSIVE) */}
      <div style={{ marginTop: '25px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontWeight: 'bold' }}>
          <span style={{ color: '#00ffcc' }}>TICKS UP: {metrics.ticks.up}</span>
          <span style={{ color: '#ff4444' }}>TICKS DOWN: {metrics.ticks.down}</span>
        </div>
        <div style={{ height: '6px', background: '#111', marginTop: '5px', display: 'flex', borderRadius: '10px', overflow: 'hidden' }}>
          <div style={{ width: `${(metrics.ticks.up / tTotal) * 100}%`, background: '#00ffcc' }} />
          <div style={{ flex: 1, background: '#ff4444' }} />
        </div>
      </div>

      {/* STEALTH COUNTERS (ABSORPTION) */}
      <div style={{ marginTop: '15px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontWeight: 'bold' }}>
          <span style={{ color: '#6366f1' }}>STEALTH BUY: {metrics.stealth.buy}</span>
          <span style={{ color: '#f43f5e' }}>STEALTH SELL: {metrics.stealth.sell}</span>
        </div>
        <div style={{ height: '6px', background: '#111', marginTop: '5px', display: 'flex', borderRadius: '10px', overflow: 'hidden' }}>
          <div style={{ width: `${(metrics.stealth.buy / sTotal) * 100}%`, background: '#6366f1' }} />
          <div style={{ flex: 1, background: '#f43f5e' }} />
        </div>
      </div>

      {/* RSI FLUX VISUAL WAVE CHART */}
      <div style={{ marginTop: '25px', background: '#080808', border: '1px solid #1a1a1a', padding: '15px' }}>
        <div style={{ fontSize: '9px', color: '#444', marginBottom: '10px' }}>VECTOR FLUX (GOLD) / 1M PRICE (WHITE)</div>
        <svg viewBox="0 0 300 100" style={{ width: '100%', height: '160px', overflow: 'visible' }}>
          {history.length > 1 && (
            <polyline 
              points={history.map((p, i) => `${(i / (history.length - 1)) * 300},${100 - ((p - Math.min(...history)) / (Math.max(...history) - Math.min(...history) || 1)) * 85}`).join(' ')} 
              fill="none" stroke="#ffffff" strokeWidth="1.5" 
            />
          )}
          {fluxHistory.length > 1 && (
            <polyline 
              points={fluxHistory.map((f, i) => `${(i / (fluxHistory.length - 1)) * 300},${50 - (f - 50)}`).join(' ')} 
              fill="none" stroke="#fbbf24" strokeWidth="1" opacity="0.6" 
            />
          )}
        </svg>
      </div>
    </div>
  );
}
