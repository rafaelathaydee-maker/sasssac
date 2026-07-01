import http from "http";
import { app } from "./app";
import { env } from "./config/env";
import { logger } from "./lib/logger";
import { initSocket } from "./realtime/socket";

const server = http.createServer(app);
initSocket(server, env.corsOrigin);

server.listen(env.port, () => {
  logger.info({ port: env.port }, "API iniciada");
});

