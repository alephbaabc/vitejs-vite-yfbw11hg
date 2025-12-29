import React, { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';

// Type definitions
interface WebSocketMessage {
  type: string;
  data?: unknown;
  payload?: unknown;
  [key: string]: unknown;
}

interface RSIData {
  value: number;
  timestamp: number;
}

interface FLUXModuleConfig {
  enabled: boolean;
  threshold?: number;
}

// FLUX Module with proper JSX syntax
const FLUXModule: React.FC<{ config: FLUXModuleConfig }> = ({ config }) => {
  const [fluxValue, setFluxValue] = useState<number>(0);

  useEffect(() => {
    if (config.enabled) {
      // Initialize FLUX calculations
      const interval = setInterval(() => {
        setFluxValue((prev) => Math.random() * 100);
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [config.enabled]);

  if (!config.enabled) {
    return null;
  }

  return (
    <div className="flux-module">
      <h3>FLUX Module</h3>
      <p>Current Value: {fluxValue.toFixed(2)}</p>
      {config.threshold && fluxValue > config.threshold && (
        <span className="threshold-alert">Threshold exceeded!</span>
      )}
    </div>
  );
};

// RSI Calculator - separated to avoid circular dependency
const calculateRSI = (prices: number[], period: number = 14): number => {
  if (prices.length < period + 1) return 0;

  let gains = 0;
  let losses = 0;

  for (let i = prices.length - period; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) {
      gains += change;
    } else {
      losses += Math.abs(change);
    }
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;

  if (avgLoss === 0) return avgGain > 0 ? 100 : 0;

  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
};

// RSI Hook - avoids circular dependency by using pure function
const useRSI = (prices: number[], period: number = 14) => {
  const [rsiValue, setRsiValue] = useState<RSIData>({
    value: 0,
    timestamp: Date.now(),
  });

  useEffect(() => {
    if (prices.length > 0) {
      const newValue = calculateRSI(prices, period);
      setRsiValue({
        value: newValue,
        timestamp: Date.now(),
      });
    }
  }, [prices, period]);

  return rsiValue;
};

// WebSocket Message Validator
const validateWebSocketMessage = (message: unknown): message is WebSocketMessage => {
  if (typeof message !== 'object' || message === null) {
    return false;
  }

  const msg = message as Record<string, unknown>;

  // Validate required fields
  if (typeof msg.type !== 'string') {
    console.error('Invalid message: missing or invalid type field');
    return false;
  }

  // Validate optional data fields
  if (msg.data !== undefined && msg.data !== null && typeof msg.data !== 'object') {
    console.error('Invalid message: data field must be an object or null');
    return false;
  }

  // Validate optional payload fields
  if (msg.payload !== undefined && msg.payload !== null && typeof msg.payload !== 'object') {
    console.error('Invalid message: payload field must be an object or null');
    return false;
  }

  return true;
};

// Main App Component
function App() {
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [prices, setPrices] = useState<number[]>([]);
  const [fluxConfig, setFluxConfig] = useState<FLUXModuleConfig>({
    enabled: true,
    threshold: 75,
  });
  const wsRef = useRef<WebSocket | null>(null);
  const rsiData = useRSI(prices, 14);

  // Initialize WebSocket connection with proper message validation
  useEffect(() => {
    const connectWebSocket = () => {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        wsRef.current = new WebSocket(`${protocol}//${window.location.host}`);

        wsRef.current.onopen = () => {
          setWsConnected(true);
          console.log('WebSocket connected');
        };

        wsRef.current.onmessage = (event) => {
          try {
            // Parse message safely
            const rawData = JSON.parse(event.data);

            // Validate message structure
            if (!validateWebSocketMessage(rawData)) {
              console.warn('Received invalid WebSocket message:', rawData);
              return;
            }

            // Process valid messages
            if (rawData.type === 'price_update' && rawData.data) {
              const priceData = rawData.data as Record<string, unknown>;
              if (typeof priceData.price === 'number') {
                setPrices((prev) => [...prev.slice(-99), priceData.price]);
              }
            } else if (rawData.type === 'flux_config' && rawData.payload) {
              const configPayload = rawData.payload as Record<string, unknown>;
              setFluxConfig((prev) => ({
                ...prev,
                ...(typeof configPayload.threshold === 'number' && {
                  threshold: configPayload.threshold,
                }),
                ...(typeof configPayload.enabled === 'boolean' && {
                  enabled: configPayload.enabled,
                }),
              }));
            }
          } catch (error) {
            console.error('Failed to process WebSocket message:', error);
          }
        };

        wsRef.current.onerror = (error) => {
          console.error('WebSocket error:', error);
          setWsConnected(false);
        };

        wsRef.current.onclose = () => {
          setWsConnected(false);
          console.log('WebSocket disconnected');
          // Attempt reconnection after 3 seconds
          setTimeout(connectWebSocket, 3000);
        };
      } catch (error) {
        console.error('Failed to initialize WebSocket:', error);
      }
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const sendWebSocketMessage = useCallback(
    (message: WebSocketMessage) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(message));
      }
    },
    []
  );

  const addPrice = useCallback(() => {
    const newPrice = Math.random() * 100 + 50;
    setPrices((prev) => [...prev.slice(-99), newPrice]);
  }, []);

  return (
    <div className="app-container">
      <header>
        <h1>Vite + React + TypeScript</h1>
        <div className="status">
          <span className={`indicator ${wsConnected ? 'connected' : 'disconnected'}`}></span>
          WebSocket: {wsConnected ? 'Connected' : 'Disconnected'}
        </div>
      </header>

      <main>
        <section className="modules">
          <FLUXModule config={fluxConfig} />

          <div className="rsi-module">
            <h3>RSI Indicator</h3>
            <p>RSI Value: {rsiData.value.toFixed(2)}</p>
            <p>Last Updated: {new Date(rsiData.timestamp).toLocaleTimeString()}</p>
            <p>Data Points: {prices.length}</p>
          </div>
        </section>

        <section className="controls">
          <button onClick={addPrice} className="btn-primary">
            Add Price Data
          </button>
          <button
            onClick={() =>
              sendWebSocketMessage({
                type: 'request_update',
                data: { timestamp: Date.now() },
              })
            }
            className="btn-secondary"
            disabled={!wsConnected}
          >
            Request Update
          </button>
          <button
            onClick={() =>
              sendWebSocketMessage({
                type: 'toggle_flux',
                payload: { enabled: !fluxConfig.enabled },
              })
            }
            className="btn-secondary"
          >
            Toggle FLUX Module
          </button>
        </section>

        <section className="debug-info">
          <h3>Debug Information</h3>
          <pre>{JSON.stringify({ wsConnected, rsiValue: rsiData.value, priceCount: prices.length }, null, 2)}</pre>
        </section>
      </main>
    </div>
  );
}

export default App;
