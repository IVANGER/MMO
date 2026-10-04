// WebSocket-клиент с авто-переподключением, ping/pong, авто-resume

const TOKEN_KEY = "hero_camp_token";

export const net = {
  ws: null,
  handlers: new Map(),
  reconnectDelay: 1000,
  maxReconnectDelay: 10000,
  shouldReconnect: true,

  connect(url) {
    this.shouldReconnect = true;

    if (!url) {
      const proto = location.protocol === "https:" ? "wss:" : "ws:";
      url = `${proto}//${location.host}`;
    }

    this._url = url;
    this._open(url);
  },

  _open(url) {
    this.ws = new WebSocket(url);

       this.ws.onopen = () => {
      this.reconnectDelay = 1000;
      this.emit("_open");
    };

    this.ws.onmessage = (e) => {
      let msg;
      try { msg = JSON.parse(e.data); }
      catch { return console.warn("Invalid JSON from server:", e.data); }

      if (msg.type === "ping") {
        this.send({ type: "pong" });
        return;
      }

      this.emit(msg.type, msg);
      this.emit("_any", msg);
    };

    this.ws.onclose = (e) => {
      this.emit("_close", e);
      if (this.shouldReconnect) {
        console.log(`Reconnecting in ${this.reconnectDelay}ms...`);
        setTimeout(() => this._open(url), this.reconnectDelay);
        this.reconnectDelay = Math.min(
          this.reconnectDelay * 1.5,
          this.maxReconnectDelay
        );
      }
    };

    this.ws.onerror = () => {
      console.warn("WS error");
    };
  },

  send(obj) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj));
      return true;
    }
    return false;
  },

  on(type, fn) {
    if (!this.handlers.has(type)) this.handlers.set(type, []);
    this.handlers.get(type).push(fn);
    return () => this.off(type, fn);
  },

  off(type, fn) {
    const arr = this.handlers.get(type);
    if (!arr) return;
    const idx = arr.indexOf(fn);
    if (idx >= 0) arr.splice(idx, 1);
  },

  emit(type, payload) {
    const arr = this.handlers.get(type);
    if (!arr) return;
    for (const fn of arr) {
      try { fn(payload); }
      catch (e) { console.error(`Handler for "${type}" failed:`, e); }
    }
  },

  close() {
    this.shouldReconnect = false;
    this.ws?.close();
  },
};