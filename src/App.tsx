import React, { useState, useEffect, useRef } from 'react';
import * as Lucide from 'lucide-react';

[span_3](start_span)// STABLE QUANT CONFIG[span_3](end_span)
const CONFIG = {
  SYMBOL: 'paxgusdt',
  GARCH: { ALPHA: 0.12, BETA: 0.85, OMEGA: 0.03 },
  BOX_MULT: 0.5
};

export default function App() {
  const [price, setPrice] = useState(0);
  const [prevPrice, setPrevPrice] = useState(0);
  const [loading, setLoading] = useState(true);
  
  [span_4](start_span)[span_5](start_span)// PERSISTENT QUANT ENGINE[span_4](end_span)[span_5](end_span)
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
    const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${CONFIG.SYMBOL}@aggTrade`);
    ws.onmessage = (e) => {
      const d = JSON.parse(e.data);
      const p = parseFloat(d.p);
      const isBuyer = !d.m;
      const diff = priceRef.current ? p - priceRef.current : 0;

      [span_6](start_span)// 1. GARCH-M & SIGMA[span_6](end_span)
      const epsilonSq = Math.pow(diff, 2);
      const nextVar = CONFIG.GARCH.OMEGA + CONFIG.GARCH.ALPHA * epsilonSq + CONFIG.GARCH.BETA * varianceRef.current;
      varianceRef.current = nextVar;
      const vol = Math.sqrt(nextVar);
      const z = diff / (vol || 0.001);
      const premium = 0.02 + (vol / (p * 0.001)) * 0.04;

      [span_7](start_span)// 2. TICK vs STEALTH PERSISTENCE[span_7](end_span)
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
        zScore: z,
        riskPremium: Math.min(0.06, Math.max(0.02, premium))
      }));

      [span_8](start_span)// 3. SMC VECTORS[span_8](end_span)
      setVectors({
        bullOB: p - (vol * CONFIG.BOX_MULT),
        bearOB: p + (vol * CONFIG.BOX_MULT)
      });

      [span_9](start_span)// 4. RSI FLUX WAVE[span_9](end_span)
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

    setTimeout(() => setLoading(false), 1000);
    return () => ws.close();
  }, []);

  useEffect(() => {
    const ticker = setInterval(() => {
      setHistory(prev => [...prev.slice(1), rsi]);
    }, 1000);
    return () => clearInterval(ticker);
  }, [rsi]);

  if (loading) return (
    <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center">
      <Lucide.Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-4" />
      <span className="text-[10px] font-black text-blue-500 tracking-widest uppercase tracking-[.5em]">Booting Hybrid Engine</span>
    </div>
  );

  const cardBase = "p-6 bg-slate-900/50 border border-slate-800/60 rounded-[2rem] backdrop-blur-xl mb-4";

  return (
    <div className="min-h-screen bg-[#020617] text-white p-4 font-sans select-none overflow-x-hidden">
      
      [span_10](start_span){/* SECTION 1: PRICE & AGGRESSIVE TICKS[span_10](end_span) */}
      <div className={cardBase}>
        <div className="flex justify-between items-start mb-2">
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Execution</span>
          <div className="flex gap-4">
            <div className="flex items-center gap-1 text-blue-500">
              <Lucide.Triangle size={10} className="fill-current rotate-180" /><span className="text-[12px] font-black">{metrics.ticks.up}</span>
            </div>
            <div className="flex items-center gap-1 text-red-500">
              <Lucide.Triangle size={10} className="fill-current" /><span className="text-[12px] font-black">{metrics.ticks.down}</span>
            </div>
          </div>
        </div>
        <div className={`text-5xl font-black tracking-tighter tabular-nums ${price >= prevPrice ? 'text-blue-500' : 'text-red-500'}`}>
          ${price ? price.toFixed(2) : "0.00"}
        </div>
      </div>

      [span_11](start_span){/* SECTION 2: SMC VECTORS[span_11](end_span) */}
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

      [span_12](start_span){/* SECTION 3: STEALTH FLOW[span_12](end_span) */}
      <div className={cardBase}>
        <div className="flex justify-between items-center mb-2">
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Stealth Flow</span>
          <div className="text-[10px] font-black"><span className="text-blue-500">{metrics.stealth.buy}</span> / <span className="text-red-500">{metrics.stealth.sell}</span></div>
        </div>
        <div className="h-3 bg-red-900/30 rounded-full overflow-hidden border border-white/5 relative">
          <div className="h-full bg-blue-600 transition-all duration-700 shadow-[0_0_15px_rgba(37,99,235,0.4)]" 
               style={{ width: `${(metrics.stealth.buy/(metrics.stealth.buy+metrics.stealth.sell||1))*100}%` }}></div>
        </div>
      </div>

      [span_13](start_span){/* SECTION 4: SIGMA BIDIRECTIONAL[span_13](end_span) */}
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

      [span_14](start_span){/* SECTION 5: FLUX WAVE VISUALS[span_14](end_span) */}
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

    </div>
  );
}
