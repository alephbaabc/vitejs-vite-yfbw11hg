import React, { useState, useEffect, useRef } from 'react';

/**
 * SENTINEL GOLD V9.6 - ZERO-DEPENDENCY BUILD
 * -----------------------------------------------
 * Logic: GARCH-M Volatility + SMC Vector Targets
 * Fix: Native SVGs to resolve "Whiteboard" / Blank Screen issues.
 */

// FLAT CONFIG FOR RENDER STABILITY
const SYMBOL = 'paxgusdt';
const G_ALPHA = 0.12;
const G_BETA = 0.85;
const G_OMEGA = 0.03;
const BOX_MULT = 0.5;

// NATIVE SVG COMPONENTS (Replacing Lucide)
const IconUp = () => <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" className="rotate-180"><path d="M12 5l9 14H3l9-14z" /></svg>;
const IconDown = () => <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 5l9 14H3l9-14z" /></svg>;
const IconZap = ({ active }: { active: boolean }) => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

export default function App() {
  const [isRunning, setIsRunning] = useState(true);
  const [price, setPrice] = useState(0);
  const [prevPrice, setPrevPrice] = useState(0);
  const [loading, setLoading] = useState(true);
  
  const [metrics, setMetrics] = useState({
    ticks: { up: 0, down: 0 },
    stealth: { buy: 0, sell: 0 },
    zScore: 0,
    riskPremium: 0.045
  });

  const [vectors, setVectors] = useState({ bullOB: 0, bearOB: 0 });
  const [rsi, setRsi] = useState(50);
  const [history, setHistory] = useState(new Array(45).fill(50));

  const priceRef = useRef(0);
  const varianceRef = useRef(0.01);
  const rsiState = useRef({ avgGain: 0, avgLoss: 0 });

  useEffect(() => {
    let ws: WebSocket;
    if (isRunning) {
      ws = new WebSocket(`wss://stream.binance.com:9443/ws/${SYMBOL}@aggTrade`);
      ws.onmessage = (e) => {
        const d = JSON.parse(e.data);
        const p = parseFloat(d.p);
        const isBuyer = !d.m;
        const diff = priceRef.current ? p - priceRef.current : 0;

        // GARCH-M & SIGMA
        const epsilonSq = Math.pow(diff, 2);
        const nextVar = G_OMEGA + G_ALPHA * epsilonSq + G_BETA * varianceRef.current;
        varianceRef.current = nextVar;
        const vol = Math.sqrt(nextVar);
        const z = diff / (vol || 0.001);
        const premium = 0.02 + (vol / (p * 0.001)) * 0.04;

        setMetrics(prev => ({
          ...prev,
          ticks: { up: diff > 0 ? prev.ticks.up + 1 : prev.ticks.up, down: diff < 0 ? prev.ticks.down + 1 : prev.ticks.down },
          stealth: { buy: isBuyer ? prev.stealth.buy + 1 : prev.stealth.buy, sell: !isBuyer ? prev.stealth.sell + 1 : prev.stealth.sell },
          zScore: z,
          riskPremium: Math.min(0.06, Math.max(0.02, premium))
        }));

        setVectors({ bullOB: p - (vol * BOX_MULT), bearOB: p + (vol * BOX_MULT) });

        const gain = diff > 0 ? diff : 0;
        const loss = diff < 0 ? Math.abs(diff) : 0;
        rsiState.current.avgGain = (rsiState.current.avgGain * 13 + gain) / 14;
        rsiState.current.avgLoss = (rsiState.current.avgLoss * 13 + loss) / 14;
        const rs = rsiState.current.avgGain / (rsiState.current.avgLoss || 1);
        setRsi(100 - (100 / (1 + rs)));

        setPrevPrice(priceRef.current);
        setPrice(p);
        priceRef.current = p;
      };
      
      setTimeout(() => setLoading(false), 1200);
      return () => ws.close();
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
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
      <span className="text-[10px] font-black text-blue-500 tracking-widest uppercase italic">Sentinel Calibrating</span>
    </div>
  );

  const cardBase = "p-6 bg-slate-900/50 border border-slate-800/60 rounded-[2rem] backdrop-blur-xl mb-4 shadow-2xl";

  return (
    <div className="min-h-screen bg-[#020617] text-white p-4 font-sans select-none overflow-x-hidden">
      
      {/* 1. EXECUTION */}
      <div className={cardBase}>
        <div className="flex justify-between items-start mb-2">
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Execution Ticks</span>
          <div className="flex gap-4">
            <div className="flex items-center gap-1 text-blue-500">
              <IconUp /><span className="text-[12px] font-black tabular-nums">{metrics.ticks.up}</span>
            </div>
            <div className="flex items-center gap-1 text-red-500">
              <IconDown /><span className="text-[12px] font-black tabular-nums">{metrics.ticks.down}</span>
            </div>
          </div>
        </div>
        <div className={`text-5xl font-black tracking-tighter tabular-nums ${price >= prevPrice ? 'text-blue-500' : 'text-red-500'}`}>
          ${price ? price.toFixed(2) : "0.00"}
        </div>
      </div>

      {/* 2. SMC VECTORS */}
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

      {/* 3. STEALTH FLOW */}
      <div className={cardBase}>
        <div className="flex justify-between items-center mb-2">
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Stealth Flow</span>
          <div className="text-[10px] font-black"><span className="text-blue-500">{metrics.stealth.buy}</span> / <span className="text-red-500">{metrics.stealth.sell}</span></div>
        </div>
        <div className="h-3 bg-red-900/30 rounded-full overflow-hidden border border-white/5 relative">
          <div className="h-full bg-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.4)] transition-all duration-700" 
               style={{ width: `${(metrics.stealth.buy/(metrics.stealth.buy+metrics.stealth.sell||1))*100}%` }}></div>
        </div>
      </div>

      {/* 4. SIGMA BAR */}
      <div className={cardBase}>
        <div className="flex justify-between items-center mb-3">
           <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Sigma Variance</span>
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

      {/* 5. FLUX MOMENTUM */}
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

      <footer className="fixed bottom-10 left-0 right-0 flex justify-center z-50">
        <button onClick={() => setIsRunning(!isRunning)} 
                className={`p-6 rounded-full border-2 transition-all duration-500 active:scale-90 ${isRunning ? 'bg-blue-600/10 border-blue-500 shadow-[0_0_40px_rgba(59,130,246,0.3)]' : 'bg-red-900/10 border-red-500'}`}>
          <IconZap active={isRunning} />
        </button>
      </footer>

    </div>
  );
}
