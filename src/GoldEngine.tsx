import { useState, useEffect, useRef } from 'react';

export default function App() {
  const [price, setPrice] = useState(0);
  const [metrics, setMetrics] = useState({
    vol: 0,
    z: 0,
    rsi: 50,
    regime: 'STABLE ACCUM',
  });
  const history = useRef<number[]>([]);

  useEffect(() => {
    const getPAXG = () => {
      fetch('https://api.binance.com/api/v3/ticker/price?symbol=PAXGUSDT')
        .then((r) => r.json())
        .then((d) => {
          const val = parseFloat(d.price);
          setPrice(val);
          
          history.current = [...history.current, val].slice(-50);
          if (history.current.length < 5) return;

          const avg = history.current.reduce((a, b) => a + b) / history.current.length;
          const squareDiffs = history.current.map(p => Math.pow(p - avg, 2));
          const stdDev = Math.sqrt(squareDiffs.reduce((a, b) => a + b) / history.current.length);
          const newZ = stdDev === 0 ? 0 : (val - avg) / stdDev;
          
          const oldPrice = history.current[0];
          const newMom = 50 + (((val - oldPrice) / oldPrice) * 1000);

          setMetrics({
            vol: stdDev / avg, 
            z: newZ,
            rsi: newMom,
            regime: newZ < -1.5 ? 'CRITICAL ALPHA' : newZ > 1.5 ? 'VOL EXPANSION' : 'STABLE ACCUM'
          });
        })
        .catch((err) => {
          console.error('Feed Syncing Error:', err);
        });
    }; // <-- THIS BRACE was missing in your snippet

    getPAXG();
    const id = setInterval(getPAXG, 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ background: '#050505', color: '#e5e5e5', minHeight: '100vh', padding: '20px', fontFamily: 'monospace' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #222', paddingBottom: '10px' }}>
        <span style={{ fontSize: '10px', color: '#666' }}>SENTINEL V8.0 // PAXG.USDT</span>
        <span style={{ fontSize: '10px', color: '#00ffcc' }}>● LIVE FEED</span>
      </div>

      <div style={{ marginTop: '30px' }}>
        <h1 style={{ fontSize: '42px', margin: '0' }}>${price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h1>
        <div style={{ color: '#00ffcc', fontWeight: 'bold', fontSize: '14px' }}>{metrics.regime}</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginTop: '30px' }}>
        <div style={{ background: '#0a0a0a', padding: '15px', border: '1px solid #111' }}>
          <div style={{ fontSize: '9px', color: '#444' }}>VOL (ANN)</div>
          <div style={{ fontSize: '16px', color: '#22d3ee' }}>{(metrics.vol * 100).toFixed(2)}%</div>
        </div>
        <div style={{ background: '#0a0a0a', padding: '15px', border: '1px solid #111' }}>
          <div style={{ fontSize: '9px', color: '#444' }}>Z-SHOCK</div>
          <div style={{ fontSize: '16px', color: metrics.z < 0 ? '#ff4444' : '#00ffcc' }}>{metrics.z.toFixed(2)}</div>
        </div>
        <div style={{ background: '#0a0a0a', padding: '15px', border: '1px solid #111' }}>
          <div style={{ fontSize: '9px', color: '#444' }}>MOMENTUM</div>
          <div style={{ fontSize: '16px', color: '#fbbf24' }}>{metrics.rsi.toFixed(0)}</div>
        </div>
      </div>

      <div style={{ marginTop: '20px', background: '#0a0a0a', padding: '15px', border: '1px solid #111' }}>
        <div style={{ fontSize: '9px', color: '#444', marginBottom: '10px' }}>DIVERGENCE OVERLAY: PRICE (CYAN) / RSI (GOLD)</div>
        <svg viewBox="0 0 300 100" style={{ width: '100%', height: '150px', overflow: 'visible' }}>
          <polyline
            points={history.current.slice(-20).map((p, i) => {
              const x = (i / 19) * 300;
              const slice = history.current.slice(-20);
              const min = Math.min(...slice);
              const max = Math.max(...slice);
              const range = max - min || 1;
              const y = 100 - ((p - min) / range) * 80;
              return `${x},${y}`;
            }).join(' ')}
            fill="none" stroke="#00ffcc" strokeWidth="2"
          />
          <polyline
            points={history.current.slice(-20).map((p, i) => {
              const x = (i / 19) * 300;
              const slice = history.current.slice(-20);
              const min = Math.min(...slice);
              const max = Math.max(...slice);
              const range = max - min || 1;
              const priceY = 100 - ((p - min) / range) * 80;
              return `${x},${priceY + (metrics.rsi - 50) * 0.4}`;
            }).join(' ')}
            fill="none" stroke="#fbbf24" strokeWidth="2"
          />
        </svg>
      </div>
    </div>
  );
}
