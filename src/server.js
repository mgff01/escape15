"use strict";

const http = require("node:http");
const path = require("node:path");

const express = require("express");
const { Server: SocketServer } = require("socket.io");

const { createColorSource } = require("./colorSource");
const { loadConfig } = require("./config");
const logger = require("./logger");

const PUBLIC_DIR = path.join(__dirname, "..", "public");

/**
 * Sobe o servidor do jogo: serve os arquivos estaticos, abre a fonte de cores
 * (serial ou demonstracao) e repassa cada leitura aos navegadores conectados.
 *
 * @param {object} config resultado de loadConfig()
 * @returns {Promise<{server: http.Server, io: SocketServer, source: object, close: Function}>}
 */
async function startServer(config = loadConfig()) {
  const app = express();
  const server = http.createServer(app);
  const io = new SocketServer(server, { serveClient: true });
  const source = createColorSource(config);

  // Ultimo estado conhecido. Um navegador que abre depois precisa receber isso
  // na conexao, senao fica com a tela vazia ate a proxima leitura.
  let lastColor = null;

  app.use(express.static(PUBLIC_DIR, { maxAge: "1h", etag: true }));

  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      source: source.status,
      lastColor,
      mock: config.mock,
      uptimeSeconds: Math.round(process.uptime()),
    });
  });

  source.on("color", (color) => {
    lastColor = { ...color, receivedAt: Date.now() };
    io.emit("color", lastColor);
  });

  source.on("status", (status) => {
    logger.info(`Fonte de cores: ${status.state}${status.detail ? ` (${status.detail})` : ""}`);
    io.emit("source-status", status);
  });

  source.on("device", (message) => {
    io.emit("device-message", message);
  });

  io.on("connection", (socket) => {
    logger.debug(`Navegador conectado (${socket.id})`);
    socket.emit("source-status", source.status);
    if (lastColor) socket.emit("color", lastColor);
    socket.on("disconnect", () => logger.debug(`Navegador desconectado (${socket.id})`));
  });

  await source.start();

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(config.port, () => {
      server.removeListener("error", reject);
      resolve();
    });
  });

  logger.info(`Jogo disponivel em http://localhost:${config.port}`);

  const close = async () => {
    await source.stop();
    io.close();
    await new Promise((resolve) => server.close(resolve));
  };

  return { server, io, source, close };
}

if (require.main === module) {
  const config = loadConfig();

  startServer(config)
    .then(({ close }) => {
      const shutdown = (signal) => {
        logger.info(`Recebido ${signal}, encerrando...`);
        close()
          .then(() => process.exit(0))
          .catch((error) => {
            logger.error(`Falha ao encerrar: ${error.message}`);
            process.exit(1);
          });
      };
      process.on("SIGINT", () => shutdown("SIGINT"));
      process.on("SIGTERM", () => shutdown("SIGTERM"));
    })
    .catch((error) => {
      if (error.code === "EADDRINUSE") {
        logger.error(`A porta ${config.port} ja esta em uso. Feche o outro servidor ou rode com PORT=3001.`);
      } else {
        logger.error(`Nao foi possivel iniciar o servidor: ${error.message}`);
      }
      process.exit(1);
    });
}

module.exports = { startServer };
