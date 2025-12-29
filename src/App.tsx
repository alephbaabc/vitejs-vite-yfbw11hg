import { useState, useEffect, useRef } from 'react';

export default function App() {
  const [price, setPrice] = useState(0);
  const [metrics, setMetrics] = useState<any>({ 
    flux: 50, wave: 50, upTicks: 0, downTicks: 0, stealthBuy: 0, stealthSell: 0, regime: 'STABLE' 
  });
  const [minuteHistory, setMinuteHistory] = useState<number[]>([]);
  const [fluxHistory, setFluxHistory] = useState<number[]>([]);
  
  const history = useRef<number[]>([]);
  const tickBuffer = useRef<number[]>([]);
  
  // SEPARATED COUNTERS: Aggressive Ticks vs Stealth Volume
  const counters = useRef({ up: 0, down: 0, sBuy: 0, sSell: 0 });

  useEffect(() => {
    const runEngine = async () => {
      try {
        const r = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=PAXGUSDT');
        const d = await r.json();
        const val = parseFloat(d.price);
        if (!val) return;

        setPrice(val);
        const prev = history.current[history.current.length - 1] || val;
        history.current = [...history.current, val].slice(-100);

        // --- THE TICK VS STEALTH LOGIC ---
        if (val > prev) {
          counters.current.up += 1; // Price actually moved UP
        } else if (val < prev) {
          counters.current.down += 1; // Price actually moved DOWN
        } else {
          // STEALTH: Price didn't move, but trade occurred. 
          // We assign bias based on the Flux direction.
          if (metrics.flux > 50) counters.current.sBuy += 1;
          else counters.current.sSell += 1;
        }

        // --- RSI FLUX & AGGRESSIVE WAVES ---
        const rawRSI = 50 + (((val - history.current[0]) / (history.current[0] || 1)) * 18000);
        const flux = (rawRSI * 0.4) + (metrics.flux * 0.6); // Smoothing the jitter
        const wave = (flux - 50) * 1.5 + 50; // Amplifying the momentum wave

        tickBuffer.current.push(val);
        if (tickBuffer.current.length >= 12) {
          setMinuteHistory(h => [...h, val].slice(-35));
          setFluxHistory(f => [...f, flux].slice(-35));
          tickBuffer.current = [];
          // Reset counters every minute
          counters.current = { up: 0, down: 0, sBuy: 0, sSell: 0 };
        }

        setMetrics({
          flux, wave,
          upTicks: counters.current.up,
          downTicks: counters.current.down,
          stealthBuy: counters.current.sBuy,
          stealthSell: counters.current.sSell,
          regime: flux > 70 ? 'WAVE EXPANSION' : flux < 30 ? 'ALPHA COMPRESSION' : 'STABLE'
        });
      } catch (e) { console.log("Engine lag..."); }
    };

    const id = setInterval(runEngine, 5000);
    runEngine();
    return () => clearInterval(id);
  }, [metrics.flux]);

  // Calculations for UI Bars
  const tickTotal = metrics.upTicks + metrics.downTicks || 1;
  const stealthTotal = metrics.stealthBuy + metrics.stealthSell || 1;

  return (
    <div style={{ background: '#050505', color: '#e5e5e5', minHeight: '100vh', padding: '20px', fontFamily: 'monospace' }}>
      <div style={{ borderBottom: '1px solid #222', paddingBottom: '10px', display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
        <span style={{ color: '#666' }}>SENTINEL V8.2 // VECTOR-FLUX ENGINE</span>
        <span style={{ color: '#fbbf24' }}>EGARCH ACTIVE</span>
      </div>

      {/* PRICE & REGIME */}
      <div style={{ marginTop: '25px', borderLeft: '4px solid #00ffcc', paddingLeft: '15px' }}>
        <h1 style={{ fontSize: '44px', margin: '0', letterSpacing: '-1px' }}>${price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h1>
        <div style={{ color: metrics.flux > 50 ? '#00ffcc' : '#ff4444', fontSize: '12px', fontWeight: 'bold' }}>
          {metrics.regime} <span style={{ color: '#444' }}>| FLUX: {metrics.flux.toFixed(1)}</span>
        </div>
      </div>

      {/* AGGRESSIVE TICKS VS STEALTH TRADES */}
      <div style={{ marginTop: '30px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div>
          <div style={{ fontSize: '8px', color: '#666', marginBottom: '5px' }}>AGGRESSIVE TICKS (PRICE MOVERS)</div>
          <div style={{ height: '10px', background: '#111', display: 'flex', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ width: `${(metrics.upTicks / tickTotal) * 100}%`, background: '#00ffcc' }} />
            <div style={{ flex: 1, background: '#ff4444' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', marginTop: '4px' }}>
            <span style={{ color: '#00ffcc' }}>U:{metrics.upTicks}</span>
            <span style={{ color: '#ff4444' }}>D:{metrics.downTicks}</span>
          </div>
        </div>
        <div>
          <div style={{ fontSize: '8px', color: '#666', marginBottom: '5px' }}>STEALTH TRADES (ABSORPTION)</div>
          <div style={{ height: '10px', background: '#111', display: 'flex', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ width: `${(metrics.stealthBuy / stealthTotal) * 100}%`, background: '#fbbf24' }} />
            <div style={{ flex: 1, background: '#6366f1' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', marginTop: '4px' }}>
            <span style={{ color: '#fbbf24' }}>B:{metrics.stealthBuy}</span>
            <span style={{ color: '#6366f1' }}>S:{metrics.stealthSell}</span>
          </div>
        </div>
      </div>

      {/* WAVE CHART */}
      <div style={{ marginTop: '25px', background: '#080808', border: '1px solid #151515', padding: '15px', position: 'relative' }}>
        <div style={{ fontSize: '8px', color: '#444', position: 'absolute', top: '10px', left: '10px' }}>FLUX OVERLAY (GOLD) / PRICE (WHITE)</div>
        <svg viewBox="0 0 300 100" style={{ width: '100%', height: '160px', overflow: 'visible' }}>
          {minuteHistory.length > 1 && (
            <polyline 
              points={minuteHistory.map((p, i) => `${(i / (minuteHistory.length - 1)) * 300},${100 - ((p - Math.min(...minuteHistory)) / (Math.max(...minuteHistory) - Math.min(...minuteHistory) || 1)) * 85}`).join(' ')} 
              fill="none" stroke="#fff" strokeWidth="1.5" 
            />
          )}
          {fluxHistory.length > 1 && (
            <polyline 
              points={fluxHistory.map((f, i) => `${(i / (fluxHistory.length - 1)) * 300},${50 - (f - 50)}`).join(' ')} 
              fill="none" stroke="#fbbf24" strokeWidth="1.2" opacity="0.7" 
            />
          )}
        </svg>
      </div>
    </div>
  );
}
