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
    if (!loading && user && user.role !== "SUPER_ADMIN") navigate("/inbox");
  }, [loading, user, navigate]);

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
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="font-semibold text-gray-800">Painel master</h1>
          <p className="text-xs text-gray-400">{user?.name} - painel unico multiempresa</p>
        </div>
        <button onClick={logout} className="text-sm text-gray-400 hover:text-red-500">
          Sair
        </button>
      </header>

      <main className="p-6 max-w-5xl mx-auto space-y-4">
        {lastCreated && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
            Empresa criada. O admin entra neste mesmo painel com <strong>{lastCreated.email}</strong> e a senha que voce definiu.
          </div>
        )}

        <div className="flex items-center justify-between">
          <h2 className="font-medium text-gray-700">Empresas ({companies.length})</h2>
          <button onClick={() => setShowForm(true)} className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700">
            + Nova empresa
          </button>
        </div>

        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs">
              <tr>
                <th className="text-left px-4 py-2">Empresa</th>
                <th className="text-left px-4 py-2">Identificador</th>
                <th className="text-left px-4 py-2">Plano</th>
                <th className="text-left px-4 py-2">WhatsApp</th>
                <th className="text-left px-4 py-2">Agentes</th>
                <th className="text-left px-4 py-2">Conversas</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-left px-4 py-2">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="px-4 py-2">{c.name}</td>
                  <td className="px-4 py-2 text-gray-400">{c.slug}</td>
                  <td className="px-4 py-2">{c.plan.name}</td>
                  <td className="px-4 py-2">
                    {c.whatsapp ? (
                      <span className="text-xs text-green-600">{c.whatsapp.externalAccountId || "Configurado"}</span>
                    ) : (
                      <span className="text-xs text-gray-400">Nao configurado</span>
                    )}
                  </td>
                  <td className="px-4 py-2">{c.agentCount}</td>
                  <td className="px-4 py-2">{c.conversationCount}</td>
                  <td className="px-4 py-2">
                    {c.isSuspended ? <span className="text-xs text-red-600">Suspensa</span> : <span className="text-xs text-green-600">Ativa</span>}
                  </td>
                  <td className="px-4 py-2 flex flex-wrap gap-2">
                    <button onClick={() => toggleSuspend(c)} className="text-xs text-gray-500 hover:text-gray-800">
                      {c.isSuspended ? "Reativar" : "Suspender"}
                    </button>
                    <button onClick={() => handleResetPassword(c)} className="text-xs text-gray-500 hover:text-gray-800">
                      Reset senha
                    </button>
                    <button onClick={() => openWhatsapp(c)} className="text-xs text-blue-600 hover:text-blue-800">
                      WhatsApp
                    </button>
                    {c.whatsapp && (
                      <button onClick={() => removeWhatsapp(c)} className="text-xs text-red-500 hover:text-red-700">
                        Remover Whats
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      {showForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center">
          <form onSubmit={handleCreate} className="bg-white rounded-lg p-6 w-full max-w-md space-y-3">
            <h2 className="font-semibold text-gray-800">Nova empresa</h2>
            <input placeholder="Nome da empresa" value={name} onChange={(e) => setName(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" required />
            <input placeholder="Identificador interno (opcional)" value={slug} onChange={(e) => setSlug(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" />
            <select value={planId} onChange={(e) => setPlanId(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm">
              <option value="FREE">Free</option>
              <option value="BASIC">Basic</option>
              <option value="PRO">Pro</option>
            </select>
            <hr />
            <p className="text-xs text-gray-400">Primeiro usuario da empresa</p>
            <input placeholder="Nome do admin" value={adminName} onChange={(e) => setAdminName(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" required />
            <input type="email" placeholder="E-mail do admin" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" required />
            <input type="password" placeholder="Senha provisoria" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" required />
            {error && <p className="text-xs text-red-500">{error}</p>}
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setShowForm(false)} className="flex-1 border rounded-md py-2 text-sm">Cancelar</button>
              <button type="submit" className="flex-1 bg-blue-600 text-white rounded-md py-2 text-sm">Criar</button>
            </div>
          </form>
        </div>
      )}

      {whatsappCompany && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center">
          <form onSubmit={saveWhatsapp} className="bg-white rounded-lg p-6 w-full max-w-md space-y-3">
            <h2 className="font-semibold text-gray-800">WhatsApp de {whatsappCompany.name}</h2>
            <p className="text-xs text-gray-400">
              Configure aqui se voce tiver a API da Meta. Se preferir, deixe para o admin da empresa configurar no painel dele.
            </p>
            <input placeholder="Phone Number ID" value={waPhoneId} onChange={(e) => setWaPhoneId(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" required />
            <input placeholder="Access Token" value={waToken} onChange={(e) => setWaToken(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" required />
            <input placeholder="WABA ID (opcional)" value={waWabaId} onChange={(e) => setWaWabaId(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" />
            {error && <p className="text-xs text-red-500">{error}</p>}
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setWhatsappCompany(null)} className="flex-1 border rounded-md py-2 text-sm">Cancelar</button>
              <button type="submit" className="flex-1 bg-blue-600 text-white rounded-md py-2 text-sm">Salvar WhatsApp</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
