type DepartmentLike = { id: string; keywords?: string[] | null };

export function matchDepartmentByKeywords(message: string, departments: DepartmentLike[]) {
  const text = message.toLowerCase();
  return departments.find((department) =>
    (department.keywords || []).some((keyword) => text.includes(keyword.toLowerCase())),
  ) || null;
}

