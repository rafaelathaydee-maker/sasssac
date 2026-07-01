import { prisma } from "./prisma";

export async function matchDepartmentByKeywords(companyId: string, message: string): Promise<string | null> {
  const departments = await prisma.department.findMany({
    where: { companyId, active: true },
    select: { id: true, keywords: true },
  });
  const text = message.toLowerCase();
  const match = departments.find((department) =>
    (department.keywords || []).some((keyword) => text.includes(keyword.toLowerCase())),
  );
  return match?.id || null;
}
