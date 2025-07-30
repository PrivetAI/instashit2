import { useState, useEffect, useRef } from 'react';

export function useWebSocket(url: string) {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [lastMessage, setLastMessage] = useState<any | null>(null);
  const [readyState, setReadyState] = useState<number>(WebSocket.CONNECTING);
  const messageQueue = useRef<any[]>([]);

  useEffect(() => {
    const ws = new WebSocket(url);

    ws.onopen = () => {
      setReadyState(WebSocket.OPEN);
      // Send any queued messages
      while (messageQueue.current.length > 0) {
        const message = messageQueue.current.shift();
        ws.send(JSON.stringify(message));
      }
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setLastMessage(data);
    };

    ws.onclose = () => {
      setReadyState(WebSocket.CLOSED);
    };

    ws.onerror = () => {
      setReadyState(WebSocket.CLOSED);
    };

    setSocket(ws);

    return () => {
      ws.close();
    };
  }, [url]);

  const sendMessage = (message: any) => {
    if (readyState === WebSocket.OPEN) {
      socket?.send(JSON.stringify(message));
    } else {
      messageQueue.current.push(message);
    }
  };

  return { socket, lastMessage, readyState, sendMessage };
}
