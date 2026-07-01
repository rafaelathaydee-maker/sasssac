import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env";
import { resolveTenant } from "./middlewares/tenant";
import { errorHandler } from "./middlewares/errorHandler";
import adminRoutes from "./modules/admin/admin.routes";
import authRoutes from "./modules/auth/auth.routes";
import campaignsRoutes from "./modules/campaigns/campaigns.routes";
import channelsRoutes from "./modules/channels/channels.routes";
import chatbotRoutes from "./modules/chatbot/chatbot.routes";
import companyRoutes from "./modules/company/company.routes";
import contactsRoutes from "./modules/contacts/contacts.routes";
import contactsPrivateRoutes from "./modules/contacts/contacts.private.routes";
import conversationsRoutes from "./modules/conversations/conversations.routes";
import crmRoutes from "./modules/crm/crm.routes";
import departmentsRoutes from "./modules/departments/departments.routes";
import messagesRoutes from "./modules/messages/messages.routes";
import quickRepliesRoutes from "./modules/quickreplies/quickreplies.routes";
import reportsRoutes from "./modules/reports/reports.routes";
import usersRoutes from "./modules/users/users.routes";
import webhooksRoutes from "./modules/webhooks/webhooks.routes";

export const app = express();

app.use(helmet());
app.use(cors({ origin: env.corsOrigin, credentials: true }));
app.use(express.json({ limit: "5mb" }));
app.use(morgan("dev"));
app.use(resolveTenant);

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/campaigns", campaignsRoutes);
app.use("/api/channels", channelsRoutes);
app.use("/api/chatbot", chatbotRoutes);
app.use("/api/company", companyRoutes);
app.use("/api/contacts", contactsPrivateRoutes);
app.use("/api/public", contactsRoutes);
app.use("/api/conversations", conversationsRoutes);
app.use("/api/conversations/:conversationId/messages", messagesRoutes);
app.use("/api/crm", crmRoutes);
app.use("/api/departments", departmentsRoutes);
app.use("/api/quick-replies", quickRepliesRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/webhooks", webhooksRoutes);

app.use(errorHandler);

