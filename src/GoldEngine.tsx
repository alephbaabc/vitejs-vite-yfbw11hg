import { useState, useEffect, useRef } from 'react';

export default function App() {
  const [price, setPrice] = useState(0);
  const [metrics, setMetrics] = useState({ vol: 0, z: 0, rsi: 50, regime: 'INITIALIZING' });
  
  // TF=1m Buffers
  const [minuteHistory, setMinuteHistory] = useState<number[]>([]);
  const [rsiHistory, setRsiHistory] = useState<number[]>([]);
  
  const tickBuffer = useRef<number[]>([]);
  const lastVar = useRef(0.0001); 
  const history = useRef<number[]>([]);

  useEffect(() => {
    const getPAXG = () => {
      fetch('https://api.binance.com/api/v3/ticker/price?symbol=PAXGUSDT')
        .then((r) => r.json())
        .then((d) => {
          const val = parseFloat(d.price);
          setPrice(val);
          
          const prev = history.current[history.current.length - 1] || val;
          const ret = (val - prev) / prev;
          history.current = [...history.current, val].slice(-100);

          // --- EGARCH V7.5 HYBRID CORE ---
          const currentVol = Math.sqrt(lastVar.current);
          const z = ret / (currentVol || 0.0001);
          const logV = -0.45 + (0.92 * Math.log(lastVar.current)) + (0.12 * (Math.abs(z) - 0.797)) + (-0.15 * z);
          const nVar = Math.exp(logV);
          lastVar.current = nVar;

          // --- 1-MINUTE TIME FRAME LOGIC ---
          tickBuffer.current.push(val);
          if (tickBuffer.current.length >= 12) { // 12 ticks * 5s = 60s
            const minuteClose = val;
            const minuteRsi = 50 + (ret * 15000); // Sensitive Hybrid RSI
            
            setMinuteHistory(prev => [...prev, minuteClose].slice(-30));
            setRsiHistory(prev => [...prev, minuteRsi].slice(-30));
            tickBuffer.current = []; // Reset for next minute
          }

          setMetrics({
            vol: Math.sqrt(nVar),
            z: z,
            rsi: 50 + (ret * 15000),
            regime: nVar > 0.005 ? 'VOL EXPANSION' : 'STABLE ACCUM'
          });
        })
        .catch(err => console.error('Feed Error:', err));
    };

    const id = setInterval(getPAXG, 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ background: '#050505', color: '#e5e5e5', minHeight: '100vh', padding: '20px', fontFamily: 'monospace' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', opacity: 0.6 }}>
        <span style={{ fontSize: '10px' }}>SENTINEL V7.5 // SUPER HYBRID</span>
        <span style={{ fontSize: '10px', color: '#00ffcc' }}>1m TF ACTIVE</span>
      </div>

      <div style={{ marginTop: '20px' }}>
        <h1 style={{ fontSize: '38px', margin: '0' }}>${price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h1>
        <div style={{ color: '#00ffcc', fontSize: '12px' }}>{metrics.regime}</div>
      </div>

      {/* TF=1m CHART OVERLAY */}
      <div style={{ marginTop: '30px', background: '#080808', padding: '20px', border: '1px solid #151515' }}>
        <svg viewBox="0 0 300 100" style={{ width: '100%', height: '180px', overflow: 'visible' }}>
          {/* WHITE CLOSE LINE (Price) */}
          <polyline
            points={minuteHistory.map((p, i) => {
              const min = Math.min(...minuteHistory);
              const max = Math.max(...minuteHistory);
              const range = max - min || 10;
              return `${(i / 29) * 300},${100 - ((p - min) / range) * 80}`;
            }).join(' ')}
            fill="none" stroke="#ffffff" strokeWidth="1.5" opacity="0.9"
          />

          {/* GOLD RSI LINE (1m Momentum) */}
          <polyline
            points={rsiHistory.map((r, i) => {
              const x = (i / 29) * 300;
              // Tethered to middle of chart for divergence visibility
              const y = 50 - (r - 50); 
              return `${x},${y}`;
            }).join(' ')}
            fill="none" stroke="#fbbf24" strokeWidth="1" opacity="0.6"
          />
        </svg>
        <div style={{ display: 'flex', gap: '15px', marginTop: '10px', fontSize: '8px' }}>
          <span style={{ color: '#fff' }}>— PRICE (1m)</span>
          <span style={{ color: '#fbbf24' }}>— RSI (1m)</span>
        </div>
      </div>

      {/* METRICS */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '20px' }}>
        <div style={{ background: '#0a0a0a', padding: '15px', border: '1px solid #111' }}>
          <div style={{ fontSize: '8px', color: '#444' }}>Z-SHOCK (CORE)</div>
          <div style={{ fontSize: '18px', color: metrics.z < 0 ? '#ff4444' : '#00ffcc' }}>{metrics.z.toFixed(3)}</div>
        </div>
        <div style={{ background: '#0a0a0a', padding: '15px', border: '1px solid #111' }}>
          <div style={{ fontSize: '8px', color: '#444' }}>VOL-CORE (EGARCH)</div>
          <div style={{ fontSize: '18px', color: '#22d3ee' }}>{(metrics.vol * 100).toFixed(4)}%</div>
        </div>
      </div>
    </div>
  );
}
