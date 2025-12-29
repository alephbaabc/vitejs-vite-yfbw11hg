import { useState, useEffect, useRef } from 'react';

export default function App() {
  const [price, setPrice] = useState(0);
  const [metrics, setMetrics] = useState({ vol: 0, z: 0, rsi: 50, regime: 'INITIALIZING' });
  const [candles, setCandles] = useState<{o:number, h:number, l:number, c:number}[]>([]);
  
  // --- RESTORED CORE ENGINE REFS ---
  const history = useRef<number[]>([]);
  const lastVar = useRef(0.0001); // The "Memory" of the volatility

  useEffect(() => {
    const getPAXG = () => {
      fetch('https://api.binance.com/api/v3/ticker/price?symbol=PAXGUSDT')
        .then((r) => r.json())
        .then((d) => {
          const val = parseFloat(d.price);
          setPrice(val);
          
          const prev = history.current[history.current.length - 1] || val;
          const ret = (val - prev) / prev; // Percentage return
          history.current = [...history.current, val].slice(-50);

          // --- RESTORED EGARCH V8.0 CALCULATIONS ---
          const currentVol = Math.sqrt(lastVar.current);
          const z = ret / (currentVol || 0.0001);

          // Advanced Volatility Forecasting Math
          const logV = -0.45 + (0.92 * Math.log(lastVar.current)) + (0.12 * (Math.abs(z) - 0.797)) + (-0.15 * z);
          const nVar = Math.exp(logV);
          lastVar.current = nVar;

          // --- CANDLESTICK PACKAGING ---
          if (history.current.length % 5 === 0) {
            const slice = history.current.slice(-5);
            setCandles(prev => [...prev, { o: slice[0], h: Math.max(...slice), l: Math.min(...slice), c: slice[4] }].slice(-12));
          }

          // --- METRIC SYNC ---
          const mom = 50 + (ret * 10000); // High-sensitivity momentum
          const isPanic = nVar > 0.005 && z < -1.5;

          setMetrics({
            vol: Math.sqrt(nVar),
            z: z,
            rsi: mom,
            regime: isPanic ? 'CRITICAL ALPHA (PANIC)' : nVar > 0.003 ? 'VOL EXPANSION' : 'STABLE ACCUM'
          });
                    // --- VOICE ALERT ENGINE ---
          const announce = (text: string) => {
            if (window.speechSynthesis.speaking) return; // Don't overlap voices
            const msg = new SpeechSynthesisUtterance(text);
            msg.rate = 0.9;
            window.speechSynthesis.speak(msg);
          };

          if (isPanic && metrics.regime !== 'CRITICAL ALPHA (PANIC)') {
            announce("Warning. Critical Alpha. Price Panic Detected.");
          } else if (nVar > 0.003 && metrics.regime === 'STABLE ACCUM') {
            announce("Volatility Expansion detected.");
          }

        })
        .catch(err => console.error('Feed Error:', err));
    };

    const id = setInterval(getPAXG, 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ background: '#050505', color: '#e5e5e5', minHeight: '100vh', padding: '20px', fontFamily: 'monospace' }}>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #222', paddingBottom: '10px' }}>
        <span style={{ fontSize: '10px', color: '#666' }}>SENTINEL V8.0 // EGARCH ENGINE</span>
        <span style={{ fontSize: '10px', color: '#00ffcc' }}>● ACTIVE</span>
      </div>

      {/* LIVE PRICE & REGIME */}
      <div style={{ marginTop: '30px' }}>
        <h1 style={{ fontSize: '42px', margin: '0' }}>${price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h1>
        <div style={{ color: metrics.regime.includes('PANIC') ? '#ff4444' : '#00ffcc', fontWeight: 'bold', fontSize: '14px' }}>
          {metrics.regime}
        </div>
      </div>

      {/* CANDLESTICK LAYER */}
      <div style={{ marginTop: '20px', background: '#0a0a0a', padding: '15px', border: '1px solid #111' }}>
        <svg viewBox="0 0 300 100" style={{ width: '100%', height: '120px' }}>
          {candles.map((c, i) => {
            const x = (i * 24) + 12;
            const min = Math.min(...history.current);
            const max = Math.max(...history.current);
            const range = max - min || 1;
            const getY = (v: number) => 100 - ((v - min) / range) * 80;
            return (
              <g key={i}>
                <line x1={x} y1={getY(c.h)} x2={x} y2={getY(c.l)} stroke={c.c >= c.o ? '#00ffcc' : '#ff4444'} />
                <rect x={x - 6} y={Math.min(getY(c.o), getY(c.c))} width="12" height={Math.max(Math.abs(getY(c.o) - getY(c.c)), 2)} fill={c.c >= c.o ? '#00ffcc' : '#ff4444'} />
              </g>
            );
          })}
        </svg>
      </div>

      {/* METRICS GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginTop: '20px' }}>
                <div style={{ background: '#0a0a0a', padding: '12px', border: '1px solid #111', overflow: 'hidden' }}>
          <div style={{ fontSize: '8px', color: '#444' }}>Z-PRESSURE</div>
          <div style={{ fontSize: '14px', color: metrics.z < 0 ? '#ff4444' : '#00ffcc' }}>
            {metrics.z.toFixed(2)}
          </div>
          {/* PRESSURE BAR */}
          <div style={{ 
            marginTop: '4px',
            height: '2px', 
            background: metrics.z < 0 ? '#ff4444' : '#00ffcc', 
            width: `${Math.min(Math.abs(metrics.z) * 20, 100)}%`,
            boxShadow: metrics.z < -2 ? '0 0 8px #ff4444' : 'none',
            transition: 'width 0.4s ease' 
          }} />
        </div>
        <Stat label="MOMENTUM" val={metrics.rsi.toFixed(0)} color="#fbbf24" />
        <Stat label="VOL-CORE" val={(metrics.vol * 100).toFixed(4)} color="#22d3ee" />
      </div>
    </div>
  );
}

// Helper component for cleaner code
function Stat({ label, val, color }: { label: string, val: string, color: string }) {
  return (
    <div style={{ background: '#0a0a0a', padding: '12px', border: '1px solid #111' }}>
      <div style={{ fontSize: '8px', color: '#444' }}>{label}</div>
      <div style={{ fontSize: '14px', color: color }}>{val}</div>
    </div>
  );
}
