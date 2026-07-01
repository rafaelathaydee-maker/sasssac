import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

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

async function main() {
  await seedPlans();

  const superAdminPassword = await bcrypt.hash(process.env.SUPER_ADMIN_PASSWORD || "Rafagi123!", 10);
  await prisma.user.upsert({
    where: { email: process.env.SUPER_ADMIN_EMAIL || "rafael.athaydee@gmail.com" },
    update: {},
    create: {
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

  const admin = await prisma.user.upsert({
    where: { email: "admin@acme.com" },
    update: {},
    create: {
      companyId: company.id,
      name: "Admin Acme",
      email: "admin@acme.com",
      passwordHash,
      role: "ADMIN",
    },
  });

  const agent = await prisma.user.upsert({
    where: { email: "agente@acme.com" },
    update: {},
    create: {
      companyId: company.id,
      name: "Maria Atendente",
      email: "agente@acme.com",
      passwordHash,
      role: "AGENT",
    },
  });

  const vendas = await prisma.department.findFirst({ where: { companyId: company.id, name: "Vendas" } });
  if (!vendas) await prisma.department.create({ data: { companyId: company.id, name: "Vendas", keywords: ["comprar", "preço", "orçamento"] } });

  const suporte = await prisma.department.findFirst({ where: { companyId: company.id, name: "Suporte" } });
  if (!suporte) await prisma.department.create({ data: { companyId: company.id, name: "Suporte", keywords: ["erro", "problema", "ajuda"] } });

  console.log("Seed concluído:");
  console.log({ company: company.slug, plano: company.planId, logins: [admin.email, agent.email], password: "123456" });
  console.log("Super admin:", process.env.SUPER_ADMIN_EMAIL || "rafael.athaydee@gmail.com", "/ senha:", process.env.SUPER_ADMIN_PASSWORD || "Rafagi123!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
