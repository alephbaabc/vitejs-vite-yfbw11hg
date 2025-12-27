import React, { useState, useEffect, useRef } from 'react';

export default function App() {
  const [price, setPrice] = useState(4551.68);
  const [panic, setPanic] = useState(false);
  const [metrics, setMetrics] = useState({
    vol: 0.12,
    z: 0,
    regime: 'STABLE',
    rsi: 50,
  });
  const lastVar = useRef(0.0144);
  const history = useRef([4551.68]);

  const tick = (p) => {
    const prev = history.current[history.current.length - 1] || p;
    const ret = (p - prev) / prev;
    const currentVol = Math.sqrt(lastVar.current);
    const z = ret / (currentVol || 0.001);

    // --- EGARCH V8.0 CORE ---
    const logV =
      -0.45 +
      0.92 * Math.log(lastVar.current) +
      0.12 * (Math.abs(z) - 0.797) +
      -0.15 * z;
    const nVar = Math.exp(logV);
    lastVar.current = nVar;
    history.current.push(p);

    const isPanic = nVar > 0.4 && z < -1.2;
    setPanic(isPanic);

    setMetrics({
      vol: Math.sqrt(nVar),
      z: z,
      regime: isPanic
        ? 'CRITICAL ALPHA'
        : nVar > 0.3
        ? 'VOL EXPANSION'
        : 'STABLE ACCUM',
      rsi: 50 + z * 15,
    });
  };

  useEffect(() => {
    const getPAXG = () => {
      fetch('https://api.binance.com/api/v3/ticker/price?symbol=PAXGUSDT')
        .then((r) => r.json())
        .then((d) => {
          const val = parseFloat(d.price);
          setPrice(val);
          tick(val);
        })
        .catch((err) => console.log('Feed Syncing...'));
    };
    getPAXG();
    const id = setInterval(getPAXG, 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      style={{
        background: '#050505',
        color: '#e5e5e5',
        minHeight: '100vh',
        fontFamily: 'monospace',
        padding: '20px',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          borderBottom: '1px solid #222',
          paddingBottom: '10px',
        }}
      >
        <span style={{ fontSize: '10px', letterSpacing: '2px', color: '#666' }}>
          SENTINEL V8.0 // PAXG.USDT
        </span>
        <span
          style={{ fontSize: '10px', color: panic ? '#ff4444' : '#00ffcc' }}
        >
          {panic ? '⚠️ HIGH RISK' : '● LIVE FEED'}
        </span>
      </div>

      <div style={{ marginTop: '30px' }}>
        <h1 style={{ fontSize: '42px', margin: '0', fontWeight: '300' }}>
          ${price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </h1>
        <div
          style={{
            color: panic ? '#ff4444' : '#00ffcc',
            fontWeight: 'bold',
            fontSize: '14px',
            marginTop: '5px',
          }}
        >
          {metrics.regime}
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: '10px',
          marginTop: '30px',
        }}
      >
        <div
          style={{
            background: '#0a0a0a',
            padding: '15px',
            border: '1px solid #111',
          }}
        >
          <div style={{ fontSize: '9px', color: '#444' }}>VOL (ANN)</div>
          <div style={{ fontSize: '16px', color: '#22d3ee' }}>
            {(metrics.vol * 100).toFixed(2)}%
          </div>
        </div>
        <div
          style={{
            background: '#0a0a0a',
            padding: '15px',
            border: '1px solid #111',
          }}
        >
          <div style={{ fontSize: '9px', color: '#444' }}>Z-SHOCK</div>
          <div
            style={{
              fontSize: '16px',
              color: metrics.z < 0 ? '#ff4444' : '#00ffcc',
            }}
          >
            {metrics.z.toFixed(2)}
          </div>
        </div>
        <div
          style={{
            background: '#0a0a0a',
            padding: '15px',
            border: '1px solid #111',
          }}
        >
          <div style={{ fontSize: '9px', color: '#444' }}>MOMENTUM</div>
          <div style={{ fontSize: '16px', color: '#fbbf24' }}>
            {metrics.rsi.toFixed(0)}
          </div>
        </div>
      </div>

      <div style={{ marginTop: '40px' }}>
        <div style={{ fontSize: '9px', color: '#444', marginBottom: '8px' }}>
          RISK EXPOSURE
        </div>
        <div style={{ height: '2px', background: '#111', width: '100%' }}>
          <div
            style={{
              height: '100%',
              width: `${Math.min(metrics.vol * 200, 100)}%`,
              background: panic ? '#f00' : '#00ffcc',
              transition: 'width 0.8s ease',
            }}
          />
        </div>
      </div>
    </div>
  );
}
