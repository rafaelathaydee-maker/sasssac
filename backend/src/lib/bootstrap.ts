import bcrypt from "bcryptjs";
import { logger } from "./logger";
import { prisma } from "./prisma";

async function seedPlans() {
  await prisma.plan.upsert({
    where: { id: "FREE" },
    update: {},
    create: {
      id: "FREE",
      name: "Free",
      priceCents: 0,
      maxAgents: 1,
      maxConversationsPerMonth: 50,
      channels: ["WEBCHAT"],
    },
  });

  await prisma.plan.upsert({
    where: { id: "BASIC" },
    update: {},
    create: {
      id: "BASIC",
      name: "Basic",
      priceCents: 9900,
      maxAgents: 5,
      maxConversationsPerMonth: 500,
      channels: ["WEBCHAT", "WHATSAPP"],
    },
  });

  await prisma.plan.upsert({
    where: { id: "PRO" },
    update: {},
    create: {
      id: "PRO",
      name: "Pro",
      priceCents: 29900,
      maxAgents: 50,
      maxConversationsPerMonth: 5000,
      channels: ["WEBCHAT", "WHATSAPP", "INSTAGRAM"],
    },
  });
}

export async function ensureBootstrapData() {
  await seedPlans();

  const userCount = await prisma.user.count();
  if (userCount > 0) return;

  const superAdminPassword = await bcrypt.hash(process.env.SUPER_ADMIN_PASSWORD || "Rafagi123!", 10);
  await prisma.user.create({
    data: {
      name: "Super Admin",
      email: process.env.SUPER_ADMIN_EMAIL || "rafael.athaydee@gmail.com",
      passwordHash: superAdminPassword,
      role: "SUPER_ADMIN",
      companyId: null,
    },
  });

  const company = await prisma.company.upsert({
    where: { slug: "acme" },
    update: {},
    create: { name: "Acme Atendimento", slug: "acme", planId: "BASIC" },
  });

  const passwordHash = await bcrypt.hash("123456", 10);
  const admin = await prisma.user.create({
    data: {
      companyId: company.id,
      name: "Admin Acme",
      email: "admin@acme.com",
      passwordHash,
      role: "ADMIN",
    },
  });

  const agent = await prisma.user.create({
    data: {
      companyId: company.id,
      name: "Maria Atendente",
      email: "agente@acme.com",
      passwordHash,
      role: "AGENT",
    },
  });

  await prisma.department.createMany({
    data: [
      { companyId: company.id, name: "Vendas", keywords: ["comprar", "preco", "orcamento"] },
      { companyId: company.id, name: "Suporte", keywords: ["erro", "problema", "ajuda"] },
    ],
  });

  logger.info(
    { superAdmin: "rafael.athaydee@gmail.com", company: company.slug, users: [admin.email, agent.email] },
    "Dados iniciais criados",
  );
}
