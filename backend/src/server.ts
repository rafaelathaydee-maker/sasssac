import http from "http";
import { app } from "./app";
import { env } from "./config/env";
import { ensureBootstrapData } from "./lib/bootstrap";
import { logger } from "./lib/logger";
import { initSocket } from "./realtime/socket";
import { restoreWhatsappQrSessions } from "./services/channels/whatsappQr";

const server = http.createServer(app);
initSocket(server, env.corsOrigin);

ensureBootstrapData()
  .then(() => restoreWhatsappQrSessions())
  .then(() => {
    server.listen(env.port, () => {
      logger.info({ port: env.port }, "API iniciada");
    });
  })
  .catch((err) => {
    logger.error({ err }, "Falha ao inicializar dados");
    process.exit(1);
  });
