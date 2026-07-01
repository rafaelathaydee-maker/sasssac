import dotenv from "dotenv";

dotenv.config();

export const env = {
  port: Number(process.env.PORT) || 4000,
  databaseUrl: process.env.DATABASE_URL || "",
  jwtSecret: process.env.JWT_SECRET || "dev-secret",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",
  rootDomain: process.env.ROOT_DOMAIN || "saaschat.com",
  publicApiUrl: process.env.PUBLIC_API_URL || "",
  evolutionApiUrl: process.env.EVOLUTION_API_URL || "",
  evolutionApiKey: process.env.EVOLUTION_API_KEY || "",
};
