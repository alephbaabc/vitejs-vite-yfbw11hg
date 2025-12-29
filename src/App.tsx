import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';

// FLUX Module with corrected JSX syntax
const FLUX = () => {
  const [value, setValue] = useState(0);

  return (
    <div className="flux-container">
      <h3>FLUX Status</h3>
      <p>Value: {value}</p>
      <button onClick={() => setValue(value + 1)}>Increment</button>
    </div>
  );
};

interface CandleData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface RSIData {
  value: number;
  timestamp: number;
}

// RSI Calculation moved before useEffect
const calculateRSI = (data: number[], period: number = 14): number => {
  if (data.length < period + 1) return 0;

  let gains = 0;
  let losses = 0;

  for (let i = data.length - period; i < data.length; i++) {
    const change = data[i] - data[i - 1];
    if (change > 0) {
      gains += change;
    } else {
      losses += Math.abs(change);
    }
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;

  if (avgLoss === 0) return 100;

  const rs = avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));

  return rsi;
};

function App() {
  const [candles, setCandles] = useState<CandleData[]>([]);
  const [rsiValues, setRsiValues] = useState<RSIData[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // WebSocket connection handler with validation
  const connectWebSocket = useCallback(() => {
    try {
      const ws = new WebSocket('wss://stream.example.com/data');

      ws.onopen = () => {
        setIsConnected(true);
        setError(null);
      };

      ws.onmessage = (event) => {
        try {
          // Validate WebSocket data
          const data = JSON.parse(event.data);

          if (!data || typeof data !== 'object') {
            throw new Error('Invalid data format');
          }

          if (data.type === 'candle') {
            if (
              !data.payload ||
              typeof data.payload.close !== 'number' ||
              typeof data.payload.timestamp !== 'number'
            ) {
              throw new Error('Invalid candle data structure');
            }

            const newCandle: CandleData = {
              timestamp: data.payload.timestamp,
              open: data.payload.open || 0,
              high: data.payload.high || data.payload.close,
              low: data.payload.low || data.payload.close,
              close: data.payload.close,
              volume: data.payload.volume || 0,
            };

            setCandles((prev) => [...prev.slice(-99), newCandle]);
          }
        } catch (err) {
          setError(`WebSocket data error: ${err instanceof Error ? err.message : 'Unknown error'}`);
          console.error('WebSocket message error:', err);
        }
      };

      ws.onerror = () => {
        setError('WebSocket connection error');
        setIsConnected(false);
      };

      ws.onclose = () => {
        setIsConnected(false);
      };

      wsRef.current = ws;
    } catch (err) {
      setError(`Connection failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, []);

  // Main effect for WebSocket connection
  useEffect(() => {
    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connectWebSocket]);

  // Calculate RSI values when candles update
  useEffect(() => {
    if (candles.length > 0) {
      const closePrices = candles.map((c) => c.close);
      const rsi = calculateRSI(closePrices);

      setRsiValues((prev) => [
        ...prev.slice(-99),
        {
          value: rsi,
          timestamp: candles[candles.length - 1].timestamp,
        },
      ]);
    }
  }, [candles]);

  return (
    <div className="App">
      <header className="App-header">
        <h1>Trading Dashboard</h1>
        
        {/* Connection Status */}
        <div className={`status ${isConnected ? 'connected' : 'disconnected'}`}>
          <span>{isConnected ? '🟢 Connected' : '🔴 Disconnected'}</span>
        </div>

        {/* Error Display */}
        {error && (
          <div className="error-banner">
            <p>{error}</p>
            <button onClick={() => setError(null)}>Dismiss</button>
          </div>
        )}

        {/* FLUX Module */}
        <FLUX />

        {/* Statistics */}
        <div className="stats">
          <div className="stat-card">
            <h3>Total Candles</h3>
            <p>{candles.length}</p>
          </div>
          <div className="stat-card">
            <h3>Latest Price</h3>
            <p>${candles.length > 0 ? candles[candles.length - 1].close.toFixed(2) : 'N/A'}</p>
          </div>
          <div className="stat-card">
            <h3>Current RSI</h3>
            <p>{rsiValues.length > 0 ? rsiValues[rsiValues.length - 1].value.toFixed(2) : 'N/A'}</p>
          </div>
        </div>

        {/* Recent Candles */}
        <div className="candles-list">
          <h3>Recent Candles</h3>
          <ul>
            {candles.slice(-5).map((candle, idx) => (
              <li key={idx}>
                <span>Close: ${candle.close.toFixed(2)}</span>
                <span>High: ${candle.high.toFixed(2)}</span>
                <span>Low: ${candle.low.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        </div>
      </header>
    </div>
  );
}

export default App;
