import React, { useState, useEffect, useRef } from 'react';
import * as Lucide from 'lucide-react';

/**
 * SENTINEL GOLD V8.9 - THE FINAL HYBRID RESTORATION
 * Reconstructed from V7.5 Baseline
 */

const CONFIG = {
  SYMBOL: 'paxgusdt',
  GARCH: { ALPHA: 0.12, BETA: 0.85, OMEGA: 0.03 },
  BOX_MULT: 0.5,
  UPDATE_INT: 1000
};

export default function App() {
  const [isRunning, setIsRunning] = useState(true);
  const [price, setPrice] = useState(0);
  const [prevPrice, setPrevPrice] = useState(0);
  const [loading, setLoading] = useState(true);
  
  const [metrics, setMetrics] = useState({
    ticks: { up: 0, down: 0 },
    stealth: { buy: 0, sell: 0 },
    volatility: 0,
    zScore: 0,
    riskPremium: 0.045
  });

  const [vectors, setVectors] = useState({
    bullOB: 0, bearOB: 0, macroBull: 0, macroBear: 0
  });

  const [rsi, setRsi] = useState(50);
  const [history, setHistory] = useState(new Array(45).fill(50));
  const [regime, setRegime] = useState("CALIBRATING...");

  const priceRef = useRef(0);
  const varianceRef = useRef(0.01);
  const rsiState = useRef({ avgGain: 0, avgLoss: 0 });

  const updateQuantEngine = (p: number, isBuyer: boolean) => {
    const diff = priceRef.current ? p - priceRef.current : 0;

    // 1. GARCH-M Volatility Modeling
    const epsilonSq = Math.pow(diff, 2);
    const nextVar = CONFIG.GARCH.OMEGA + CONFIG.GARCH.ALPHA * epsilonSq + CONFIG.GARCH.BETA * varianceRef.current;
    varianceRef.current = nextVar;
    const vol = Math.sqrt(nextVar);
    const z = diff / (vol || 0.001);
    const premium = 0.02 + (vol / (p * 0.001)) * 0.04;

    // 2. Cumulative Persistence
    setMetrics(prev => ({
      ...prev,
      ticks: { 
        up: diff > 0 ? prev.ticks.up + 1 : prev.ticks.up, 
        down: diff < 0 ? prev.ticks.down + 1 : prev.ticks.down 
      },
      stealth: {
        buy: (diff === 0 && isBuyer) ? prev.stealth.buy + 1 : prev.stealth.buy,
        sell: (diff === 0 && !isBuyer) ? prev.stealth.sell + 1 : prev.stealth.sell
      },
      volatility: vol,
      zScore: z,
      riskPremium: Math.min(0.06, Math.max(0.02, premium))
    }));

    // 3. SMC Vector Calculation
    setVectors({
      bullOB: p - (vol * CONFIG.BOX_MULT),
      bearOB: p + (vol * CONFIG.BOX_MULT),
      macroBull: p - (vol * 2.5),
      macroBear: p + (vol * 2.5)
    });

    // 4. Flux Wave (EMA-Smoothed RSI)
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;
    rsiState.current.avgGain = (rsiState.current.avgGain * 13 + gain) / 14;
    rsiState.current.avgLoss = (rsiState.current.avgLoss * 13 + loss) / 14;
    const rs = rsiState.current.avgGain / (rsiState.current.avgLoss || 1);
    const currentRsi = 100 - (100 / (1 + rs));

    // 5. Regime Logic
    if (vol > 0.08) setRegime("VOLATILITY SHOCK");
    else if (Math.abs(z) > 1.5) setRegime("LIQUIDITY EXPANSION");
    else setRegime("MEAN REVERSION");

    setPrevPrice(priceRef.current);
    setPrice(p);
    setRsi(currentRsi);
    priceRef.current = p;
  };

  useEffect(() => {
    let ws: WebSocket;
    if (isRunning) {
      ws = new WebSocket(`wss://stream.binance.com:9443/ws/${CONFIG.SYMBOL}@aggTrade`);
      ws.onmessage = (e) => {
        const d = JSON.parse(e.data);
        updateQuantEngine(parseFloat(d.p), !d.m);
      };
      setTimeout(() => setLoading(false), 1200);
      return () => ws?.close();
    }
  }, [isRunning]);

  useEffect(() => {
    const ticker = setInterval(() => {
      setHistory(prev => [...prev.slice(1), rsi]);
    }, 1000);
    return () => clearInterval(ticker);
  }, [rsi]);

  if (loading) return (
    <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center">
      <Lucide.Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-4" />
      <span className="text-[10px] font-black text-blue-500 tracking-[.5em] uppercase">Booting Hybrid Engine</span>
    </div>
  );

  const cardBase = "p-5 bg-slate-900/50 border border-slate-800/60 rounded-[2rem] backdrop-blur-xl mb-4";

  return (
    <div className="min-h-screen bg-[#020617] text-white p-4 font-sans select-none overflow-x-hidden">
      
      {/* SECTION 1: PRICE & AGGRESSIVE TICKS */}
      <div className={cardBase}>
        <div className="flex justify-between items-start mb-1">
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Execution</span>
          <div className="flex gap-4">
            <div className="flex items-center gap-1 text-blue-500">
              <Lucide.Triangle size={8} className="fill-current rotate-180" />
              <span className="text-[10px] font-black tabular-nums">{metrics.ticks.up}</span>
            </div>
            <div className="flex items-center gap-1 text-red-500">
              <Lucide.Triangle size={8} className="fill-current" />
              <span className="text-[10px] font-black tabular-nums">{metrics.ticks.down}</span>
            </div>
          </div>
        </div>
        <div className={`text-5xl font-black tabular-nums tracking-tighter ${price >= prevPrice ? 'text-blue-500' : 'text-red-500'}`}>
          {price ? price.toFixed(2) : "0.00"}
        </div>
      </div>

      {/* SECTION 2: SMC VECTORS */}
      <div className={cardBase}>
        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-3">SMC Vectors</span>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-black/40 p-2 rounded-xl border border-white/5">
            <span className="text-[7px] font-black text-blue-400 block uppercase">Bull OB</span>
            <span className="text-sm font-black tabular-nums">{vectors.bullOB.toFixed(2)}</span>
          </div>
          <div className="bg-black/40 p-2 rounded-xl border border-white/5">
            <span className="text-[7px] font-black text-red-400 block uppercase">Bear OB</span>
            <span className="text-sm font-black tabular-nums">{vectors.bearOB.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* SECTION 3: STEALTH FLOW */}
      <div className={cardBase}>
        <div className="flex justify-between items-center mb-2">
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Stealth Flow</span>
          <div className="text-[9px] font-black"><span className="text-blue-500">{metrics.stealth.buy}</span> / <span className="text-red-500">{metrics.stealth.sell}</span></div>
        </div>
        <div className="h-3 bg-red-900/30 rounded-full overflow-hidden border border-white/5 relative">
          <div className="h-full bg-blue-600 transition-all duration-700" 
               style={{ width: `${(metrics.stealth.buy / (metrics.stealth.buy + metrics.stealth.sell || 1)) * 100}%` }}></div>
        </div>
      </div>

      {/* SECTION 4: SIGMA BIDIRECTIONAL */}
      <div className={cardBase}>
        <div className="flex justify-between items-center mb-3">
           <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Sigma & Premium</span>
           <span className="text-[10px] font-black text-blue-400">{metrics.riskPremium.toFixed(4)}</span>
        </div>
        <div className="relative h-2.5 bg-black/60 rounded-full overflow-hidden border border-white/5">
          <div className="absolute left-1/2 w-0.5 h-full bg-white/40 z-10"></div>
          <div className={`absolute h-full transition-all duration-500 ${metrics.zScore > 0 ? 'bg-blue-500' : 'bg-red-500'}`}
               style={{ 
                 width: `${Math.min(50, Math.abs(metrics.zScore) * 15)}%`, 
                 left: metrics.zScore > 0 ? '50%' : 'auto', 
                 right: metrics.zScore < 0 ? '50%' : 'auto' 
               }} />
        </div>
      </div>

      {/* SECTION 5: FLUX WAVE VISUALS */}
      <div className={cardBase}>
        <div className="flex justify-between items-center mb-2">
          <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest">Flux Wave</span>
          <span className="text-lg font-black italic tabular-nums">{rsi.toFixed(0)}</span>
        </div>
        <div className="h-12 flex items-end gap-[1.5px] bg-black/40 rounded-xl px-2 py-1 border border-white/5 overflow-hidden">
          {history.map((v, i) => (
            <div key={i} className={`flex-1 rounded-t-sm transition-all duration-500 ${v > 70 ? 'bg-blue-500' : v < 30 ? 'bg-red-500' : 'bg-slate-700'}`} 
                 style={{ height: `${Math.max(10, v)}%`, opacity: 0.3 + (i / 45) }} />
          ))}
        </div>
      </div>

      {/* FOOTER REGIME */}
      <div className="p-4 bg-blue-600/10 border border-blue-500/20 rounded-[1.5rem] text-center backdrop-blur-md">
        <div className="text-[8px] font-black text-blue-500/50 uppercase tracking-[0.3em] mb-1">Market Regime</div>
        <div className="text-[11px] font-black tracking-widest text-white uppercase">{regime}</div>
      </div>

    </div>
  );
}
