import { useState, useEffect, useCallback } from 'react';

export function useCastSession() {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connection, setConnection] = useState(null);

  useEffect(() => {
    setIsAvailable(typeof window !== 'undefined' && 'PresentationRequest' in window);
  }, []);

  const startCasting = useCallback(
    async (tvUrl) => {
      if (!isAvailable) return;
      try {
        const request = new window.PresentationRequest([tvUrl]);
        const conn = await request.start();
        setConnection(conn);
        setIsConnected(true);
        conn.addEventListener('close', () => {
          setIsConnected(false);
          setConnection(null);
        });
        conn.addEventListener('terminate', () => {
          setIsConnected(false);
          setConnection(null);
        });
      } catch {
        // User cancelled or Presentation API error
      }
    },
    [isAvailable]
  );

  const stopCasting = useCallback(() => {
    if (connection) {
      connection.terminate();
      setConnection(null);
      setIsConnected(false);
    }
  }, [connection]);

  return { isAvailable, isConnected, startCasting, stopCasting };
}
