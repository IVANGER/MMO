// AFK-проверка: если игрок не делал команд 5 минут — кик

import { logger } from "../log.js";
import { getAllSessions } from "./sessions.js";

export const AFK_TIMEOUT_MS = 5 * 60 * 1000;
const CHECK_INTERVAL_MS = 30 * 1000;

let timer = null;

export function startAfkCheck() {
  if (timer) return;
  timer = setInterval(check, CHECK_INTERVAL_MS);
  logger.info(`AFK check started (timeout ${AFK_TIMEOUT_MS / 1000}s)`);
}

function check() {
  const now = Date.now();
  for (const session of getAllSessions()) {
    if (!session.lastActivity) continue;
    const idle = now - session.lastActivity;
    if (idle > AFK_TIMEOUT_MS) {
      logger.info(`AFK kick: ${session.user.nickname} (idle ${Math.round(idle / 1000)}s)`);
      try {
        session.ws.send(JSON.stringify({
          type: "afkKick",
          message: "Ты был отключён за бездействие (5 минут).",
        }));
      } catch {}
      try { session.ws.close(4001, "afk"); } catch {}
    }
  }
}