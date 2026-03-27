const API_BASE = import.meta.env.VITE_API_URL || '/api';

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

export function createPairing() {
  return request('/pairing/create', { method: 'POST' });
}

export function refreshPairing(pairingId, tvSessionId) {
  return request('/pairing/refresh', {
    method: 'POST',
    body: JSON.stringify({ pairingId, tvSessionId }),
  });
}

export function joinPairing(code) {
  return request('/pairing/join', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

export function sendCommand(pairingId, deviceId, type, payload) {
  return request('/pairing/command', {
    method: 'POST',
    body: JSON.stringify({ pairingId, deviceId, type, payload }),
  });
}

export function getPairingStatus(pairingId) {
  return request(`/pairing/status/${pairingId}`);
}

export function disconnect(pairingId, deviceId) {
  return request('/pairing/disconnect', {
    method: 'POST',
    body: JSON.stringify({ pairingId, deviceId }),
  });
}

export function subscribeToEvents(pairingId, onMessage) {
  const url = `${API_BASE}/pairing/events/${pairingId}`;
  const es = new EventSource(url);
  es.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data);
      onMessage(data);
    } catch { /* ignore parse errors */ }
  };
  es.onerror = () => {
    // EventSource auto-reconnects
  };
  return es;
}
