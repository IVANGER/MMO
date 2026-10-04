// Точка входа: WebSocket-сервер + раздача статики

import { WebSocketServer } from "ws";
import { createServer } from "http";
import { readFile } from "fs/promises";
import { extname, join, dirname, normalize } from "path";
import { fileURLToPath } from "url";

import { CONFIG } from "./config.js";
import { logger } from "./log.js";
import { runMigrations } from "./db.js";
import { cleanExpiredTokens } from "./auth.js";
import {
  registerClient,
  unregisterClient,
  onPong,
  startHeartbeat,
} from "./network/heartbeat.js";
import { dispatch } from "./network/dispatcher.js";
import { destroySession, getSession, getAllSessions } from "./network/sessions.js";
import { validateContent } from "./content/index.js";
import { startTick } from "./world/world.js";
import { startAutoUnload, getLoadedLocation } from "./world/loadManager.js";
import * as entityStore from "./world/entityStore.js";
import { startBodyTimer } from "./world/bodyTimer.js";
import { startAfkCheck } from "./network/afk.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");
const CLIENT_DIR = join(ROOT_DIR, "client");
const SHARED_DIR = join(ROOT_DIR, "shared");

// ============ HTTP ============

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
};

function resolveFilePath(urlPath) {
  let baseDir = CLIENT_DIR;
  let relPath = urlPath;

  if (urlPath.startsWith("/shared/")) {
    baseDir = SHARED_DIR;
    relPath = urlPath.slice("/shared/".length);
  } else {
    relPath = urlPath.slice(1);
  }

  if (relPath === "" || relPath === "/") relPath = "index.html";

  const fullPath = normalize(join(baseDir, relPath));
  if (!fullPath.startsWith(baseDir)) return null;

  return fullPath;
}

const httpServer = createServer(async (req, res) => {
  try {
    const urlPath = req.url.split("?")[0];

    if (urlPath.includes("..")) {
      res.writeHead(400);
      return res.end("Bad request");
    }

    const filePath = resolveFilePath(urlPath);
    if (!filePath) {
      res.writeHead(404);
      return res.end("Not found");
    }

    const data = await readFile(filePath);
    const mime = MIME[extname(filePath)] ?? "application/octet-stream";

    res.writeHead(200, {
      "Content-Type": mime,
      "Cache-Control": "no-cache",
    });
    res.end(data);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
  }
});

// ============ WebSocket ============

const wss = new WebSocketServer({ server: httpServer });
let nextClientId = 1;

wss.on("connection", (ws) => {
  const clientId = nextClientId++;
  ws.clientId = clientId;
  ws.userId = null;
  ws.token = null;

  registerClient(ws);
  logger.info(`Client #${clientId} connected (total: ${wss.clients.size})`);

  ws.send(JSON.stringify({
    type: "welcome",
    clientId,
    totalClients: wss.clients.size,
  }));

  ws.on("message", (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); }
    catch { return logger.warn(`#${clientId}: bad JSON`); }

    if (msg.type === "pong") return onPong(ws);

    dispatch(ws, msg);
  });

  ws.on("close", () => {
    unregisterClient(ws);

    const session = getSession(ws);

    if (session) {
      // Сохраняем позицию тела ПЕРЕД тем как пометить оффлайн
      if (session.characterId && session.locationId) {
        const loc = getLoadedLocation(session.locationId);
        const entity = loc?.entities.get(session.characterId);

        if (entity) {
          try {
            entityStore.updatePosition(entity.id, entity.x, entity.y);
            if (entity.hp !== undefined) {
              entityStore.updateStats(entity.id, entity.hp, entity.mp);
            }
          } catch (err) {
            logger.error(`Failed to save position on disconnect`, err.message);
          }
        }
      }

      // Помечаем тело оффлайн (тело остаётся в loc.entities)
      if (session.characterId) {
        try {
          entityStore.markOffline(session.characterId);
          logger.info(`Body offline: ${session.characterId} (will timeout in 5 min)`);
        } catch (err) {
          logger.error(`Failed to mark offline`, err.message);
        }
      }

      logger.info(`Client #${clientId} disconnected (user: ${session.user.nickname})`);
    } else {
      logger.info(`Client #${clientId} disconnected`);
    }
  });

  ws.on("error", (err) => {
    logger.error(`Client #${clientId} error: ${err.message}`);
  });
});

// ============ Запуск ============

runMigrations();
cleanExpiredTokens();
setInterval(cleanExpiredTokens, 60 * 60 * 1000);

validateContent();

httpServer.listen(CONFIG.PORT, () => {
  logger.info(`Server started on http://localhost:${CONFIG.PORT}`);
  startHeartbeat();
  startTick();
  startAutoUnload();
  startBodyTimer();
  startAfkCheck();
});

process.on("SIGINT", () => {
  logger.info("Shutting down...");
  wss.close();
  httpServer.close(() => process.exit(0));
});