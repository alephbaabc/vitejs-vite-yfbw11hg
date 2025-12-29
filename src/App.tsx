import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Waves, X, Database, ArrowUp, ArrowDown, Sun, Moon, 
  Mail, History, ChevronRight, CheckCircle2, GripVertical, Activity, Zap, Bell 
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from 'recharts';

const SYMBOL = "PAXGUSDT";
const ALPHA = 0.12;
const BETA = 0.85;  
const OMEGA = 0.03;
const BOX = 0.5;

const App = () => {
  const [layoutOrder, setLayoutOrder] = useState(['PRICE', 'VECTORS', 'RESERVOIR', 'FLUX', 'STATUS', 'PRICE_RSI_OVERLAY']);
  const [draggedItemIdx, setDraggedItemIdx] = useState(null);
  const [isRunning, setIsRunning] = useState(true);
  const [isDark, setIsDark] = useState(true);
  const [price, setPrice] = useState(null);
  const [prevPrice, setPrevPrice] = useState(null);
  const [gainCount, setGainCount] = useState(0);
  const [lossCount, setLossCount] = useState(0);
  const [stealthBuffer, setStealthBuffer] = useState([]);
  const [aggHistory, setAggHistory] = useState(new Array(45).fill(50));
  const [regime, setRegime] = useState("CALIBRATING");
  const [riskPremium, setRiskPremium] = useState(0);
  const [zScore, setZScore] = useState(0);
  const [pfTarget, setPfTarget] = useState({ bull: 0, bear: 0, macroBull: 0, macroBear: 0 });
  const [mailBox, setMailBox] = useState([]);
  const [isMailOpen, setIsMailOpen] = useState(false);
  const [selectedMsg, setSelectedMsg] = useState(null);
  const [floatNotify, setFloatNotify] = useState(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [avgGain, setAvgGain] = useState(0);
  const [avgLoss, setAvgLoss] = useState(0);
  const [timeLeft, setTimeLeft] = useState({ min: 0, sec: 0 });

  // New: price history for overlay chart (last 100 points)
  const [priceHistory, setPriceHistory] = useState([]);

  const priceRef = useRef(0);
  const lastRet = useRef(0);
  const lastVar = useRef(0.05);

  const onDragStart = (e, index) => {
    setDraggedItemIdx(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/html", e.target.parentNode);
  };

  const onDragOver = (e, index) => {
    e.preventDefault();
    if (draggedItemIdx === null || draggedItemIdx === index) return;
    
    const newOrder = [...layoutOrder];
    const item = newOrder[draggedItemIdx];
    newOrder.splice(draggedItemIdx, 1);
    newOrder.splice(index, 0, item);
    
    setDraggedItemIdx(index);
    setLayoutOrder(newOrder);
  };

  const onDragEnd = () => {
    setDraggedItemIdx(null);
  };

  const processMarket = (ret) => {
    const v = OMEGA + (ALPHA * Math.pow(lastRet.current, 2)) + (BETA * lastVar.current);
    lastRet.current = ret;
    lastVar.current = v;
    
    setRiskPremium(Math.sqrt(v) * 0.15);
    setZScore(ret / (Math.sqrt(v) || 0.001));
    
    if (v > 0.38) setRegime("VOLATILITY SHOCK");
    else if (v > 0.16) setRegime("LIQUIDITY EXPANSION");
    else if (v < 0.07) setRegime("INSTITUTIONAL COMPRESSION");
    else setRegime("STABLE ACCUMULATION");

    const m = Math.max(1.2, Math.sqrt(v) * 16);
    setPfTarget({ 
      bull: priceRef.current + (m * BOX * 2.5), 
      bear: priceRef.current - (m * BOX * 2.5), 
      macroBull: priceRef.current + (m * BOX * 7), 
      macroBear: priceRef.current - (m * BOX * 7) 
    });
  };

  useEffect(() => {
    let ws;
    if (isRunning) {
      ws = new WebSocket(`wss://stream.binance.com:9443/ws/${SYMBOL.toLowerCase()}@aggTrade`);
      ws.onmessage = (e) => {
        const d = JSON.parse(e.data);
        const p = parseFloat(d.p);
        if (priceRef.current !== 0) {
          const r = (p - priceRef.current) / priceRef.current;
          processMarket(r * 1000);
          const diff = Math.abs(p - priceRef.current);
          if (p > priceRef.current) {
            setGainCount(g => g+1);
            setAvgGain(v => (v*0.9)+(diff*0.1));
            setAvgLoss(v => v*0.9);
          } else {
            setLossCount(l => l+1);
            setAvgLoss(v => (v*0.9)+(diff*0.1));
            setAvgGain(v => v*0.9);
          }
          setStealthBuffer(prev => [...prev, { time: Date.now(), side: !d.m ? 'buy' : 'sell' }].slice(-100));
        }
        setPrevPrice(priceRef.current);
        setPrice(p);
        priceRef.current = p;

        // Update price history for overlay chart
        setPriceHistory(prev => {
          const newEntry = { price: p, rsi: rsi };
          const updated = [...prev, newEntry].slice(-100);
          return updated;
        });
      };
    }
    return () => ws?.close();
  }, [isRunning, rsi]);

  useEffect(() => {
    const timer = setInterval(() => {
      const s = (60000 - (Date.now() % 60000)) / 1000;
      setTimeLeft({ min: Math.floor(s/60), sec: Math.floor(s%60) });
      const now = new Date();
      if (isRunning && now.getSeconds() === 45) {
        // Mock AI intel (replace with real Gemini later)
        const txt = "Strong bullish order block alignment. Institutional accumulation likely.";
        const m = { id: Date.now(), text: txt, snippet: txt.substring(0, 40) + "...", time: new Date().toLocaleTimeString() };
        setMailBox(prev => [m, ...prev].slice(0, 10));
        setFloatNotify(m);
        setTimeout(() => setFloatNotify(null), 7000);
      }
      if (now.getSeconds() === 0) setAggHistory(p => [...p.slice(1), rsi]);
    }, 1000);
    return () => clearInterval(timer);
  }, [isRunning, rsi]);

  const rsi = useMemo(() => {
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return parseFloat((100 - (100 / (1 + rs))).toFixed(1));
  }, [avgGain, avgLoss]);

  // New: Scale RSI to price range for overlay
  const chartData = useMemo(() => {
    if (priceHistory.length < 2) return [];
    const prices = priceHistory.map(h => h.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const range = maxPrice - minPrice || 1;

    return priceHistory.map(h => ({
      price: h.price,
      rsiScaled: minPrice + (h.rsi / 100) * range
    }));
  }, [priceHistory]);

  const renderModule = (id) => {
    const cardBase = `p-5 pl-10 border rounded-[2rem] transition-all duration-300 ${isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-200'}`;
    switch(id) {
      case 'PRICE': return (
        <div className={cardBase}>
          <span className="text-[10px] font-black uppercase text-slate-500 block mb-1">Live Institutional</span>
          <div className="flex justify-between items-end">
            <div className={`text-5xl font-black tabular-nums tracking-tighter ${price >= prevPrice ? 'text-blue-500' : 'text-red-500'}`}>
              {price ? price.toFixed(2) : "0.00"}
            </div>
            <div className="flex flex-col font-black opacity-80 pb-1">
              <span className="text-blue-400 text-lg">+{gainCount}</span>
              <span className="text-red-400 text-lg">-{lossCount}</span>
            </div>
          </div>
        </div>
      );
      case 'VECTORS': return (
        <div className={cardBase}>
          <div className="flex items-center gap-2 mb-4 text-[10px] font-black uppercase text-slate-500">
            <Database size={14}/><span>SMC Targets</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="border-l-2 border-blue-500 pl-3">
              <span className="text-[8px] font-black uppercase opacity-40 block">Bull OB</span>
              <span className="text-lg font-black">${pfTarget.bull.toFixed(2)}</span>
            </div>
            <div className="border-l-2 border-red-500 pl-3">
              <span className="text-[8px] font-black uppercase opacity-40 block">Bear OB</span>
              <span className="text-lg font-black">${pfTarget.bear.toFixed(2)}</span>
            </div>
          </div>
        </div>
      );
      case 'RESERVOIR': 
        const buys = stealthBuffer.filter(t => t.side === 'buy').length;
        const sells = stealthBuffer.filter(t => t.side === 'sell').length;
        const total = buys + sells || 1;
        return (
          <div className={cardBase}>
            <div className="flex justify-between text-[10px] font-black uppercase text-slate-500 mb-3">
              <span>Stealth Reservoir</span><span>{Math.round((buys/total)*100)}% Buy</span>
            </div>
            <div className="h-4 bg-slate-950 rounded-full flex overflow-hidden">
              <div className="h-full bg-blue-600 transition-all duration-700" style={{ width: `${(buys/total)*100}%` }} />
              <div className="h-full bg-red-600 transition-all duration-700" style={{ width: `${(sells/total)*100}%` }} />
            </div>
            <div className="flex justify-between mt-1 text-[8px] font-black uppercase opacity-30">
              <span>B: {buys}</span><span>S: {sells}</span>
            </div>
          </div>
        );
      case 'FLUX': return (
        <div className={`${cardBase} rounded-[2.5rem]`}>
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2 text-blue-500">
              <Waves size={16}/><span className="text-2xl font-black">{rsi}</span>
            </div>
            <span className="text-[9px] font-black text-slate-500 uppercase">
              Spread: {Math.abs(price - prevPrice || 0).toFixed(4)}
            </span>
          </div>
          <div className="h-10 w-full flex items-end gap-[2px] bg-black/40 rounded-xl overflow-hidden px-1">
            {aggHistory.map((v, i) => (
              <div key={i} className={`flex-1 \( {v > 70 ? 'bg-blue-500' : v < 30 ? 'bg-red-500' : 'bg-slate-700'}`} style={{ height: ` \){v}%` }} />
            ))}
          </div>
        </div>
      );
      case 'STATUS': return (
        <div className={`${cardBase} flex justify-between text-center`}>
          <div><span className="text-[8px] font-black text-slate-500 block">REGIME</span><span className="text-[10px] font-black text-blue-400 uppercase">{regime}</span></div>
          <div><span className="text-[8px] font-black text-slate-500 block">Z-SCORE</span><span className="text-[10px] font-black">{zScore.toFixed(2)}</span></div>
          <div><span className="text-[8px] font-black text-slate-500 block">PREMIUM</span><span className="text-[10px] font-black">+{riskPremium.toFixed(4)}</span></div>
        </div>
      );
      case 'PRICE_RSI_OVERLAY': return (
        <div className={cardBase + " rounded-[2.5rem]"}>
          <div className="text-[10px] font-black uppercase text-slate-500 mb-3">Price + RSI Overlay (Divergence View)</div>
          <div className="h-48 -mx-5 -mb-5">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                <XAxis dataKey="price" hide />
                <YAxis hide />
                <Line type="monotone" dataKey="price" stroke={price >= prevPrice ? "#60a5fa" : "#f87171"} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="rsiScaled" stroke="#3b82f6" strokeWidth={1.5} dot={false} opacity={0.7} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="text-[8px] text-slate-500 text-center mt-2">Blue = Price | Thin Blue = RSI (scaled)</div>
        </div>
      );
      default: return null;
    }
  };

  if (!price && isRunning) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#020617]">
        <div className="text-center">
          <Activity className="animate-pulse mx-auto mb-6 text-blue-500" size={64} />
          <p className="text-slate-400 text-lg font-black">Connecting to Binance...</p>
          <p className="text-slate-600 text-sm mt-2">Loading Sentinel V6.6</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-screen w-screen flex flex-col overflow-hidden ${isDark ? 'bg-[#020617] text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      {/* HEADER */}
      <div className={`p-4 px-6 border-b flex justify-between items-center ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-blue-500" />
          <span className="text-[10px] font-black uppercase tracking-[0.3em]">Sentinel V6.6</span>
          <span className="ml-2 text-[8px] font-black bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded-full border border-blue-500/20">SESSION ACTIVE</span>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => setIsDark(!isDark)}>{isDark ? <Sun size={16}/> : <Moon size={16}/>}</button>
          <span className="text-[10px] font-black tabular-nums bg-slate-800/50 px-3 py-1 rounded-full">
            {timeLeft.min}:{timeLeft.sec.toString().padStart(2,'0')}
          </span>
        </div>
      </div>

      {/* DND FEED */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-60 max-w-lg mx-auto w-full">
        {layoutOrder.map((id, index) => (
          <div
            key={id}
            draggable
            onDragStart={(e) => onDragStart(e, index)}
            onDragOver={(e) => onDragOver(e, index)}
            onDragEnd={onDragEnd}
            className={`relative transition-all duration-200 ${draggedItemIdx === index ? 'opacity-20 scale-95' : 'opacity-100'}`}
          >
            <div className="absolute left-0 top-0 bottom-0 w-10 flex items-center justify-center opacity-10 cursor-grab active:cursor-grabbing hover:opacity-100 transition-opacity">
              <GripVertical size={18}/>
            </div>
            {renderModule(id)}
          </div>
        ))}
      </div>

      {/* BOTTOM FLOAT NOTIFY */}
      {floatNotify && (
        <div className="fixed bottom-32 left-4 right-4 z-[500] animate-in slide-in-from-bottom duration-500">
          <div onClick={() => { setSelectedMsg(floatNotify); setFloatNotify(null); }} 
               className="bg-blue-600 p-4 rounded-2xl shadow-2xl flex items-center gap-3 border border-blue-400 text-white cursor-pointer">
            <Bell size={18} className="animate-pulse" />
            <div className="flex-1 truncate">
              <span className="text-[8px] font-black uppercase opacity-60 block">Institutional Intel</span>
              <p className="text-xs font-black truncate">{floatNotify.snippet}</p>
            </div>
            <ChevronRight size={16} />
          </div>
        </div>
      )}

      {/* FOOTER */}
      <div className={`fixed bottom-0 left-0 w-full p-8 backdrop-blur-xl border-t flex justify-center items-center gap-10 z-[400] ${isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-white/80 border-slate-200'}`}>
        <button onClick={() => setIsRunning(!isRunning)} className={`w-16 h-16 rounded-full flex items-center justify-center border-2 transition-all ${isRunning ? 'bg-blue-600 border-blue-400 shadow-[0_0_30px_rgba(37,99,235,0.4)]' : 'bg-slate-900 border-slate-800'}`}>
          <Zap size={24} className={isRunning ? "text-white fill-white" : "text-slate-600"} />
        </button>
        <button onClick={() => setIsMailOpen(true)} className="w-12 h-12 rounded-2xl border border-slate-800 bg-slate-900/40 flex items-center justify-center relative">
          <Mail size={20} className={mailBox.length > 0 ? "text-blue-500" : "text-slate-500"} />
          {isAiLoading && <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full animate-ping" />}
        </button>
        <div className="w-12 h-12 rounded-2xl border border-slate-800 bg-slate-900/40 flex items-center justify-center opacity-30"><CheckCircle2 size={20} /></div>
      </div>

      {/* MODAL */}
      {(selectedMsg || isMailOpen) && (
        <div className="fixed inset-0 z-[1000] bg-black/95 flex items-center justify-center p-6">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-[3rem] flex flex-col max-h-[80vh]">
            <div className="p-8 border-b border-slate-800 flex justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-blue-500">Archive</span>
              <button onClick={() => {setIsMailOpen(false); setSelectedMsg(null);}}><X/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 space-y-4">
              {isMailOpen ? mailBox.map(m => (
                <div key={m.id} onClick={() => {setSelectedMsg(m); setIsMailOpen(false);}} 
                     className="p-4 bg-slate-800/40 rounded-2xl border border-slate-800 cursor-pointer">
                  <span className="text-[8px] font-black text-blue-400 mb-1 block">{m.time}</span>
                  <p className="text-xs font-black">{m.snippet}</p>
                </div>
              )) : <div className="text-sm font-black text-slate-200 leading-relaxed whitespace-pre-line">{selectedMsg.text}</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;