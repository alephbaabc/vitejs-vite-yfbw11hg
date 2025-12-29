import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as Lucide from 'lucide-react';

const SYMBOL = 'paxgusdt';

export default function App() {
  const [price, setPrice] = useState(0);
  const [data, setData] = useState({
    up: 0, down: 0, sBuy: 0, sSell: 0, sigma: 0, rsi: 50
  });
  const [history, setHistory] = useState<number[]>(new Array(40).fill(50));

  const engine = useRef({
    lastP: 0,
    var: 0.01,
    gain: 0,
    loss: 0
  });

  useEffect(() => {
    const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${SYMBOL}@aggTrade`);
    
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      const p = parseFloat(msg.p);
      const isBuyer = !msg.m;
      const e = engine.current;

      if (e.lastP === 0) { e.lastP = p; return; }
      
      const diff = p - e.lastP;

      // 1. GARCH/SIGMA CALC
      const nextVar = 0.03 + 0.12 * Math.pow(diff, 2) + 0.85 * e.var;
      e.var = nextVar;
      const sigma = diff / (Math.sqrt(nextVar) || 0.001);

      // 2. RSI FLUX CALC
      const g = diff > 0 ? diff : 0;
      const l = diff < 0 ? Math.abs(diff) : 0;
      e.gain = (e.gain * 13 + g) / 14;
      e.loss = (e.loss * 13 + l) / 14;
      const currentRsi = 100 - (100 / (1 + (e.gain / (e.loss || 1))));

      setData(prev => ({
        up: diff > 0 ? prev.up + 1 : prev.up,
        down: diff < 0 ? prev.down + 1 : prev.down,
        sBuy: (diff === 0 && isBuyer) ? prev.sBuy + 1 : prev.sBuy,
        sSell: (diff === 0 && !isBuyer) ? prev.sSell + 1 : prev.sSell,
        sigma: sigma,
        rsi: currentRsi
      }));

      e.lastP = p;
      setPrice(p);
    };

    const interval = setInterval(() => {
      setHistory(h => [...h.slice(1), engine.current.gain > 0 ? 50 + (engine.current.gain * 1000) : 50]);
    }, 1000);

    return () => { ws.close(); clearInterval(interval); };
  }, []);

  const cardStyle = "p-5 bg-slate-900/80 border border-slate-800 rounded-[2rem] mb-4 backdrop-blur-md";

  return (
    <div className="min-h-screen bg-[#020617] text-white p-4 font-mono select-none">
      
      {/* SECTION 1: EXECUTION (TICKS) */}
      <div className={cardStyle}>
        <div className="flex justify-between items-center mb-2">
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Execution Ticks</span>
          <div className="flex gap-4">
            <div className="flex items-center text-blue-500">
              <Lucide.Triangle size={12} className="fill-current rotate-180 mr-1" />
              <span className="text-sm font-black">{data.up}</span>
            </div>
            <div className="flex items-center text-red-500">
              <Lucide.Triangle size={12} className="fill-current mr-1" />
              <span className="text-sm font-black">{data.down}</span>
            </div>
          </div>
        </div>
        <div className="text-5xl font-black tracking-tighter text-blue-400">
          ${price.toFixed(2)}
        </div>
      </div>

      {/* SECTION 2: STEALTH FLOW (BUY/SELL BAR) */}
      <div className={cardStyle}>
        <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-2 uppercase">
          <span>Stealth Buy: {data.sBuy}</span>
          <span>Stealth Sell: {data.sSell}</span>
        </div>
        <div className="h-3 bg-red-900/20 rounded-full overflow-hidden flex border border-white/5">
          <div className="h-full bg-blue-600 transition-all duration-500" 
               style={{ width: `${(data.sBuy / (data.sBuy + data.sSell || 1)) * 100}%` }} />
        </div>
      </div>

      {/* SECTION 3: SIGMA BAR (BIDIRECTIONAL) */}
      <div className={cardStyle}>
        <span className="text-[10px] text-slate-500 font-bold uppercase block mb-3">Sigma Variance (±3σ)</span>
        <div className="relative h-2.5 bg-black/40 rounded-full border border-white/5 overflow-hidden">
          <div className="absolute left-1/2 w-0.5 h-full bg-white/30 z-10" />
          <div className={`absolute h-full transition-all duration-300 ${data.sigma > 0 ? 'bg-emerald-400' : 'bg-rose-500'}`}
               style={{ 
                 width: `${Math.min(50, Math.abs(data.sigma) * 15)}%`, 
                 left: data.sigma > 0 ? '50%' : 'auto', 
                 right: data.sigma < 0 ? '50%' : 'auto' 
               }} />
        </div>
      </div>

      {/* SECTION 4: RSI FLUX & WAVES */}
      <div className={cardStyle}>
        <div className="flex justify-between items-center mb-2">
          <span className="text-[10px] text-blue-500 font-bold uppercase">Flux Momentum Wave</span>
          <span className="text-xl font-black italic">{data.rsi.toFixed(0)}</span>
        </div>
        <div className="h-14 flex items-end gap-1 px-1">
          {history.map((v, i) => (
            <div key={i} className="flex-1 bg-blue-500/40 rounded-t-sm transition-all"
                 style={{ height: `${Math.min(100, v)}%`, opacity: 0.2 + (i / 40) }} />
          ))}
        </div>
      </div>

    </div>
  );
}
