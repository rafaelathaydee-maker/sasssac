// Em produção, o slug vem do subdomínio (empresa.saaschat.com -> "empresa").
// Em dev sem subdomínio real (ex: localhost puro), usa um valor salvo manualmente —
// só pra conseguir testar multi-tenant sem precisar de DNS/wildcard configurado.
export function getTenantSlugFromHost(): string | null {
  const host = window.location.hostname;

  if (host.endsWith(".onrender.com")) {
    return localStorage.getItem("devCompanySlug");
  }

  if (host === "localhost" || host === "127.0.0.1" || /^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    return localStorage.getItem("devCompanySlug");
  }

  const parts = host.split(".");
  if (parts.length >= 2) return parts[0]; // empresa.saaschat.com ou empresa.localhost
  return null;
}

export function isPlainDevHost(): boolean {
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1" || host.endsWith(".onrender.com");
}

export function setDevCompanySlug(slug: string) {
  localStorage.setItem("devCompanySlug", slug);
}
