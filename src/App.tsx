import { useState, useEffect, useRef } from 'react';

const CONFIG = {
  GARCH: { ALPHA: 0.12, BETA: 0.85, OMEGA: 0.03 },
  FLUX_SMOOTH: 0.70
};

export default function App() {
  const [price, setPrice] = useState(0);
  const [metrics, setMetrics] = useState<any>({
    upTicks: 0, downTicks: 0, stealthBuy: 0, stealthSell: 0,
    flux: 50, sigma: 0, premium: 0.045
  });

  const [history, setHistory] = useState<number[]>([]);
  const [fluxHistory, setFluxHistory] = useState<number[]>([]);
  
  const lastVar = useRef(0.0001);
  const counters = useRef({ up: 0, down: 0, sBuy: 0, sSell: 0 });
  const chartBuffer = useRef<number[]>([]);

  useEffect(() => {
    const fetchEngine = async () => {
      try {
        const r = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=PAXGUSDT');
        const d = await r.json();
        const val = parseFloat(d.price);
        if (!val) return;

        setPrice((prev) => {
          if (prev !== 0) {
            // SEGMENT 1 & 2: TICK vs STEALTH LOGIC
            if (val > prev) counters.current.up += 1;
            else if (val < prev) counters.current.down += 1;
            else {
              // Stealth Trade logic based on Flux bias
              if (metrics.flux > 50) counters.current.sBuy += 1;
              else counters.current.sSell += 1;
            }
          }
          const ret = prev !== 0 ? (val - prev) / prev : 0;
          
          // GARCH-M & SIGMA MATH
          const h = CONFIG.GARCH.OMEGA + CONFIG.GARCH.ALPHA * Math.pow(ret, 2) + CONFIG.GARCH.BETA * lastVar.current;
          lastVar.current = h;
          const vol = Math.sqrt(h);
          const avg = chartBuffer.current.reduce((a,b)=>a+b,0) / (chartBuffer.current.length || 1);
          const sigma = (val - avg) / (avg * vol || 0.0001);

          // RSI FLUX (VISUAL ONLY)
          const mom = 50 + (ret * 22000);
          const newFlux = (mom * (1 - CONFIG.FLUX_SMOOTH)) + (metrics.flux * CONFIG.FLUX_SMOOTH);

          setMetrics((m:any) => ({
            ...m,
            upTicks: counters.current.up,
            downTicks: counters.current.down,
            stealthBuy: counters.current.sBuy,
            stealthSell: counters.current.sSell,
            flux: newFlux,
            sigma: sigma,
            premium: vol * 0.5
          }));

          return val;
        });

        chartBuffer.current.push(val);
        if (chartBuffer.current.length >= 12) {
          setHistory(h => [...h, val].slice(-35));
          setFluxHistory(f => [...f, metrics.flux].slice(-35));
          chartBuffer.current = [];
        }
      } catch (e) { console.log("Lag"); }
    };

    const id = setInterval(fetchEngine, 1000);
    return () => clearInterval(id);
  }, [metrics.flux]);

  return (
    <div style={{ background: '#020202', color: '#eee', minHeight: '100vh', padding: '15px', fontFamily: 'monospace' }}>
      
      {/* SECTION 1: PRICE & SIGMA (STATISTICAL) */}
      <div style={{ marginBottom: '20px', padding: '15px', background: '#080808', border: '1px solid #151515' }}>
        <h1 style={{ fontSize: '38px', margin: '0', color: '#00ffcc' }}>${price.toLocaleString()}</h1>
        <div style={{ marginTop: '10px' }}>
          <div style={{ fontSize: '9px', color: '#444', marginBottom: '4px' }}>SIGMA VARIANCE (±3σ)</div>
          <div style={{ height: '10px', background: '#111', position: 'relative', display: 'flex', alignItems: 'center' }}>
            <div style={{ position: 'absolute', left: '50%', width: '2px', height: '100%', background: '#333', zIndex: 1 }} />
            <div style={{ 
              position: 'absolute', 
              left: metrics.sigma < 0 ? `calc(50% - ${Math.min(Math.abs(metrics.sigma) * 16, 50)}%)` : '50%',
              width: `${Math.min(Math.abs(metrics.sigma) * 16, 50)}%`,
              height: '100%',
              background: metrics.sigma > 0 ? '#00ffcc' : '#ff4444'
            }} />
          </div>
        </div>
      </div>

      {/* SECTION 2: TICK COUNTERS (AGGRESSIVE MOVERS) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
        <div style={{ background: '#080808', padding: '15px', textAlign: 'center', border: '1px solid #151515' }}>
          <div style={{ color: '#00ffcc', fontSize: '24px' }}>▲</div>
          <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{metrics.upTicks}</div>
          <div style={{ fontSize: '8px', color: '#444' }}>AGGRESSIVE UP</div>
        </div>
        <div style={{ background: '#080808', padding: '15px', textAlign: 'center', border: '1px solid #151515' }}>
          <div style={{ color: '#ff4444', fontSize: '24px' }}>▼</div>
          <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{metrics.downTicks}</div>
          <div style={{ fontSize: '8px', color: '#444' }}>AGGRESSIVE DOWN</div>
        </div>
      </div>

      {/* SECTION 3: STEALTH TRADES (ABSORPTION BARS) */}
      <div style={{ padding: '15px', background: '#080808', border: '1px solid #151515', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#666', marginBottom: '5px' }}>
          <span>STEALTH BUY: {metrics.stealthBuy}</span>
          <span>STEALTH SELL: {metrics.stealthSell}</span>
        </div>
        <div style={{ height: '8px', background: '#111', display: 'flex', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{ width: `${(metrics.stealthBuy / (metrics.stealthBuy + metrics.stealthSell || 1)) * 100}%`, background: '#6366f1' }} />
          <div style={{ flex: 1, background: '#f43f5e' }} />
        </div>
      </div>

      {/* SECTION 4: RSI FLUX WAVES (VISUAL CHART) */}
      <div style={{ background: '#080808', border: '1px solid #151515', padding: '15px' }}>
        <div style={{ fontSize: '9px', color: '#444', marginBottom: '10px' }}>FLUX MOMENTUM (GOLD) / PRICE (WHITE)</div>
        <svg viewBox="0 0 300 100" style={{ width: '100%', height: '180px', overflow: 'visible' }}>
          {history.length > 1 && (
            <polyline 
              points={history.map((p, i) => `${(i / (history.length - 1)) * 300},${100 - ((p - Math.min(...history)) / (Math.max(...history) - Math.min(...history) || 1)) * 80}`).join(' ')} 
              fill="none" stroke="#fff" strokeWidth="1.5" 
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
