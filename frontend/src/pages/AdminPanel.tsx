import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

interface CompanyRow {
  id: string;
  name: string;
  slug: string;
  isSuspended: boolean;
  plan: { id: string; name: string };
  agentCount: number;
  conversationCount: number;
  whatsapp: { externalAccountId: string | null; isActive: boolean } | null;
}

export function AdminPanel() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [whatsappCompany, setWhatsappCompany] = useState<CompanyRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastCreated, setLastCreated] = useState<{ email: string } | null>(null);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [planId, setPlanId] = useState("BASIC");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  const [waPhoneId, setWaPhoneId] = useState("");
  const [waToken, setWaToken] = useState("");
  const [waWabaId, setWaWabaId] = useState("");

  useEffect(() => {
    if (!loading && !user) navigate("/login", { replace: true });
    if (!loading && user && user.role !== "SUPER_ADMIN") navigate("/inbox");
  }, [loading, user, navigate]);

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  function load() {
    api.get("/admin/companies").then(({ data }) => setCompanies(data));
  }

  useEffect(load, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post("/admin/companies", { name, slug, planId, adminName, adminEmail, adminPassword });
      setLastCreated({ email: adminEmail });
      setShowForm(false);
      setName("");
      setSlug("");
      setPlanId("BASIC");
      setAdminName("");
      setAdminEmail("");
      setAdminPassword("");
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error?.toString() || "Nao foi possivel criar a empresa");
    }
  }

  async function toggleSuspend(c: CompanyRow) {
    await api.post(`/admin/companies/${c.id}/${c.isSuspended ? "activate" : "suspend"}`);
    load();
  }

  async function handleResetPassword(c: CompanyRow) {
    const detail = await api.get(`/admin/companies/${c.id}`);
    const admin = detail.data.users.find((u: any) => u.role === "ADMIN");
    if (!admin) return alert("Empresa sem admin");
    const { data } = await api.post(`/admin/users/${admin.id}/reset-password`, {});
    alert(`Nova senha temporaria para ${admin.email}: ${data.temporaryPassword}`);
  }

  function openWhatsapp(c: CompanyRow) {
    setWhatsappCompany(c);
    setWaPhoneId(c.whatsapp?.externalAccountId || "");
    setWaToken("");
    setWaWabaId("");
    setError(null);
  }

  async function saveWhatsapp(e: FormEvent) {
    e.preventDefault();
    if (!whatsappCompany) return;
    setError(null);
    try {
      await api.put(`/admin/companies/${whatsappCompany.id}/channels/whatsapp`, {
        phoneNumberId: waPhoneId,
        accessToken: waToken,
        wabaId: waWabaId || undefined,
      });
      setWhatsappCompany(null);
      setWaPhoneId("");
      setWaToken("");
      setWaWabaId("");
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error?.toString() || "Nao foi possivel salvar o WhatsApp");
    }
  }

  async function removeWhatsapp(c: CompanyRow) {
    if (!confirm(`Remover WhatsApp de ${c.name}?`)) return;
    await api.delete(`/admin/companies/${c.id}/channels/whatsapp`);
    load();
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sasssac</p>
            <h1 className="text-lg font-semibold text-slate-950">Painel master</h1>
            <p className="text-xs text-slate-500">{user?.name} - gestao multiempresa</p>
          </div>
          <button onClick={handleLogout} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:border-red-200 hover:bg-red-50 hover:text-red-600">
            Sair
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-5 p-6">
        {lastCreated && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            Empresa criada. O admin entra neste mesmo painel com <strong>{lastCreated.email}</strong> e a senha que voce definiu.
          </div>
        )}

        <section className="grid gap-3 md:grid-cols-3">
          <div className="rounded-md border border-slate-200 bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Empresas</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{companies.length}</p>
          </div>
          <div className="rounded-md border border-slate-200 bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Ativas</p>
            <p className="mt-2 text-2xl font-semibold text-emerald-700">{companies.filter((c) => !c.isSuspended).length}</p>
          </div>
          <div className="rounded-md border border-slate-200 bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">WhatsApp configurado</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{companies.filter((c) => c.whatsapp).length}</p>
          </div>
        </section>

        <div className="rounded-md border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <div>
              <h2 className="font-semibold text-slate-950">Empresas</h2>
              <p className="text-xs text-slate-500">Crie clientes, configure WhatsApp e controle acesso.</p>
            </div>
            <button onClick={() => setShowForm(true)} className="rounded-md bg-slate-950 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800">
              Nova empresa
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="text-left px-4 py-3">Empresa</th>
                  <th className="text-left px-4 py-3">Identificador</th>
                  <th className="text-left px-4 py-3">Plano</th>
                  <th className="text-left px-4 py-3">WhatsApp</th>
                  <th className="text-left px-4 py-3">Agentes</th>
                  <th className="text-left px-4 py-3">Conversas</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Acoes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {companies.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-medium text-slate-900">{c.name}</td>
                    <td className="px-4 py-3 text-slate-500">{c.slug}</td>
                    <td className="px-4 py-3">{c.plan.name}</td>
                    <td className="px-4 py-3">
                      {c.whatsapp ? (
                        <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">{c.whatsapp.externalAccountId || "Configurado"}</span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-500">Nao configurado</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{c.agentCount}</td>
                    <td className="px-4 py-3">{c.conversationCount}</td>
                    <td className="px-4 py-3">
                      {c.isSuspended ? <span className="rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700">Suspensa</span> : <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">Ativa</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => openWhatsapp(c)} className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100">
                          WhatsApp
                        </button>
                        <button onClick={() => handleResetPassword(c)} className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100">
                          Reset senha
                        </button>
                        <button onClick={() => toggleSuspend(c)} className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100">
                          {c.isSuspended ? "Reativar" : "Suspender"}
                        </button>
                        {c.whatsapp && (
                          <button onClick={() => removeWhatsapp(c)} className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50">
                            Remover Whats
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {showForm && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/40 p-4">
          <form onSubmit={handleCreate} className="w-full max-w-md space-y-3 rounded-md bg-white p-6 shadow-xl">
            <h2 className="font-semibold text-slate-950">Nova empresa</h2>
            <input placeholder="Nome da empresa" value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" required />
            <input placeholder="Identificador interno (opcional)" value={slug} onChange={(e) => setSlug(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            <select value={planId} onChange={(e) => setPlanId(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value="FREE">Free</option>
              <option value="BASIC">Basic</option>
              <option value="PRO">Pro</option>
            </select>
            <hr className="border-slate-200" />
            <p className="text-xs text-slate-500">Primeiro usuario da empresa</p>
            <input placeholder="Nome do admin" value={adminName} onChange={(e) => setAdminName(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" required />
            <input type="email" placeholder="E-mail do admin" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" required />
            <input type="password" placeholder="Senha provisoria" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" required />
            {error && <p className="text-xs text-red-500">{error}</p>}
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setShowForm(false)} className="flex-1 rounded-md border border-slate-300 py-2 text-sm font-medium">Cancelar</button>
              <button type="submit" className="flex-1 rounded-md bg-slate-950 py-2 text-sm font-medium text-white">Criar</button>
            </div>
          </form>
        </div>
      )}

      {whatsappCompany && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/40 p-4">
          <form onSubmit={saveWhatsapp} className="w-full max-w-md space-y-3 rounded-md bg-white p-6 shadow-xl">
            <h2 className="font-semibold text-slate-950">WhatsApp de {whatsappCompany.name}</h2>
            <p className="text-xs text-slate-500">
              Configure aqui se voce tiver a API da Meta. Se preferir, deixe para o admin da empresa configurar no painel dele.
            </p>
            <input placeholder="Phone Number ID" value={waPhoneId} onChange={(e) => setWaPhoneId(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" required />
            <input placeholder="Access Token" value={waToken} onChange={(e) => setWaToken(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" required />
            <input placeholder="WABA ID (opcional)" value={waWabaId} onChange={(e) => setWaWabaId(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            {error && <p className="text-xs text-red-500">{error}</p>}
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setWhatsappCompany(null)} className="flex-1 rounded-md border border-slate-300 py-2 text-sm font-medium">Cancelar</button>
              <button type="submit" className="flex-1 rounded-md bg-slate-950 py-2 text-sm font-medium text-white">Salvar WhatsApp</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
