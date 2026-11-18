// =====================================================================
//  Online transport shared by every online game in the arcade.
//  1) Direct connection (PeerJS / WebRTC) - fastest.
//  2) If that can't connect (phone data, school or work networks), the
//     game automatically switches to a relay through the arcade's
//     Supabase project, so it works on any internet connection.
//  Add ?net=local to the URL to test with two tabs on one computer,
//  or ?net=relay to force the relay.
//  Each game sets window.NET_PREFIX before loading this file.
// =====================================================================
'use strict';
const NetTransport = (() => {
  const PREFIX = window.NET_PREFIX || 'arcade-cnatt-';
  const PEER_URLS = ['https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js', 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js'];
  const useLocal = /[?&]net=local/.test(location.search), forceRelay = /[?&]net=relay/.test(location.search);
  const ICE = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }, { urls: 'stun:stun.cloudflare.com:3478' }, ...(window.TURN_SERVERS || [])] };
  const status = { text: '', ping: 0, mode: '' };   // mode: 'direct' | 'relay' | 'local'
  let peerLoad = null;
  function loadPeer() {
    if (window.Peer) return Promise.resolve();
    if (peerLoad) return peerLoad;
    peerLoad = new Promise((res, rej) => {
      let i = 0;
      const next = () => {
        if (i >= PEER_URLS.length) { peerLoad = null; rej(new Error('peer library blocked')); return; }
        const s = document.createElement('script'); s.src = PEER_URLS[i++]; s.async = true;
        s.onload = () => window.Peer ? res() : next(); s.onerror = next;
        document.head.appendChild(s);
      };
      next();
    });
    return peerLoad;
  }
  const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

  // ------------------------------------------------------------ direct links (PeerJS data connections)
  function link(c, onMsg, onDead) {
    const L = { c, q: [], last: Date.now(), open: false, dead: false };
    const raw = m => { try { c.send(m); } catch (e) {} };
    L.send = m => { if (L.open && c.open) raw(m); else if (L.q.length < 200) L.q.push(m); };
    L.close = () => { L.dead = true; try { c.close(); } catch (e) {} };
    c.on('open', () => { L.open = true; L.last = Date.now(); L.q.splice(0).forEach(raw); });
    c.on('data', d => {
      L.last = Date.now();
      if (d && d.t === '_ping') { raw({ t: '_pong', s: d.s }); return; }
      if (d && d.t === '_pong') { status.ping = Date.now() - d.s; return; }
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

  // ------------------------------------------------------------ relay (Supabase Realtime broadcast)
  // Messages are batched ~12 times a second; for fast-changing state only the newest copy is sent.
  const STATE_TYPES = new Set(['S', 'snap', 'st', 'in', 'pos', 'state']);
  async function supa() {
    const A = window.Account;
    if (!A || !A.configured) return null;
    try { await withTimeout(A.init(), 8000); } catch (e) {}
    return A.sb || null;
  }
  function relayChannel(sb, code, me, onMsg) {
    const ch = sb.channel('arcade-relay-' + PREFIX + code, { config: { broadcast: { self: false, ack: false } } });
    const out = [], latest = new Map();   // latest state per (to,type)
    ch.on('broadcast', { event: 'm' }, ({ payload }) => {
      if (!payload || payload.f === me) return;
      (payload.b || []).forEach(x => { if (x.to === me || x.to === '*') onMsg(payload.f, x.d); });
    });
    const flush = () => {
      if (!out.length && !latest.size) return;
      const b = out.splice(0); latest.forEach(v => b.push(v)); latest.clear();
      ch.send({ type: 'broadcast', event: 'm', payload: { f: me, b } }).catch(() => {});
    };
    const iv = setInterval(flush, 80);
    return {
      ready: new Promise((res, rej) => ch.subscribe(s => { if (s === 'SUBSCRIBED') res(); else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') rej(new Error(s)); })),
      post(to, d) { if (d && STATE_TYPES.has(d.t)) latest.set(to + '|' + d.t, { to, d }); else out.push({ to, d }); },
      close() { clearInterval(iv); flush(); try { sb.removeChannel(ch); } catch (e) {} },
    };
  }

  // ------------------------------------------------------------ host: listens on both direct and relay
  function peerHost(code, ev) {
    let peer = null, relay = null, ready = false, closed = false;
    const links = new Map();
    const becomeReady = () => { if (!ready && !closed) { ready = true; status.text = 'Room open'; ev.ready('host'); } };
    status.text = 'Starting room...'; status.mode = '';
    // direct
    if (!forceRelay) loadPeer().then(() => {
      if (closed) return;
      peer = new Peer(PREFIX + code, { debug: 0, config: ICE });
      peer.on('open', becomeReady);
      peer.on('connection', c => {
        const id = c.peer;
        const L = link(c, d => ev.msg(id, d), () => { if (links.get(id) === L) { links.delete(id); ev.leave(id); } });
        links.set(id, L);
        c.on('open', () => ev.join(id));
      });
      peer.on('error', e => {
        if (e.type === 'unavailable-id') ev.error('taken');
        else if (e.type === 'network' || e.type === 'server-error' || e.type === 'socket-error') status.text = 'Reconnecting...';
      });
      peer.on('disconnected', () => setTimeout(() => { try { if (peer && !peer.destroyed) peer.reconnect(); } catch (x) {} }, 1000));
    }).catch(() => {});
    // relay
    supa().then(sb => {
      if (!sb || closed) return;
      const seen = new Map();
      relay = relayChannel(sb, code, 'host', (from, d) => {
        seen.set(from, Date.now());
        if (d && d.t === '_hello') {
          relay.post(from, { t: '_welcome' });
          if (!links.has(from)) { links.set(from, { relay: true, send: m => relay.post(from, m), close() {} }); ev.join(from); }
          return;
        }
        if (d && d.t === '_ping') { relay.post(from, { t: '_pong', s: d.s }); return; }
        if (d && d.t === '_bye') { if (links.get(from) && links.get(from).relay) { links.delete(from); ev.leave(from); } return; }
        if (links.has(from)) ev.msg(from, d);
      });
      relay.ready.then(becomeReady).catch(() => {});
      relay.hb = setInterval(() => {
        links.forEach((L, id) => { if (L.relay && Date.now() - (seen.get(id) || 0) > 12000) { links.delete(id); ev.leave(id); } });
      }, 2000);
    });
    // nothing at all worked
    setTimeout(() => { if (!ready && !closed) ev.error('Could not start the room. Check your internet connection.'); }, 15000);
    return {
      send(to, m) { const L = links.get(to); if (L) L.send(m); },
      broadcast(m) { links.forEach(L => L.send(m)); },
      kick(id) { const L = links.get(id); if (L) { links.delete(id); if (L.relay) relay && relay.post(id, { t: 'closed' }); else L.close(); } },
      close() {
        closed = true;
        links.forEach((L, id) => { if (L.relay) relay && relay.post(id, { t: 'closed' }); else L.close(); }); links.clear();
        if (relay) { clearInterval(relay.hb); relay.close(); }
        if (peer) try { peer.destroy(); } catch (x) {}
      },
    };
  }

  // ------------------------------------------------------------ client: direct first, relay if that fails
  function peerJoin(code, ev) {
    let peer = null, L = null, relay = null, ok = false, failed = false, closed = false, timer = null;
    const me = 'p' + Math.random().toString(36).slice(2, 10);
    status.text = 'Connecting...'; status.mode = '';
    const done = mode => { if (ok || closed) return; ok = true; clearTimeout(timer); status.mode = mode; status.text = mode === 'relay' ? 'Connected (relay)' : 'Connected'; ev.ready(mode === 'relay' ? me : peer.id); };
    const fail = msg => { if (ok || failed || closed) return; failed = true; ev.error(msg); };

    async function tryRelay() {
      if (ok || closed) return;
      status.text = 'Trying another way to connect...';
      const sb = await supa();
      if (!sb) return fail('Could not connect. Make sure the code is right and the host has the room open.');
      let last = Date.now(), welcomed = false;
      relay = relayChannel(sb, code, me, (from, d) => {
        if (from !== 'host') return;
        last = Date.now();
        if (d && d.t === '_welcome') { if (!welcomed) { welcomed = true; done('relay'); } return; }
        if (d && d.t === '_pong') { status.ping = Date.now() - d.s; return; }
        if (ok) ev.msg('host', d);
      });
      try { await withTimeout(relay.ready, 8000); } catch (e) { return fail('Could not connect to the online service.'); }
      let n = 0;
      const hello = setInterval(() => { if (welcomed || closed || ++n > 6) { clearInterval(hello); if (!welcomed && !closed) fail('Room not found'); return; } relay.post('host', { t: '_hello' }); }, 1000);
      relay.post('host', { t: '_hello' });
      relay.hb = setInterval(() => {
        if (!ok) return;
        relay.post('host', { t: '_ping', s: Date.now() });
        if (Date.now() - last > 12000) { clearInterval(relay.hb); ev.leave('host'); }
      }, 2000);
    }

    if (forceRelay) tryRelay();
    else loadPeer().then(() => {
      if (closed) return;
      peer = new Peer({ debug: 0, config: ICE });
      peer.on('open', () => {
        const c = peer.connect(PREFIX + code, { reliable: true, serialization: 'json' });
        L = link(c, d => ev.msg('host', d), () => { if (ok && status.mode === 'direct') ev.leave('host'); });
        c.on('open', () => done('direct'));
        timer = setTimeout(() => { if (!ok) { try { c.close(); } catch (x) {} tryRelay(); } }, 7000);
      });
      peer.on('error', e => {
        if (ok) return;
        clearTimeout(timer);
        // room missing on the direct server can still exist on the relay (host behind a blocked network)
        tryRelay();
      });
    }).catch(() => tryRelay());

    return {
      send(to, m) { if (status.mode === 'relay') relay && relay.post('host', m); else if (L) L.send(m); },
      broadcast(m) { this.send('host', m); },
      close() {
        closed = true; clearTimeout(timer);
        if (relay) { relay.post('host', { t: '_bye' }); clearInterval(relay.hb); relay.close(); }
        if (L) L.close();
        if (peer) try { peer.destroy(); } catch (x) {}
      },
    };
  }

  // ------------------------------------------------------------ same-computer transport (BroadcastChannel) for testing
  function localHost(code, ev) {
    const bc = new BroadcastChannel(PREFIX + code), seen = new Map();
    bc.onmessage = e => { const { from, to, d } = e.data; if (to !== 'host') return; if (d && d.t === 'probe') { bc.postMessage({ from: 'host', to: from, d: { t: 'probe-ok' } }); return; } if (!seen.has(from)) { seen.set(from, Date.now()); ev.join(from); } seen.set(from, Date.now()); if (d && d.t === 'bye') { seen.delete(from); ev.leave(from); return; } if (d.t === 'ping') { bc.postMessage({ from: 'host', to: from, d: { t: 'pong', s: d.s } }); return; } ev.msg(from, d); };
    const hb = setInterval(() => { const now = Date.now(); seen.forEach((v, id) => { if (now - v > 6000) { seen.delete(id); ev.leave(id); } }); bc.postMessage({ from: 'host', to: '*', d: { t: 'ping' } }); }, 1000);
    setTimeout(() => { status.text = 'Room open'; status.mode = 'local'; ev.ready('host'); }, 50);
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
    bc.onmessage = e => { const { from, to, d } = e.data; if (from !== 'host' || (to !== me && to !== '*')) return; last = Date.now(); if (d.t === 'probe-ok') { if (!ok) { ok = true; status.text = 'Connected'; status.mode = 'local'; ev.ready(me); } return; } if (d.t === 'pong') { status.ping = Date.now() - d.s; return; } if (d.t === 'ping') return; ev.msg('host', d); };
    bc.postMessage({ from: me, to: 'host', d: { t: 'probe' } });
    const fail = setTimeout(() => { if (!ok) ev.error('Room not found'); }, 3000);
    const hb = setInterval(() => { if (ok) bc.postMessage({ from: me, to: 'host', d: { t: 'ping', s: Date.now() } }); if (ok && Date.now() - last > 6000) { clearInterval(hb); ev.leave('host'); } }, 1000);
    return {
      send(to, m) { bc.postMessage({ from: me, to: 'host', d: m }); },
      broadcast(m) { this.send('host', m); },
      close() { bc.postMessage({ from: me, to: 'host', d: { t: 'bye' } }); clearInterval(hb); clearTimeout(fail); bc.close(); },
    };
  }

  // ------------------------------------------------------------ keep the game running when its tab is hidden
  let rafAt = 0;
  const stalled = () => document.hidden || performance.now() - rafAt > 150;
  function backgroundTicker(fn, hz = 30) {
    let last = performance.now();
    const tick = () => { const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now; if (stalled()) fn(dt); };
    try {
      const w = new Worker(URL.createObjectURL(new Blob([`setInterval(() => postMessage(0), ${Math.round(1000 / hz)});`], { type: 'text/javascript' })));
      w.onmessage = tick;
    } catch (e) { setInterval(tick, Math.round(1000 / hz)); }
  }

  // ------------------------------------------------------------ "friends can join": tell the arcade which room I'm hosting
  function announce(game, code) {
    try { const A = window.Account; if (A && A.setRoom) A.setRoom(code ? { game, code } : null); } catch (e) {}
  }
  // a game opened from a friend's Join button gets ?join=CODE (or #join=CODE)
  function joinCode() {
    const m = (location.search + location.hash).match(/[?&#]join=([A-Za-z0-9]{4,6})/);
    return m ? m[1].toUpperCase() : null;
  }

  return {
    local: useLocal, status, backgroundTicker, announce, joinCode,
    frame() { rafAt = performance.now(); },
    host: (code, ev) => useLocal ? localHost(code, ev) : peerHost(code, ev),
    join: (code, ev) => useLocal ? localJoin(code, ev) : peerJoin(code, ev),
  };
})();
