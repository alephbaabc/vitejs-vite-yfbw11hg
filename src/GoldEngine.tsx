import { useState, useEffect, useRef } from 'react';

export default function App() {
  const [price, setPrice] = useState(0);
  const [metrics, setMetrics] = useState({ vol: 0, z: 0, rsi: 50, regime: 'STABLE ACCUM' });
  const [candles, setCandles] = useState<{o:number, h:number, l:number, c:number}[]>([]);
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

          // --- OHLC LOGIC ---
          // Creates a new candle every 5 ticks
          if (history.current.length % 5 === 0) {
            const last5 = history.current.slice(-5);
            const newCandle = {
              o: last5[0],
              h: Math.max(...last5),
              l: Math.min(...last5),
              c: last5[4]
            };
            setCandles(prev => [...prev, newCandle].slice(-15));
          }

          // --- METRICS LOGIC ---
          const avg = history.current.reduce((a, b) => a + b) / history.current.length;
          const stdDev = Math.sqrt(history.current.map(p => Math.pow(p - avg, 2)).reduce((a, b) => a + b) / history.current.length);
          const newZ = stdDev === 0 ? 0 : (val - avg) / stdDev;
          const newMom = 50 + (((val - history.current[0]) / history.current[0]) * 1000);

          setMetrics({
            vol: stdDev / avg, 
            z: newZ,
            rsi: newMom,
            regime: newZ < -1.5 ? 'CRITICAL ALPHA' : newZ > 1.5 ? 'VOL EXPANSION' : 'STABLE ACCUM'
          });
        })
        .catch(err => console.error('Feed Error:', err));
    };

    getPAXG();
    const id = setInterval(getPAXG, 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ background: '#050505', color: '#e5e5e5', minHeight: '100vh', padding: '20px', fontFamily: 'monospace' }}>
      {/* HEADER & PRICE */}
      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #222', paddingBottom: '10px' }}>
        <span style={{ fontSize: '10px', color: '#666' }}>SENTINEL V8.0 // PAXG.USDT</span>
        <span style={{ fontSize: '10px', color: '#00ffcc' }}>● LIVE FEED</span>
      </div>
      <div style={{ marginTop: '30px' }}>
        <h1 style={{ fontSize: '42px', margin: '0' }}>${price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h1>
        <div style={{ color: '#00ffcc', fontWeight: 'bold', fontSize: '14px' }}>{metrics.regime}</div>
      </div>

      {/* NEW: CANDLESTICK CHART */}
      <div style={{ marginTop: '20px', background: '#0a0a0a', padding: '15px', border: '1px solid #111' }}>
        <div style={{ fontSize: '9px', color: '#444', marginBottom: '10px' }}>LIVE TAPPING CANDLES</div>
        <svg viewBox="0 0 300 100" style={{ width: '100%', height: '120px' }}>
          {candles.map((c, i) => {
            const x = (i * 20) + 10;
            const slice = history.current.slice(-50);
            const min = Math.min(...slice);
            const max = Math.max(...slice);
            const range = max - min || 1;
            
            const getY = (val: number) => 100 - ((val - min) / range) * 80;
            const isUp = c.c >= c.o;

            return (
              <g key={i}>
                {/* Wick */}
                <line x1={x} y1={getY(c.h)} x2={x} y2={getY(c.l)} stroke={isUp ? '#00ffcc' : '#ff4444'} strokeWidth="1" />
                {/* Body */}
                <rect 
                  x={x - 4} 
                  y={Math.min(getY(c.o), getY(c.c))} 
                  width="8" 
                  height={Math.max(Math.abs(getY(c.o) - getY(c.c)), 1)} 
                  fill={isUp ? '#00ffcc' : '#ff4444'} 
                />
              </g>
            );
          })}
        </svg>
      </div>

      {/* DIVERGENCE OVERLAY */}
      <div style={{ marginTop: '20px', background: '#0a0a0a', padding: '15px', border: '1px solid #111' }}>
        <div style={{ fontSize: '9px', color: '#444', marginBottom: '10px' }}>DIVERGENCE OVERLAY (CYAN/GOLD)</div>
        <svg viewBox="0 0 300 100" style={{ width: '100%', height: '100px', overflow: 'visible' }}>
          <polyline points={history.current.slice(-20).map((p, i) => {
            const slice = history.current.slice(-20);
            const min = Math.min(...slice);
            const max = Math.max(...slice);
            const range = max - min || 1;
            return `${(i / 19) * 300},${100 - ((p - min) / range) * 80}`;
          }).join(' ')} fill="none" stroke="#00ffcc" strokeWidth="2" />
        </svg>
      </div>
    </div>
  );
}
