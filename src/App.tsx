import { useState, useEffect, useRef } from 'react';

export default function App() {
  const [price, setPrice] = useState(0);
  const [metrics, setMetrics] = useState<any>({ vol: 0, z: 0, rsi: 50, sigma: 0, premium: 0, buyTicks: 0, sellTicks: 0, regime: 'INITIALIZING' });
  const [minuteHistory, setMinuteHistory] = useState<number[]>([]);
  const [rsiHistory, setRsiHistory] = useState<number[]>([]);
  
  const tickBuffer = useRef<number[]>([]);
  const lastVar = useRef(0.0001); // THE EGARCH MEMORY
  const history = useRef<number[]>([]);
  const tradeCounters = useRef({ buy: 0, sell: 0 });

  useEffect(() => {
    const announce = (text: string) => {
      if (window.speechSynthesis.speaking) return;
      const msg = new SpeechSynthesisUtterance(text);
      msg.rate = 0.9;
      window.speechSynthesis.speak(msg);
    };

    const runEngine = async () => {
      try {
        const res = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=PAXGUSDT');
        const data = await res.json();
        const val = parseFloat(data.price);
        if (!val) return;

        setPrice(val);
        const prev = history.current[history.current.length - 1] || val;
        const ret = (val - prev) / (prev || 1);
        history.current = [...history.current, val].slice(-100);

        // 1. STEALTH TICK COUNTERS
        if (val > prev) tradeCounters.current.buy += 1;
        if (val < prev) tradeCounters.current.sell += 1;

        // 2. RESTORED EGARCH + GARCH-M MATH
        const currentVol = Math.sqrt(lastVar.current);
        const z = ret / (currentVol || 0.0001);
        
        // Asymmetric Volatility Forecast
        const logV = -0.45 + (0.92 * Math.log(lastVar.current)) + (0.12 * (Math.abs(z) - 0.797)) + (-0.15 * z);
        const nVar = Math.exp(logV);
        lastVar.current = nVar;

        // GARCH-M Risk Premium
        const riskPremium = 0.5 * nVar;

        // 3. SIGMA & PREMIUM
        const avg = history.current.reduce((a, b) => a + b, 0) / (history.current.length || 1);
        const sigma = (val - avg) / (avg * currentVol || 0.0001);
        const premium = ((val - avg) / (avg || 1)) * 100;

        // 4. 1-MINUTE AGGREGATION
        tickBuffer.current.push(val);
        if (tickBuffer.current.length >= 12) {
          setMinuteHistory(h => [...h, val].slice(-40));
          setRsiHistory(r => [...r, 50 + (ret * 20000)].slice(-40));
          tickBuffer.current = [];
          tradeCounters.current = { buy: 0, sell: 0 };
        }

        const isPanic = nVar > 0.005 && z < -1.5;
        if (isPanic && metrics.regime !== 'PANIC') {
          announce("Sentinel Warning. Critical Alpha Panic.");
        }

        setMetrics({
          vol: Math.sqrt(nVar),
          z: z + riskPremium,
          rsi: 50 + (ret * 20000),
          sigma, premium,
          buyTicks: tradeCounters.current.buy,
          sellTicks: tradeCounters.current.sell,
          regime: isPanic ? 'PANIC' : nVar > 0.003 ? 'VOL EXPANSION' : 'STABLE'
        });
      } catch (err) { console.log("Engine Sync Error"); }
    };

    const id = setInterval(runEngine, 5000);
    runEngine();
    return () => clearInterval(id);
  }, [metrics.regime]);

  const total = metrics.buyTicks + metrics.sellTicks || 1;
  const buyPct = (metrics.buyTicks / total) * 100;

  return (
    <div style={{ background: '#050505', color: '#e5e5e5', minHeight: '100vh', padding: '20px', fontFamily: 'monospace' }}>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #222', paddingBottom: '10px', marginBottom: '20px' }}>
        <span style={{ fontSize: '10px', color: '#666' }}>SENTINEL V8.0 // EGARCH + GARCH-M</span>
        <span style={{ fontSize: '10px', color: '#00ffcc' }}>● ACTIVE</span>
      </div>

      {/* PRICE & GARCH-M PREMIUM */}
      <div style={{ borderLeft: '3px solid #00ffcc', paddingLeft: '15px' }}>
        <h1 style={{ fontSize: '42px', margin: '0' }}>${price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h1>
        <div style={{ fontSize: '11px', color: '#fbbf24' }}>
          GARCH-M RISK PREMIUM: +{(metrics.z * 0.01).toFixed(6)}%
        </div>
      </div>

      {/* STEALTH TICK BAR */}
      <div style={{ marginTop: '25px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', marginBottom: '5px' }}>
          <span style={{ color: '#00ffcc' }}>STEALTH BUY [{metrics.buyTicks}]</span>
          <span style={{ color: '#ff4444' }}>[{metrics.sellTicks}] STEALTH SELL</span>
        </div>
        <div style={{ height: '8px', background: '#111', width: '100%', display: 'flex', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{ width: `${buyPct}%`, background: '#00ffcc', transition: 'width 0.4s ease' }} />
          <div style={{ flex: 1, background: '#ff4444' }} />
        </div>
      </div>

      {/* 1m HYBRID CHART */}
      <div style={{ marginTop: '20px', background: '#080808', border: '1px solid #151515', padding: '15px' }}>
        <svg viewBox="0 0 300 100" style={{ width: '100%', height: '160px', overflow: 'visible' }}>
          {minuteHistory.length > 1 && (
            <polyline 
              points={minuteHistory.map((p, i) => `${(i / (minuteHistory.length - 1)) * 300},${100 - ((p - Math.min(...minuteHistory)) / (Math.max(...minuteHistory) - Math.min(...minuteHistory) || 1)) * 80}`).join(' ')} 
              fill="none" stroke="#fff" strokeWidth="1.5" 
            />
          )}
          {rsiHistory.length > 1 && (
            <polyline 
              points={rsiHistory.map((r, i) => `${(i / (rsiHistory.length - 1)) * 300},${50 - (r - 50)}`).join(' ')} 
              fill="none" stroke="#fbbf24" strokeWidth="1" opacity="0.4" 
            />
          )}
        </svg>
      </div>

      {/* CORE METRICS GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '20px' }}>
        <Stat label="SIGMA (DISTANCE)" val={`${metrics.sigma.toFixed(4)}σ`} color="#22d3ee" />
        <Stat label="MARKET PREMIUM" val={`${metrics.premium.toFixed(4)}%`} color={metrics.premium > 0 ? '#00ffcc' : '#ff4444'} />
        <Stat label="EGARCH VOL" val={`${(metrics.vol * 100).toFixed(4)}%`} color="#fbbf24" />
        <Stat label="REGIME" val={metrics.regime} color={metrics.regime === 'PANIC' ? '#ff4444' : '#00ffcc'} />
      </div>
    </div>
  );
}

function Stat({ label, val, color }: any) {
  return (
    <div style={{ background: '#0a0a0a', padding: '12px', border: '1px solid #111' }}>
      <div style={{ fontSize: '8px', color: '#444' }}>{label}</div>
      <div style={{ fontSize: '14px', color: color }}>{val}</div>
    </div>
  );
}
