// =====================================================================
//  TURBO KARTS - online transport
//  Uses PeerJS (WebRTC, free public signalling server) so players can
//  race from different computers using a 5-letter room code.
//  Add ?net=local to the URL to test with two tabs on one computer.
// =====================================================================
'use strict';
const NetTransport = (() => {
  const PREFIX = 'turbokarts-cnatt-';
  const PEER_URLS = ['https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js', 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js'];
  const useLocal = /[?&]net=local/.test(location.search);
  let peerLoad = null;
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

  // ---------- PeerJS transport
  function peerHost(code, ev) {
    let peer = null; const conns = new Map();
    loadPeer().then(() => {
      peer = new Peer(PREFIX + code, { debug: 0 });
      peer.on('open', () => ev.ready('host'));
      peer.on('connection', c => {
        c.on('open', () => { conns.set(c.peer, c); ev.join(c.peer); });
        c.on('data', d => ev.msg(c.peer, d));
        c.on('close', () => { if (conns.has(c.peer)) { conns.delete(c.peer); ev.leave(c.peer); } });
        c.on('error', () => {});
      });
      peer.on('error', e => ev.error(e.type === 'unavailable-id' ? 'taken' : (e.message || String(e.type))));
      peer.on('disconnected', () => { try { peer.reconnect(); } catch (x) {} });
    }).catch(e => ev.error(e.message));
    return {
      send(to, m) { const c = conns.get(to); if (c && c.open) try { c.send(m); } catch (x) {} },
      broadcast(m) { conns.forEach(c => { if (c.open) try { c.send(m); } catch (x) {} }); },
      kick(id) { const c = conns.get(id); if (c) { conns.delete(id); try { c.close(); } catch (x) {} } },
      close() { conns.forEach(c => { try { c.close(); } catch (x) {} }); conns.clear(); if (peer) try { peer.destroy(); } catch (x) {} },
    };
  }
  function peerJoin(code, ev) {
    let peer = null, conn = null, opened = false;
    loadPeer().then(() => {
      peer = new Peer({ debug: 0 });
      peer.on('open', id => {
        conn = peer.connect(PREFIX + code, { reliable: true, serialization: 'json' });
        const timer = setTimeout(() => { if (!opened) ev.error('Room not found'); }, 12000);
        conn.on('open', () => { opened = true; clearTimeout(timer); ev.ready(id); });
        conn.on('data', d => ev.msg('host', d));
        conn.on('close', () => ev.leave('host'));
        conn.on('error', () => {});
      });
      peer.on('error', e => ev.error(e.type === 'peer-unavailable' ? 'Room not found' : (e.message || String(e.type))));
    }).catch(e => ev.error(e.message));
    return {
      send(to, m) { if (conn && conn.open) try { conn.send(m); } catch (x) {} },
      broadcast(m) { this.send('host', m); },
      close() { if (conn) try { conn.close(); } catch (x) {} if (peer) try { peer.destroy(); } catch (x) {} },
    };
  }

  // ---------- same-computer transport (BroadcastChannel) for testing
  function localHost(code, ev) {
    const bc = new BroadcastChannel(PREFIX + code), seen = new Map();
    bc.onmessage = e => { const { from, to, d } = e.data; if (to !== 'host') return; if (d && d.t === 'probe') { bc.postMessage({ from: 'host', to: from, d: { t: 'probe-ok' } }); return; } if (!seen.has(from)) { seen.set(from, Date.now()); ev.join(from); } seen.set(from, Date.now()); if (d && d.t === 'bye') { seen.delete(from); ev.leave(from); return; } if (d.t !== 'ping') ev.msg(from, d); };
    const hb = setInterval(() => { const now = Date.now(); seen.forEach((v, id) => { if (now - v > 6000) { seen.delete(id); ev.leave(id); } }); bc.postMessage({ from: 'host', to: '*', d: { t: 'ping' } }); }, 1000);
    setTimeout(() => ev.ready('host'), 50);
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
    bc.onmessage = e => { const { from, to, d } = e.data; if (from !== 'host' || (to !== me && to !== '*')) return; last = Date.now(); if (d.t === 'probe-ok') { if (!ok) { ok = true; ev.ready(me); } return; } if (d.t === 'ping') return; ev.msg('host', d); };
    bc.postMessage({ from: me, to: 'host', d: { t: 'probe' } });
    const fail = setTimeout(() => { if (!ok) ev.error('Room not found'); }, 3000);
    const hb = setInterval(() => { if (ok) bc.postMessage({ from: me, to: 'host', d: { t: 'ping' } }); if (ok && Date.now() - last > 6000) { clearInterval(hb); ev.leave('host'); } }, 1000);
    return {
      send(to, m) { bc.postMessage({ from: me, to: 'host', d: m }); },
      broadcast(m) { this.send('host', m); },
      close() { bc.postMessage({ from: me, to: 'host', d: { t: 'bye' } }); clearInterval(hb); clearTimeout(fail); bc.close(); },
    };
  }
  return {
    local: useLocal,
    host: (code, ev) => useLocal ? localHost(code, ev) : peerHost(code, ev),
    join: (code, ev) => useLocal ? localJoin(code, ev) : peerJoin(code, ev),
  };
})();
