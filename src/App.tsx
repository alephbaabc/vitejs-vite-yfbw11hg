import { useState, useEffect, useRef } from 'react';

export default function App() {
  const [price, setPrice] = useState(0);
  const [metrics, setMetrics] = useState<any>({ 
    vol: 0, z: 0, rsi: 50, flux: 50, buyTicks: 0, sellTicks: 0, regime: 'STABLE' 
  });
  const [minuteHistory, setMinuteHistory] = useState<number[]>([]);
  const [waveHistory, setWaveHistory] = useState<number[]>([]);
  
  const history = useRef<number[]>([]);
  const tickBuffer = useRef<number[]>([]);
  const tickCounters = useRef({ up: 0, down: 0 });

  useEffect(() => {
    const runSentinel = async () => {
      try {
        const r = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=PAXGUSDT');
        const d = await r.json();
        const val = parseFloat(d.price);
        if (!val) return;

        setPrice(val);
        const prev = history.current[history.current.length - 1] || val;
        history.current = [...history.current, val].slice(-100);

        // 1. STEALTH TICK COUNTER (The "Missing" Piece)
        if (val > prev) tickCounters.current.up += 1;
        if (val < prev) tickCounters.current.down += 1;

        // 2. AGGRESSIVE WAVE + FLUX MATH
        const mom = ((val - history.current[0]) / (history.current[0] || 1)) * 15000;
        const currentRSI = 50 + mom;
        
        // RSI Flux: A 3-period weighted smoothing of momentum
        const flux = (currentRSI * 0.6) + ((metrics.flux || 50) * 0.4);

        // 3. 1-MINUTE AGGREGATION
        tickBuffer.current.push(val);
        if (tickBuffer.current.length >= 12) {
          setMinuteHistory(h => [...h, val].slice(-30));
          setWaveHistory(w => [...w, flux].slice(-30));
          tickBuffer.current = [];
          // Reset Stealth Counters every minute for fresh bias reading
          tickCounters.current = { up: 0, down: 0 };
        }

        setMetrics({
          vol: (val - prev) / (prev || 1),
          z: (val - (history.current.reduce((a, b) => a + b, 0) / history.current.length)) / 1,
          rsi: currentRSI,
          flux: flux,
          buyTicks: tickCounters.current.up,
          sellTicks: tickCounters.current.down,
          regime: currentRSI > 75 ? 'VOL EXPANSION' : currentRSI < 25 ? 'CRITICAL ALPHA' : 'STABLE'
        });
      } catch (e) { console.log("Feed Sync..."); }
    };

    const id = setInterval(runSentinel, 5000);
    runSentinel();
    return () => clearInterval(id);
  }, [metrics.flux]);

  const total = metrics.buyTicks + metrics.sellTicks || 1;
  const buyRatio = (metrics.buyTicks / total) * 100;

  return (
    <div style={{ background: '#050505', color: '#e5e5e5', minHeight: '100vh', padding: '20px', fontFamily: 'monospace' }}>
      <div style={{ borderBottom: '1px solid #222', paddingBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '10px', color: '#666' }}>SENTINEL V8.1 // FLUX-PULSE</span>
        <span style={{ fontSize: '10px', color: '#00ffcc' }}>● LIVE</span>
      </div>

      {/* PRICE BLOCK */}
      <div style={{ marginTop: '30px', borderLeft: '3px solid #fbbf24', paddingLeft: '15px' }}>
        <h1 style={{ fontSize: '42px', margin: '0' }}>${price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h1>
        <div style={{ color: metrics.rsi > 50 ? '#00ffcc' : '#ff4444', fontWeight: 'bold' }}>{metrics.regime}</div>
      </div>

      {/* STEALTH TICK COUNTER (UP/DOWN) */}
      <div style={{ marginTop: '25px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', marginBottom: '5px' }}>
          <span style={{ color: '#00ffcc' }}>UP-TICKS: {metrics.buyTicks}</span>
          <span style={{ color: '#ff4444' }}>DOWN-TICKS: {metrics.sellTicks}</span>
        </div>
        <div style={{ height: '6px', background: '#111', width: '100%', display: 'flex', borderRadius: '10px', overflow: 'hidden' }}>
          <div style={{ width: `${buyRatio}%`, background: '#00ffcc', transition: 'width 0.4s ease' }} />
          <div style={{ flex: 1, background: '#ff4444' }} />
        </div>
      </div>

      {/* FLUX & WAVE CHART */}
      <div style={{ marginTop: '20px', background: '#080808', border: '1px solid #151515', padding: '15px' }}>
        <div style={{ fontSize: '8px', color: '#444', marginBottom: '10px' }}>AGGRESSIVE WAVES (GOLD) / PRICE (WHITE)</div>
        <svg viewBox="0 0 300 100" style={{ width: '100%', height: '140px', overflow: 'visible' }}>
          {minuteHistory.length > 1 && (
            <polyline 
              points={minuteHistory.map((p, i) => `${(i / (minuteHistory.length - 1)) * 300},${100 - ((p - Math.min(...minuteHistory)) / (Math.max(...minuteHistory) - Math.min(...minuteHistory) || 1)) * 80}`).join(' ')} 
              fill="none" stroke="#fff" strokeWidth="1.5" 
            />
          )}
          {waveHistory.length > 1 && (
            <polyline 
              points={waveHistory.map((r, i) => `${(i / (waveHistory.length - 1)) * 300},${50 - (r - 50)}`).join(' ')} 
              fill="none" stroke="#fbbf24" strokeWidth="1" opacity="0.6" 
            />
          )}
        </svg>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '20px' }}>
        <div style={{ background: '#0a0a0a', padding: '15px', border: '1px solid #111' }}>
          <div style={{ fontSize: '8px', color: '#444' }}>RSI FLUX</div>
          <div style={{ fontSize: '18px', color: '#fbbf24' }}>{metrics.flux.toFixed(2)}</div>
        </div>
        <div style={{ background: '#0a0a0a', padding: '15px', border: '1px solid #111' }}>
          <div style={{ fontSize: '8px', color: '#444' }}>MOMENTUM POCKET</div>
          <div style={{ fontSize: '18px', color: '#22d3ee' }}>{metrics.rsi.toFixed(0)}</div>
        </div>
      </div>
    </div>
  );
}
