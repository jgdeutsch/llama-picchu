// WebSocket Hook for Llama Picchu MUD
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { ServerMessage, ClientMessage } from '../../shared/types/websocket';

interface UseWebSocketOptions {
  onMessage?: (message: ServerMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  autoReconnect?: boolean;
}

interface UseWebSocketReturn {
  connected: boolean;
  authenticated: boolean;
  send: (message: ClientMessage) => void;
  sendCommand: (command: string) => void;
  connect: (token: string) => void;
  disconnect: () => void;
}

export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketReturn {
  const [connected, setConnected] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const tokenRef = useRef<string | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isConnectingRef = useRef(false);

  const {
    onMessage,
    onConnect,
    onDisconnect,
    autoReconnect = true,
  } = options;

  // Store callbacks in refs to avoid recreating connect function
  const onMessageRef = useRef(onMessage);
  const onConnectRef = useRef(onConnect);
  const onDisconnectRef = useRef(onDisconnect);

  useEffect(() => {
    onMessageRef.current = onMessage;
    onConnectRef.current = onConnect;
    onDisconnectRef.current = onDisconnect;
  }, [onMessage, onConnect, onDisconnect]);

  const cleanup = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  }, []);

  const connect = useCallback((token: string) => {
    // Prevent multiple simultaneous connections
    if (isConnectingRef.current || wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('Already connected or connecting, skipping');
      return;
    }

    cleanup();
    isConnectingRef.current = true;
    tokenRef.current = token;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    console.log('Connecting to WebSocket:', wsUrl);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected');
      isConnectingRef.current = false;
      setConnected(true);

      // Authenticate immediately
      ws.send(JSON.stringify({ type: 'auth', token }));

      // Start ping interval
      pingIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 30000);
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as ServerMessage;

        // Handle auth messages
        if (message.type === 'auth_success') {
          console.log('Authentication successful');
          setAuthenticated(true);
          onConnectRef.current?.();
        } else if (message.type === 'auth_failure') {
          console.error('Authentication failed:', message.reason);
          setAuthenticated(false);
        }

        // Pass all messages to handler
        onMessageRef.current?.(message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      isConnectingRef.current = false;
      setConnected(false);
      setAuthenticated(false);
      cleanup();
      onDisconnectRef.current?.();

      // Auto-reconnect
      if (autoReconnect && tokenRef.current) {
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('Attempting to reconnect...');
          connect(tokenRef.current!);
        }, 3000);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      isConnectingRef.current = false;
    };
  }, [cleanup, autoReconnect]);

  const disconnect = useCallback(() => {
    cleanup();
    tokenRef.current = null;
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnected(false);
    setAuthenticated(false);
  }, [cleanup]);

  const send = useCallback((message: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected');
    }
  }, []);

  const sendCommand = useCallback((command: string) => {
    send({ type: 'command', command });
  }, [send]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [cleanup]);

  return {
    connected,
    authenticated,
    send,
    sendCommand,
    connect,
    disconnect,
  };
}
