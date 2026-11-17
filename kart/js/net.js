// =====================================================================
//  Online transport (shared by Turbo Karts and Party Clash)
//  Uses PeerJS (WebRTC + free public signalling server) so players can
//  connect from different computers with a 5-letter room code.
//  Add ?net=local to the URL to test with two tabs on one computer.
// =====================================================================
'use strict';
const NetTransport = (() => {
  const PREFIX = (window.NET_PREFIX || 'turbokarts-cnatt-');
  const PEER_URLS = ['https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js', 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js'];
  const useLocal = /[?&]net=local/.test(location.search);
  // STUN finds a direct route between the two computers. A TURN relay is only needed on strict
  // networks; put your own free relay key in window.TURN_SERVERS to add one.
  const ICE = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }, { urls: 'stun:stun.cloudflare.com:3478' }, ...(window.TURN_SERVERS || [])] };
  let peerLoad = null;
  const status = { text: '', ping: 0 };
  function loadPeer() {
    if (window.Peer) return Promise.resolve();
    if (peerLoad) return peerLoad;
    peerLoad = new Promise((res, rej) => {
      let i = 0;
      const next = () => {
        if (i >= PEER_URLS.length) { peerLoad = null; rej(new Error('Could not load the online service. Check your internet connection.')); return; }
        const s = document.createElement('script'); s.src = PEER_URLS[i++]; s.async = true;
        s.onload = () => window.Peer ? res() : next(); s.onerror = next;
        document.head.appendChild(s);
      };
      next();
    });
    return peerLoad;
  }
  // wraps one data connection: queues messages until it is open, heartbeats, measures ping
  function link(c, onMsg, onDead) {
    const L = { c, q: [], last: Date.now(), ping: 0, open: false, dead: false };
    const raw = m => { try { c.send(m); } catch (e) {} };
    L.send = m => { if (L.open && c.open) raw(m); else if (L.q.length < 200) L.q.push(m); };
    c.on('open', () => { L.open = true; L.last = Date.now(); L.q.splice(0).forEach(raw); });
    c.on('data', d => {
      L.last = Date.now();
      if (d && d.t === '_ping') { raw({ t: '_pong', s: d.s }); return; }
      if (d && d.t === '_pong') { L.ping = Date.now() - d.s; status.ping = L.ping; return; }
      onMsg(d);
    });
    c.on('close', () => { if (!L.dead) { L.dead = true; onDead(); } });
    c.on('error', () => {});
    L.hb = setInterval(() => {
      if (L.dead) { clearInterval(L.hb); return; }
      if (L.open) raw({ t: '_ping', s: Date.now() });
      if (L.open && Date.now() - L.last > 10000) { L.dead = true; clearInterval(L.hb); try { c.close(); } catch (e) {} onDead(); }
    }, 1500);
    return L;
  }

  // ---------- PeerJS transport
  function peerHost(code, ev) {
    let peer = null; const links = new Map();
    status.text = 'Starting room...';
    loadPeer().then(() => {
      peer = new Peer(PREFIX + code, { debug: 0, config: ICE });
      peer.on('open', () => { status.text = 'Room open'; ev.ready('host'); });
      peer.on('connection', c => {
        const id = c.peer;
        const L = link(c, d => ev.msg(id, d), () => { if (links.get(id) === L) { links.delete(id); ev.leave(id); } });
        links.set(id, L);                         // registered right away so early replies are queued, not lost
        c.on('open', () => ev.join(id));
      });
      peer.on('error', e => {
        if (e.type === 'unavailable-id') ev.error('taken');
        else if (e.type === 'network' || e.type === 'server-error' || e.type === 'socket-error') { status.text = 'Reconnecting to the online service...'; }
        else if (e.type !== 'peer-unavailable') ev.error(e.message || String(e.type));
      });
      // losing the signalling server does not drop players already connected; just reconnect
      peer.on('disconnected', () => { setTimeout(() => { try { if (peer && !peer.destroyed) peer.reconnect(); } catch (x) {} }, 1000); });
    }).catch(e => ev.error(e.message));
    return {
      send(to, m) { const L = links.get(to); if (L) L.send(m); },
      broadcast(m) { links.forEach(L => L.send(m)); },
      kick(id) { const L = links.get(id); if (L) { links.delete(id); L.dead = true; try { L.c.close(); } catch (x) {} } },
      close() { links.forEach(L => { L.dead = true; try { L.c.close(); } catch (x) {} }); links.clear(); if (peer) try { peer.destroy(); } catch (x) {} },
    };
  }
  function peerJoin(code, ev) {
    let peer = null, L = null, ok = false, tries = 0, gotReply = false, timer = null;
    status.text = 'Connecting...';
    const connect = () => {
      tries++;
      const c = peer.connect(PREFIX + code, { reliable: true, serialization: 'json' });
      L = link(c, d => { gotReply = true; ev.msg('host', d); }, () => { if (ok) ev.leave('host'); });
      c.on('open', () => { if (ok) return; ok = true; clearTimeout(timer); status.text = 'Connected'; ev.ready(peer.id); });
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (ok) return;
        try { c.close(); } catch (x) {}
        if (tries < 3) { status.text = `Still trying (${tries + 1}/3)...`; connect(); }
        else ev.error('Could not connect. Make sure the code is right and the host has the room open.');
      }, 9000);
    };
    loadPeer().then(() => {
      peer = new Peer({ debug: 0, config: ICE });
      peer.on('open', connect);
      peer.on('error', e => { if (e.type === 'peer-unavailable') { clearTimeout(timer); ev.error('Room not found'); } else if (!ok) ev.error(e.message || String(e.type)); });
      peer.on('disconnected', () => { setTimeout(() => { try { if (peer && !peer.destroyed) peer.reconnect(); } catch (x) {} }, 1000); });
    }).catch(e => ev.error(e.message));
    return {
      send(to, m) { if (L) L.send(m); },
      broadcast(m) { this.send('host', m); },
      get gotReply() { return gotReply; },
      close() { clearTimeout(timer); if (L) { L.dead = true; try { L.c.close(); } catch (x) {} } if (peer) try { peer.destroy(); } catch (x) {} },
    };
  }

  // ---------- same-computer transport (BroadcastChannel) for testing
  function localHost(code, ev) {
    const bc = new BroadcastChannel(PREFIX + code), seen = new Map();
    bc.onmessage = e => { const { from, to, d } = e.data; if (to !== 'host') return; if (d && d.t === 'probe') { bc.postMessage({ from: 'host', to: from, d: { t: 'probe-ok' } }); return; } if (!seen.has(from)) { seen.set(from, Date.now()); ev.join(from); } seen.set(from, Date.now()); if (d && d.t === 'bye') { seen.delete(from); ev.leave(from); return; } if (d.t === 'ping') { bc.postMessage({ from: 'host', to: from, d: { t: 'pong', s: d.s } }); return; } ev.msg(from, d); };
    const hb = setInterval(() => { const now = Date.now(); seen.forEach((v, id) => { if (now - v > 6000) { seen.delete(id); ev.leave(id); } }); bc.postMessage({ from: 'host', to: '*', d: { t: 'ping' } }); }, 1000);
    setTimeout(() => { status.text = 'Room open'; ev.ready('host'); }, 50);
    return {
      send(to, m) { bc.postMessage({ from: 'host', to, d: m }); },
      broadcast(m) { bc.postMessage({ from: 'host', to: '*', d: m }); },
      kick(id) { seen.delete(id); },
      close() { bc.postMessage({ from: 'host', to: '*', d: { t: 'closed' } }); clearInterval(hb); bc.close(); },
    };
  }
  function localJoin(code, ev) {
    const bc = new BroadcastChannel(PREFIX + code), me = 'p' + Math.random().toString(36).slice(2, 9);
    let last = Date.now(), ok = false;
    bc.onmessage = e => { const { from, to, d } = e.data; if (from !== 'host' || (to !== me && to !== '*')) return; last = Date.now(); if (d.t === 'probe-ok') { if (!ok) { ok = true; status.text = 'Connected'; ev.ready(me); } return; } if (d.t === 'pong') { status.ping = Date.now() - d.s; return; } if (d.t === 'ping') return; ev.msg('host', d); };
    bc.postMessage({ from: me, to: 'host', d: { t: 'probe' } });
    const fail = setTimeout(() => { if (!ok) ev.error('Room not found'); }, 3000);
    const hb = setInterval(() => { if (ok) bc.postMessage({ from: me, to: 'host', d: { t: 'ping', s: Date.now() } }); if (ok && Date.now() - last > 6000) { clearInterval(hb); ev.leave('host'); } }, 1000);
    return {
      send(to, m) { bc.postMessage({ from: me, to: 'host', d: m }); },
      broadcast(m) { this.send('host', m); },
      close() { bc.postMessage({ from: me, to: 'host', d: { t: 'bye' } }); clearInterval(hb); clearTimeout(fail); bc.close(); },
    };
  }

  // ---------- keep the game running when its tab is hidden
  // Browsers pause hidden or covered tabs; a worker timer keeps the game and network going.
  // The game calls NetTransport.frame() every drawn frame; when frames stop, the timer takes over.
  let rafAt = 0;
  const stalled = () => document.hidden || performance.now() - rafAt > 150;
  function backgroundTicker(fn, hz = 30) {
    let last = performance.now();
    try {
      const src = `setInterval(() => postMessage(0), ${Math.round(1000 / hz)});`;
      const w = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
      w.onmessage = () => { const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now; if (stalled()) fn(dt); };
    } catch (e) {
      setInterval(() => { const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now; if (stalled()) fn(dt); }, Math.round(1000 / hz));
    }
  }
  return {
    local: useLocal, status, backgroundTicker, frame() { rafAt = performance.now(); },
    host: (code, ev) => useLocal ? localHost(code, ev) : peerHost(code, ev),
    join: (code, ev) => useLocal ? localJoin(code, ev) : peerJoin(code, ev),
  };
})();
