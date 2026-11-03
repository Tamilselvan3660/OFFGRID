import { EventEmitter } from 'node:events';

const emitter = new EventEmitter();
emitter.setMaxListeners(0);

/** Broadcast a change to every connected dashboard (Server-Sent Events). */
export function publish(type, payload = {}) {
  const event = { type, payload, timestamp: new Date().toISOString() };
  emitter.emit('broadcast', event);
  return event;
}

export function subscribe(res, clientId) {
  const send = (event) => {
    try {
      res.write(`id: ${Date.now()}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
    } catch {
      /* connection already closed */
    }
  };
  const listener = (event) => send(event);
  emitter.on('broadcast', listener);
  send({ type: 'connected', payload: { clientId, serverTime: new Date().toISOString() }, timestamp: new Date().toISOString() });

  const heartbeat = setInterval(() => {
    try {
      res.write(`: heartbeat ${Date.now()}\n\n`);
    } catch {
      /* no-op */
    }
  }, 20000);

  return () => {
    clearInterval(heartbeat);
    emitter.off('broadcast', listener);
  };
}

export function notify(title, body, kind = 'info', link = null) {
  const event = publish('notification', { title, body, kind, link });
  return event;
}
