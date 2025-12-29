import { useState, useEffect, useRef } from 'react';

export default function App() {
  const [price, setPrice] = useState(0);
  const [metrics, setMetrics] = useState<any>({ vol: 0, z: 0, rsi: 50, sigma: 0, premium: 0, buyTicks: 0, sellTicks: 0 });
  const [minuteHistory, setMinuteHistory] = useState<number[]>([]);
  const [rsiHistory, setRsiHistory] = useState<number[]>([]);
  
  const tickBuffer = useRef<number[]>([]);
  const lastVar = useRef(0.0001); 
  const history = useRef<number[]>([]);
  const tradeCounters = useRef({ buy: 0, sell: 0 });

  useEffect(() => {
    const fetchTicker = async () => {
      try {
        const res = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=PAXGUSDT');
        const data = await res.json();
        const val = parseFloat(data.price);
        if (!val) return;

        setPrice(val);
        const prev = history.current[history.current.length - 1] || val;
        history.current = [...history.current, val].slice(-100);

        if (val > prev) tradeCounters.current.buy += 1;
        if (val < prev) tradeCounters.current.sell += 1;

        const currentVol = Math.sqrt(lastVar.current);
        const z = (val - prev) / (prev * currentVol || 0.0001);
        const riskPremium = 0.5 * lastVar.current;
        const logV = -0.45 + (0.92 * Math.log(lastVar.current)) + (0.12 * (Math.abs(z) - 0.797)) + (-0.15 * z);
        const nVar = Math.exp(logV);
        lastVar.current = nVar;

        const avg = history.current.reduce((a, b) => a + b, 0) / (history.current.length || 1);
        const sigma = (val - avg) / (avg * currentVol || 0.0001);
        const premium = ((val - avg) / (avg || 1)) * 100;

        tickBuffer.current.push(val);
        if (tickBuffer.current.length >= 12) {
          setMinuteHistory(h => [...h, val].slice(-30));
          setRsiHistory(r => [...r, 50 + ((val - prev)/prev * 15000)].slice(-30));
          tickBuffer.current = [];
          tradeCounters.current = { buy: 0, sell: 0 };
        }

        setMetrics({
          vol: Math.sqrt(nVar),
          z: z + riskPremium,
          rsi: 50 + ((val - prev)/prev * 15000),
          sigma, premium,
          buyTicks: tradeCounters.current.buy,
          sellTicks: tradeCounters.current.sell
        });
      } catch (err) { console.error("Feed Error"); }
    };
    const id = setInterval(fetchTicker, 5000);
    fetchTicker();
    return () => clearInterval(id);
  }, []);

  const total = metrics.buyTicks + metrics.sellTicks || 1;
  const buyPct = (metrics.buyTicks / total) * 100;

  return (
    <div style={{ background: '#050505', color: '#e5e5e5', minHeight: '100vh', padding: '20px', fontFamily: 'monospace' }}>
      <div style={{ borderLeft: '3px solid #00ffcc', paddingLeft: '15px' }}>
        <h1 style={{ fontSize: '38px', margin: '0' }}>${price.toLocaleString()}</h1>
        <div style={{ fontSize: '10px', color: '#666' }}>GARCH-M MEAN: +{(metrics.z * 0.01).toFixed(6)}%</div>
      </div>

      <div style={{ marginTop: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px' }}>
          <span style={{ color: '#00ffcc' }}>BUY [{metrics.buyTicks}]</span>
          <span style={{ color: '#ff4444' }}>SELL [{metrics.sellTicks}]</span>
        </div>
        <div style={{ height: '8px', background: '#111', display: 'flex', marginTop: '5px' }}>
          <div style={{ width: `${buyPct}%`, background: '#00ffcc' }} />
          <div style={{ flex: 1, background: '#ff4444' }} />
        </div>
      </div>

      <div style={{ marginTop: '20px', background: '#080808', border: '1px solid #151515', padding: '10px' }}>
        <svg viewBox="0 0 300 100" style={{ width: '100%', height: '140px', overflow: 'visible' }}>
          {minuteHistory.length > 1 && (
            <polyline points={minuteHistory.map((p, i) => `${(i / (minuteHistory.length - 1)) * 300},${100 - ((p - Math.min(...minuteHistory)) / (Math.max(...minuteHistory) - Math.min(...minuteHistory) || 1)) * 80}`).join(' ')} fill="none" stroke="#fff" strokeWidth="1.5" />
          )}
          {rsiHistory.length > 1 && (
            <polyline points={rsiHistory.map((r, i) => `${(i / (rsiHistory.length - 1)) * 300},${50 - (r - 50)}`).join(' ')} fill="none" stroke="#fbbf24" strokeWidth="1" opacity="0.4" />
          )}
        </svg>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '20px' }}>
        <div style={{ background: '#0a0a0a', padding: '12px', border: '1px solid #111' }}>
          <div style={{ fontSize: '8px', color: '#444' }}>SIGMA V7.5</div>
          <div style={{ fontSize: '16px', color: '#22d3ee' }}>{metrics.sigma.toFixed(4)}σ</div>
        </div>
        <div style={{ background: '#0a0a0a', padding: '12px', border: '1px solid #111' }}>
          <div style={{ fontSize: '8px', color: '#444' }}>MARKET PREMIUM</div>
          <div style={{ fontSize: '16px', color: metrics.premium > 0 ? '#00ffcc' : '#ff4444' }}>{metrics.premium.toFixed(4)}%</div>
        </div>
      </div>
    </div>
  );
}
