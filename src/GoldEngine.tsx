import { useState, useEffect, useRef } from 'react';

export default function App() {
  const [price, setPrice] = useState(0);
  const [metrics, setMetrics] = useState({ vol: 0, z: 0, rsi: 50, regime: 'INITIALIZING' });
  const [candles, setCandles] = useState<{o:number, h:number, l:number, c:number}[]>([]);
  
  const history = useRef<number[]>([]);
  const lastVar = useRef(0.0001); 

  useEffect(() => {
    const getPAXG = () => {
      fetch('https://api.binance.com/api/v3/ticker/price?symbol=PAXGUSDT')
        .then((r) => r.json())
        .then((d) => {
          const val = parseFloat(d.price);
          setPrice(val);
          
          const prev = history.current[history.current.length - 1] || val;
          const ret = (val - prev) / prev;
          history.current = [...history.current, val].slice(-50);

          // --- EGARCH V8.0 CORE ---
          const currentVol = Math.sqrt(lastVar.current);
          const z = ret / (currentVol || 0.0001);
          const logV = -0.45 + (0.92 * Math.log(lastVar.current)) + (0.12 * (Math.abs(z) - 0.797)) + (-0.15 * z);
          const nVar = Math.exp(logV);
          lastVar.current = nVar;

          // --- CANDLESTICK PACKAGING ---
          if (history.current.length % 5 === 0) {
            const slice = history.current.slice(-5);
            setCandles(prev => [...prev, { o: slice[0], h: Math.max(...slice), l: Math.min(...slice), c: slice[4] }].slice(-12));
          }

          // --- METRIC SYNC ---
          const mom = 50 + (ret * 10000); 
          const isPanic = nVar > 0.005 && z < -1.5;

          setMetrics(prev => ({
            vol: Math.sqrt(nVar),
            z: z,
            rsi: mom,
            regime: isPanic ? 'CRITICAL ALPHA (PANIC)' : nVar > 0.003 ? 'VOL EXPANSION' : 'STABLE ACCUM'
          }));

          // --- VOICE ALERT ENGINE ---
          const announce = (text: string) => {
            if (window.speechSynthesis.speaking) return;
            const msg = new SpeechSynthesisUtterance(text);
            msg.rate = 0.9;
            window.speechSynthesis.speak(msg);
          };

          if (isPanic && metrics.regime !== 'CRITICAL ALPHA (PANIC)') {
            announce("Warning. Critical Alpha. Price Panic Detected.");
          }
        })
        .catch(err => console.error('Feed Error:', err));
    };

    const id = setInterval(getPAXG, 5000);
    getPAXG();
    return () => clearInterval(id);
  }, [metrics.regime]);

  return (
    <div style={{ background: '#050505', color: '#e5e5e5', minHeight: '100vh', padding: '20px', fontFamily: 'monospace' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #222', paddingBottom: '10px' }}>
        <span style={{ fontSize: '10px', color: '#666' }}>SENTINEL V8.0 // PAXG.USDT</span>
        <span style={{ fontSize: '10px', color: '#00ffcc' }}>● ACTIVE</span>
      </div>

      <div style={{ marginTop: '30px' }}>
        <h1 style={{ fontSize: '42px', margin: '0' }}>${price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h1>
        <div style={{ color: metrics.regime.includes('PANIC') ? '#ff4444' : '#00ffcc', fontWeight: 'bold', fontSize: '14px' }}>
          {metrics.regime}
        </div>
      </div>

      {/* CHART AREA: CANDLESTICKS + POLYLINE OVERLAY */}
      <div style={{ marginTop: '20px', background: '#0a0a0a', padding: '15px', border: '1px solid #111', position: 'relative' }}>
        <div style={{ fontSize: '9px', color: '#444', marginBottom: '10px' }}>HYBRID MARKET VIEW (CANDLES + MOMENTUM)</div>
        <svg viewBox="0 0 300 100" style={{ width: '100%', height: '150px', overflow: 'visible' }}>
          {/* 1. Candlesticks */}
          {candles.map((c, i) => {
            const x = (i * 24) + 12;
            const slice = history.current.slice(-50);
            const min = Math.min(...slice);
            const max = Math.max(...slice);
            const range = max - min || 5;
            const getY = (v: number) => 100 - ((v - min) / range) * 80;
            return (
              <g key={i} opacity="0.4">
                <line x1={x} y1={getY(c.h)} x2={x} y2={getY(c.l)} stroke={c.c >= c.o ? '#00ffcc' : '#ff4444'} />
                <rect x={x - 6} y={Math.min(getY(c.o), getY(c.c))} width="12" height={Math.max(Math.abs(getY(c.o) - getY(c.c)), 2)} fill={c.c >= c.o ? '#00ffcc' : '#ff4444'} />
              </g>
            );
          })}

          {/* 2. Cyan Polyline Overlay */}
          <polyline
            points={history.current.slice(-20).map((p, i) => {
              const slice = history.current.slice(-20);
              const min = Math.min(...slice);
              const max = Math.max(...slice);
              const range = max - min || 5;
              const x = (i / 19) * 300;
              const y = 100 - ((p - min) / range) * 80;
              return `${x},${y}`;
            }).join(' ')}
            fill="none" stroke="#00ffcc" strokeWidth="2"
          />
        </svg>
      </div>

      {/* METRICS GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginTop: '20px' }}>
        {/* Z-PRESSURE BAR */}
        <div style={{ background: '#0a0a0a', padding: '12px', border: '1px solid #111' }}>
          <div style={{ fontSize: '8px', color: '#444' }}>Z-PRESSURE</div>
          <div style={{ fontSize: '14px', color: metrics.z < 0 ? '#ff4444' : '#00ffcc' }}>{metrics.z.toFixed(2)}</div>
          <div style={{ marginTop: '4px', height: '2px', background: metrics.z < 0 ? '#ff4444' : '#00ffcc', width: `${Math.min(Math.abs(metrics.z) * 20, 100)}%` }} />
        </div>
        
        <div style={{ background: '#0a0a0a', padding: '12px', border: '1px solid #111' }}>
          <div style={{ fontSize: '8px', color: '#444' }}>MOMENTUM</div>
          <div style={{ fontSize: '14px', color: '#fbbf24' }}>{metrics.rsi.toFixed(0)}</div>
        </div>

        <div style={{ background: '#0a0a0a', padding: '12px', border: '1px solid #111' }}>
          <div style={{ fontSize: '8px', color: '#444' }}>VOL-CORE</div>
          <div style={{ fontSize: '14px', color: '#22d3ee' }}>{(metrics.vol * 100).toFixed(4)}%</div>
        </div>
      </div>
    </div>
  );
}
