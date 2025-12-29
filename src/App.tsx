import { useState, useEffect, useRef } from 'react';

export default function App() {
  const [price, setPrice] = useState(0);
  const [metrics, setMetrics] = useState<any>({ 
    vol: 0, z: 0, rsi: 50, sigma: 0, premium: 0, buyTicks: 0, sellTicks: 0 
  });
  
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
        const ret = (val - prev) / (prev || 1);
        history.current = [...history.current, val].slice(-100);

        if (val > prev) tradeCounters.current.buy += 1;
        if (val < prev) tradeCounters.current.sell += 1;

        // EGARCH + GARCH-M
        const currentVol = Math.sqrt(lastVar.current);
        const z = ret / (currentVol || 0.0001);
        const riskPremium = 0.5 * lastVar.current;
        const logV = -0.45 + (0.92 * Math.log(lastVar.current)) + (0.12 * (Math.abs(z) - 0.797)) + (-0.15 * z);
        const nVar = Math.exp(logV);
        lastVar.current = nVar;

        // V7.5 Metrics
        const avg = history.current.reduce((a, b) => a + b, 0) / (history.current.length || 1);
        const sigma = (val - avg) / (avg * currentVol || 0.0001);
        const premium = ((val - avg) / (avg || 1)) * 100;

        tickBuffer.current.push(val);
        if (tickBuffer.current.length >= 12) {
          setMinuteHistory(h => [...h, val].slice(-30));
          setRsiHistory(r => [...r, 50 + (ret * 15000)].slice(-30));
          tickBuffer.current = [];
          tradeCounters.current = { buy: 0, sell: 0 };
        }

        setMetrics({
          vol: Math.sqrt(nVar),
          z: z + riskPremium,
          rsi: 50 + (ret * 15000),
          sigma,
          premium,
          buyTicks: tradeCounters.current.buy,
          sellTicks: tradeCounters.current.sell
        });
      } catch (err) {
        console.log("Feed Offline");
      }
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
        setMetrics({
          vol: Math.sqrt(nVar),
          z: z + riskPremium,
          rsi: 50 + (ret * 15000),
          sigma,
          premium,
          buyTicks: tradeCounters.current.buy,
          sellTicks: tradeCounters.current.sell
        });
      } catch (e) {
        console.error("Build-Safe Error Catch:", e);
      }
    };

    const id = setInterval(getPAXG, 5000);
    getPAXG();
    return () => clearInterval(id);
  }, []);

  const totalTicks = metrics.buyTicks + metrics.sellTicks || 1;
  const buyPct = (metrics.buyTicks / totalTicks) * 100;

  return (
    <div style={{ background: '#050505', color: '#e5e5e5', minHeight: '100vh', padding: '20px', fontFamily: 'monospace' }}>
      <div style={{ borderLeft: '3px solid #00ffcc', paddingLeft: '15px' }}>
        <h1 style={{ fontSize: '38px', margin: '0' }}>${price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h1>
        <div style={{ fontSize: '10px', color: '#666', marginTop: '5px' }}>
          GARCH-M MEAN: <span style={{ color: '#fbbf24' }}>+{(metrics.z * 0.01).toFixed(6)}%</span>
        </div>
      </div>

      <div style={{ marginTop: '25px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', marginBottom: '5px' }}>
          <span>STEALTH BUY [{metrics.buyTicks}]</span>
          <span>[{metrics.sellTicks}] STEALTH SELL</span>
        </div>
        <div style={{ height: '8px', background: '#111', width: '100%', display: 'flex', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{ width: `${buyPct}%`, background: '#00ffcc' }} />
          <div style={{ flex: 1, background: '#ff4444' }} />
        </div>
      </div>

      <div style={{ marginTop: '20px', background: '#080808', border: '1px solid #151515', padding: '15px' }}>
         <svg viewBox="0 0 300 100" style={{ width: '100%', height: '140px', overflow: 'visible' }}>
            {minuteHistory.length > 1 && (
              <polyline 
                points={minuteHistory.map((p, i) => {
                  const min = Math.min(...minuteHistory);
                  const max = Math.max(...minuteHistory);
                  const range = max - min || 1;
                  return `${(i / (minuteHistory.length - 1)) * 300},${100 - ((p - min) / range) * 80}`;
                }).join(' ')} 
                fill="none" stroke="#ffffff" strokeWidth="1.5" 
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '20px' }}>
        <div style={{ background: '#0a0a0a', padding: '15px', border: '1px solid #111' }}>
          <div style={{ fontSize: '8px', color: '#444' }}>SIGMA V7.5</div>
          <div style={{ fontSize: '18px', color: '#22d3ee' }}>{metrics.sigma.toFixed(4)}σ</div>
        </div>
        <div style={{ background: '#0a0a0a', padding: '15px', border: '1px solid #111' }}>
          <div style={{ fontSize: '8px', color: '#444' }}>MARKET PREMIUM</div>
          <div style={{ fontSize: '18px', color: metrics.premium > 0 ? '#00ffcc' : '#ff4444' }}>
            {metrics.premium.toFixed(4)}%
          </div>
        </div>
      </div>
    </div>
  );
}
            tickBuffer.current = [];
            tradeCounters.current = { buy: 0, sell: 0 }; 
          }

          setMetrics({
            vol: Math.sqrt(nVar),
            z: z + riskPremium,
            rsi: 50 + (ret * 15000),
            sigma: sigma,
            premium: premium,
            buyTicks: tradeCounters.current.buy,
            sellTicks: tradeCounters.current.sell
          });
        })
        .catch(err => console.error('Feed Sync Error:', err));
    };

    const id = setInterval(getPAXG, 5000);
    getPAXG();
    return () => clearInterval(id);
  }, []);

  const totalTicks = metrics.buyTicks + metrics.sellTicks || 1;
  const buyPct = (metrics.buyTicks / totalTicks) * 100;

  return (
    <div style={{ background: '#050505', color: '#e5e5e5', minHeight: '100vh', padding: '20px', fontFamily: 'monospace' }}>
      {/* PRICE BLOCK + GARCH-M MEAN */}
      <div style={{ borderLeft: '3px solid #00ffcc', paddingLeft: '15px' }}>
        <h1 style={{ fontSize: '38px', margin: '0' }}>${price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h1>
        <div style={{ fontSize: '10px', color: '#666', marginTop: '5px' }}>
          GARCH-M MEAN: <span style={{ color: '#fbbf24' }}>+{(metrics.z * 0.01).toFixed(6)}%</span>
        </div>
      </div>

      {/* STEALTH COUNTER BAR */}
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

      {/* TF=1m CHART OVERLAY */}
      <div style={{ marginTop: '20px', background: '#080808', border: '1px solid #151515', padding: '15px' }}>
         <svg viewBox="0 0 300 100" style={{ width: '100%', height: '140px', overflow: 'visible' }}>
            {/* White Close Line (1m) */}
            {minuteHistory.length > 1 && (
              <polyline 
                points={minuteHistory.map((p, i) => {
                  const min = Math.min(...minuteHistory);
                  const max = Math.max(...minuteHistory);
                  const range = max - min || 1;
                  return `${(i / (minuteHistory.length - 1)) * 300},${100 - ((p - min) / range) * 80}`;
                }).join(' ')} 
                fill="none" stroke="#ffffff" strokeWidth="1.5" 
              />
            )}
            {/* Gold RSI Overlay (1m) */}
            {rsiHistory.length > 1 && (
              <polyline 
                points={rsiHistory.map((r, i) => `${(i / (rsiHistory.length - 1)) * 300},${50 - (r - 50)}`).join(' ')} 
                fill="none" stroke="#fbbf24" strokeWidth="1" opacity="0.4" 
              />
            )}
         </svg>
      </div>

      {/* V7.5 QUANT METRICS */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '20px' }}>
        <div style={{ background: '#0a0a0a', padding: '15px', border: '1px solid #111' }}>
          <div style={{ fontSize: '8px', color: '#444' }}>SIGMA V7.5</div>
          <div style={{ fontSize: '18px', color: '#22d3ee' }}>{metrics.sigma.toFixed(4)}σ</div>
        </div>
        <div style={{ background: '#0a0a0a', padding: '15px', border: '1px solid #111' }}>
          <div style={{ fontSize: '8px', color: '#444' }}>MARKET PREMIUM</div>
          <div style={{ fontSize: '18px', color: metrics.premium > 0 ? '#00ffcc' : '#ff4444' }}>
            {metrics.premium.toFixed(4)}%
          </div>
        </div>
      </div>
    </div>
  );
}
          if (tickBuffer.current.length >= 12) {
            setMinuteHistory(prevH => [...prevH, val].slice(-30));
            setRsiHistory(prevR => [...prevR, 50 + (ret * 15000)].slice(-30));
            tickBuffer.current = [];
            tradeCounters.current = { buy: 0, sell: 0 }; 
          }

          setMetrics({
            vol: Math.sqrt(nVar),
            z: z + riskPremium,
            rsi: 50 + (ret * 15000),
            sigma: sigma,
            premium: premium,
            buyTicks: tradeCounters.current.buy,
            sellTicks: tradeCounters.current.sell,
            regime: nVar > 0.005 ? 'VOL EXPANSION' : 'STABLE ACCUM'
          });
        })
        .catch(err => console.error('Feed Error:', err));
    };

    const id = setInterval(getPAXG, 5000);
    getPAXG();
    return () => clearInterval(id);
  }, []);

  const totalTicks = metrics.buyTicks + metrics.sellTicks || 1;
  const buyPct = (metrics.buyTicks / totalTicks) * 100;

  return (
    <div style={{ background: '#050505', color: '#e5e5e5', minHeight: '100vh', padding: '20px', fontFamily: 'monospace' }}>
      {/* PRICE BLOCK + GARCH-M MEAN */}
      <div style={{ borderLeft: '3px solid #00ffcc', paddingLeft: '15px' }}>
        <h1 style={{ fontSize: '38px', margin: '0' }}>${price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h1>
        <div style={{ fontSize: '10px', color: '#666', marginTop: '5px' }}>
          GARCH-M MEAN: <span style={{ color: '#fbbf24' }}>+{(metrics.z * 0.01).toFixed(6)}%</span>
        </div>
      </div>

      {/* STEALTH COUNTER BAR */}
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

      {/* TF=1m CHART OVERLAY */}
      <div style={{ marginTop: '20px', background: '#080808', border: '1px solid #151515', padding: '15px' }}>
         <svg viewBox="0 0 300 100" style={{ width: '100%', height: '140px', overflow: 'visible' }}>
            {/* White Close Line */}
            {minuteHistory.length > 1 && (
              <polyline 
                points={minuteHistory.map((p, i) => {
                  const min = Math.min(...minuteHistory);
                  const max = Math.max(...minuteHistory);
                  const range = max - min || 1;
                  return `${(i / (minuteHistory.length - 1)) * 300},${100 - ((p - min) / range) * 80}`;
                }).join(' ')} 
                fill="none" stroke="#ffffff" strokeWidth="1.5" 
              />
            )}
            {/* Gold RSI Overlay */}
            {rsiHistory.length > 1 && (
              <polyline 
                points={rsiHistory.map((r, i) => `${(i / (rsiHistory.length - 1)) * 300},${50 - (r - 50)}`).join(' ')} 
                fill="none" stroke="#fbbf24" strokeWidth="1" opacity="0.4" 
              />
            )}
         </svg>
      </div>

      {/* V7.5 SUPER HYBRID METRICS */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '20px' }}>
        <div style={{ background: '#0a0a0a', padding: '15px', border: '1px solid #111' }}>
          <div style={{ fontSize: '8px', color: '#444' }}>SIGMA V7.5</div>
          <div style={{ fontSize: '18px', color: '#22d3ee' }}>{metrics.sigma.toFixed(4)}σ</div>
        </div>
        <div style={{ background: '#0a0a0a', padding: '15px', border: '1px solid #111' }}>
          <div style={{ fontSize: '8px', color: '#444' }}>MARKET PREMIUM</div>
          <div style={{ fontSize: '18px', color: metrics.premium > 0 ? '#00ffcc' : '#ff4444' }}>
            {metrics.premium.toFixed(4)}%
          </div>
        </div>
      </div>
    </div>
  );
}
            buyTicks: tradeCounters.current.buy,
            sellTicks: tradeCounters.current.sell
          });
        })
        .catch(err => console.error('Feed Error:', err));
    };

    const id = setInterval(getPAXG, 5000);
    getPAXG();
    return () => clearInterval(id);
  }, []);

  const totalTicks = metrics.buyTicks + metrics.sellTicks || 1;
  const buyPct = (metrics.buyTicks / totalTicks) * 100;

  return (
    <div style={{ background: '#050505', color: '#e5e5e5', minHeight: '100vh', padding: '20px', fontFamily: 'monospace' }}>
      {/* PRICE BLOCK + GARCH-M COMPARISON */}
      <div style={{ borderLeft: '3px solid #00ffcc', paddingLeft: '15px' }}>
        <h1 style={{ fontSize: '40px', margin: '0' }}>${price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h1>
        <div style={{ fontSize: '10px', color: '#666', marginTop: '5px' }}>
          GARCH-M MEAN: <span style={{ color: '#fbbf24' }}>+{(metrics.z * 0.01).toFixed(6)}%</span>
        </div>
      </div>

      {/* STEALTH TRADES COUNTER BAR */}
      <div style={{ marginTop: '25px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', marginBottom: '5px' }}>
          <span style={{ color: '#00ffcc' }}>STEALTH BUYS: {metrics.buyTicks}</span>
          <span style={{ color: '#ff4444' }}>STEALTH SELLS: {metrics.sellTicks}</span>
        </div>
        <div style={{ height: '8px', background: '#111', width: '100%', display: 'flex', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{ width: `${buyPct}%`, background: '#00ffcc', transition: 'width 0.4s ease' }} />
          <div style={{ flex: 1, background: '#ff4444' }} />
        </div>
      </div>

      {/* TF=1m HYBRID CHART */}
      <div style={{ marginTop: '20px', background: '#080808', border: '1px solid #151515', padding: '15px' }}>
         <svg viewBox="0 0 300 100" style={{ width: '100%', height: '140px', overflow: 'visible' }}>
            {/* White Close Line (1m) */}
            <polyline 
               points={minuteHistory.map((p, i) => `${(i/29)*300},${100 - ((p - Math.min(...minuteHistory)) / (Math.max(...minuteHistory) - Math.min(...minuteHistory) || 1)) * 80}`).join(' ')} 
               fill="none" stroke="#fff" strokeWidth="1.5" 
            />
            {/* Gold RSI Overlay (1m) */}
            <polyline 
               points={rsiHistory.map((r, i) => `${(i/29)*300},${50 - (r-50)}`).join(' ')} 
               fill="none" stroke="#fbbf24" strokeWidth="1" opacity="0.5" 
            />
         </svg>
      </div>

      {/* V7.5 QUANT METRICS */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '20px' }}>
        <div style={{ background: '#0a0a0a', padding: '15px', border: '1px solid #111' }}>
          <div style={{ fontSize: '8px', color: '#666' }}>SIGMA V7.5</div>
          <div style={{ fontSize: '18px', color: '#22d3ee' }}>{metrics.sigma.toFixed(4)}σ</div>
        </div>
        <div style={{ background: '#0a0a0a', padding: '15px', border: '1px solid #111' }}>
          <div style={{ fontSize: '8px', color: '#666' }}>MARKET PREMIUM</div>
          <div style={{ fontSize: '18px', color: metrics.premium > 0 ? '#00ffcc' : '#ff4444' }}>
            {metrics.premium.toFixed(4)}%
          </div>
        </div>
      </div>
    </div>
  );
}
          });
        })
        .catch(err => console.error('Feed Error:', err));
    };

    const id = setInterval(getPAXG, 5000);
    return () => clearInterval(id);
  }, []);

  const totalTicks = metrics.buyTicks + metrics.sellTicks || 1;
  const buyPct = (metrics.buyTicks / totalTicks) * 100;

  return (
    <div style={{ background: '#050505', color: '#e5e5e5', minHeight: '100vh', padding: '20px', fontFamily: 'monospace' }}>
      {/* PRICE BLOCK + GARCH-M */}
      <div style={{ borderLeft: '3px solid #00ffcc', paddingLeft: '15px' }}>
        <h1 style={{ fontSize: '40px', margin: '0' }}>${price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h1>
        <div style={{ fontSize: '10px', color: '#666' }}>
          GARCH-M PREMIUM: <span style={{ color: '#fbbf24' }}>+{(metrics.z * 0.01).toFixed(5)}%</span>
        </div>
      </div>

      {/* STEALTH TRADES COUNTER BAR */}
      <div style={{ marginTop: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', marginBottom: '4px' }}>
          <span style={{ color: '#00ffcc' }}>STEALTH BUY [{metrics.buyTicks}]</span>
          <span style={{ color: '#ff4444' }}>[{metrics.sellTicks}] STEALTH SELL</span>
        </div>
        <div style={{ height: '6px', background: '#111', width: '100%', display: 'flex' }}>
          <div style={{ width: `${buyPct}%`, background: '#00ffcc', transition: 'width 0.5s' }} />
          <div style={{ flex: 1, background: '#ff4444' }} />
        </div>
      </div>

      {/* CHART (1m TF) */}
      <div style={{ marginTop: '20px', background: '#080808', border: '1px solid #151515', padding: '10px' }}>
         <svg viewBox="0 0 300 100" style={{ width: '100%', height: '140px', overflow: 'visible' }}>
            <polyline points={minuteHistory.map((p, i) => `${(i/29)*300},${100 - ((p - Math.min(...minuteHistory)) / (Math.max(...minuteHistory) - Math.min(...minuteHistory) || 1)) * 80}`).join(' ')} fill="none" stroke="#fff" strokeWidth="1.5" />
            <polyline points={rsiHistory.map((r, i) => `${(i/29)*300},${50 - (r-50)}`).join(' ')} fill="none" stroke="#fbbf24" strokeWidth="1" opacity="0.5" />
         </svg>
      </div>

      {/* V7.5 SUPER HYBRID METRICS */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '20px' }}>
        <div style={{ background: '#0a0a0a', padding: '12px', border: '1px solid #111' }}>
          <div style={{ fontSize: '8px', color: '#444' }}>SIGMA V7.5</div>
          <div style={{ fontSize: '16px', color: '#22d3ee' }}>{metrics.sigma.toFixed(4)}σ</div>
        </div>
        <div style={{ background: '#0a0a0a', padding: '12px', border: '1px solid #111' }}>
          <div style={{ fontSize: '8px', color: '#444' }}>MARKET PREMIUM</div>
          <div style={{ fontSize: '16px', color: metrics.premium > 0 ? '#00ffcc' : '#ff4444' }}>
            {metrics.premium.toFixed(4)}%
          </div>
        </div>
      </div>
    </div>
  );
}
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
