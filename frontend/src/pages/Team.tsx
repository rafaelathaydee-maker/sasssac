import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Agent, ChannelConfigInfo, CompanySettings, Department, PlanUsage, QuickReply } from "../types";

export function Team() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [usage, setUsage] = useState<PlanUsage | null>(null);
  const [channels, setChannels] = useState<ChannelConfigInfo[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [newDeptName, setNewDeptName] = useState("");
  const [newDeptDesc, setNewDeptDesc] = useState("");
  const [newDeptKeywords, setNewDeptKeywords] = useState("");
  const [editingDepts, setEditingDepts] = useState<string[]>([]);
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [qrTitle, setQrTitle] = useState("");
  const [qrShortcut, setQrShortcut] = useState("");
  const [qrMessage, setQrMessage] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showWhatsapp, setShowWhatsapp] = useState(false);
  const [waQrStatus, setWaQrStatus] = useState<{ status: string; qrDataUrl: string | null; jid: string | null; lastError?: string | null } | null>(null);
  const [waPhoneId, setWaPhoneId] = useState("");
  const [waToken, setWaToken] = useState("");
  const [editing, setEditing] = useState<Agent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#2563eb");
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [offlineMessage, setOfflineMessage] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"ADMIN" | "AGENT">("AGENT");

  useEffect(() => {
    if (!loading && !user) navigate("/login", { replace: true });
    if (!loading && user && user.role !== "ADMIN") navigate("/inbox");
  }, [loading, user, navigate]);

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  function load() {
    api.get("/users").then(({ data }) => setAgents(data));
    api.get("/company").then(({ data }) => {
      setSettings(data);
      setLogoUrl(data.logoUrl || "");
      setPrimaryColor(data.primaryColor || "#2563eb");
      setWelcomeMessage(data.welcomeMessage || "");
      setOfflineMessage(data.offlineMessage || "");
    });
    api.get("/company/usage").then(({ data }) => setUsage(data));
    api.get("/channels").then(({ data }) => setChannels(data));
    api.get("/channels/whatsapp/qr").then(({ data }) => setWaQrStatus(data)).catch(() => undefined);
    api.get("/departments").then(({ data }) => setDepartments(data));
    api.get("/quick-replies").then(({ data }) => setQuickReplies(data));
  }
  useEffect(load, []);

  async function createQuickReply(e: FormEvent) {
    e.preventDefault();
    try {
      await api.post("/quick-replies", { title: qrTitle, shortcut: qrShortcut, message: qrMessage });
      setQrTitle(""); setQrShortcut(""); setQrMessage("");
      load();
    } catch (err: any) {
      alert(err?.response?.data?.error?.toString() || "Não foi possível criar");
    }
  }
  async function deleteQuickReply(id: string) {
    await api.delete(`/quick-replies/${id}`);
    load();
  }

  async function createDepartment(e: FormEvent) {
    e.preventDefault();
    if (!newDeptName.trim()) return;
    await api.post("/departments", {
      name: newDeptName,
      description: newDeptDesc || undefined,
      keywords: newDeptKeywords ? newDeptKeywords.split(",").map((k) => k.trim()).filter(Boolean) : [],
    });
    setNewDeptName("");
    setNewDeptDesc("");
    setNewDeptKeywords("");
    load();
  }
  async function toggleDeptActive(d: Department) {
    await api.patch(`/departments/${d.id}`, { active: !d.active });
    load();
  }

  async function saveBranding(e: FormEvent) {
    e.preventDefault();
    await api.patch("/company/branding", { logoUrl: logoUrl || null, primaryColor, welcomeMessage, offlineMessage });
    alert("Personalização salva!");
  }

  async function saveWhatsapp(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.put("/channels/whatsapp", { phoneNumberId: waPhoneId, accessToken: waToken });
      setShowWhatsapp(false);
      setWaPhoneId("");
      setWaToken("");
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error?.toString() || "Não foi possível salvar o WhatsApp");
    }
  }
  async function connectWhatsappQr() {
    setError(null);
    setShowWhatsapp(true);
    try {
      const { data } = await api.post("/channels/whatsapp/qr", {});
      setWaQrStatus(data);
    } catch (err: any) {
      setError(err?.response?.data?.error?.toString() || "Nao foi possivel iniciar o QR Code");
    }
  }
  useEffect(() => {
    if (!showWhatsapp) return;
    const timer = setInterval(async () => {
      try {
        const { data } = await api.get("/channels/whatsapp/qr");
        setWaQrStatus(data);
        if (data.status === "connected") load();
      } catch (err: any) {
        setError(err?.response?.data?.error?.toString() || "Nao foi possivel consultar o WhatsApp");
      }
    }, 2500);
    return () => clearInterval(timer);
  }, [showWhatsapp]);
  async function removeWhatsapp() {
    if (!confirm("Remover a configuração do WhatsApp?")) return;
    await api.delete("/channels/whatsapp");
    load();
  }
  async function changePlan(planId: string) {
    await api.patch("/company/plan", { planId });
    load();
  }

  function openCreate() {
    setEditing(null);
    setName("");
    setEmail("");
    setPassword("");
    setRole("AGENT");
    setEditingDepts([]);
    setError(null);
    setShowForm(true);
  }

  function openEdit(agent: Agent) {
    setEditing(agent);
    setName(agent.name);
    setEmail(agent.email);
    setPassword("");
    setRole(agent.role as "ADMIN" | "AGENT");
    setEditingDepts((agent.departments || []).map((d) => d.id));
    setError(null);
    setShowForm(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      if (editing) {
        await api.patch(`/users/${editing.id}`, { name, email, role, departmentIds: editingDepts, ...(password ? { password } : {}) });
      } else {
        await api.post("/users", { name, email, password, role });
      }
      setShowForm(false);
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error?.toString() || "Não foi possível salvar");
    }
  }

  async function toggleActive(agent: Agent) {
    await api.patch(`/users/${agent.id}`, { isActive: !agent.isActive });
    load();
  }

  async function handleDelete(agent: Agent) {
    if (!confirm(`Remover ${agent.name}? Essa ação não pode ser desfeita.`)) return;
    try {
      await api.delete(`/users/${agent.id}`);
      load();
    } catch (err: any) {
      alert(err?.response?.data?.error?.toString() || "Não foi possível remover esse agente");
    }
  }

  async function toggleDistribution() {
    if (!settings) return;
    const { data } = await api.patch("/company", { autoDistributionEnabled: !settings.autoDistributionEnabled });
    setSettings(data);
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-slate-200 bg-white/95 px-6 py-4 backdrop-blur">
        <div>
          <h1 className="font-semibold text-gray-800">Gestão de equipe</h1>
          <p className="text-xs text-gray-400">{settings?.name}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/inbox" className="rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
            Inbox
          </Link>
          <button onClick={handleLogout} className="rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600">
            Sair
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-5 p-6">
        {usage && (
          <div className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-gray-700">
                Plano: <span className="text-blue-600">{usage.plan.name}</span>
              </p>
              <select
                value={usage.plan.id}
                onChange={(e) => changePlan(e.target.value)}
                className="text-xs border rounded-md px-2 py-1"
              >
                <option value="FREE">Free</option>
                <option value="BASIC">Basic</option>
                <option value="PRO">Pro</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs text-gray-500">
              <div>
                Agentes: {usage.usage.agents.used}/{usage.usage.agents.limit}
                <div className="h-1.5 bg-gray-100 rounded-full mt-1">
                  <div
                    className="h-1.5 bg-blue-500 rounded-full"
                    style={{ width: `${Math.min(100, (usage.usage.agents.used / usage.usage.agents.limit) * 100)}%` }}
                  />
                </div>
              </div>
              <div>
                Conversas no mês: {usage.usage.conversationsThisMonth.used}/{usage.usage.conversationsThisMonth.limit}
                <div className="h-1.5 bg-gray-100 rounded-full mt-1">
                  <div
                    className="h-1.5 bg-blue-500 rounded-full"
                    style={{
                      width: `${Math.min(100, (usage.usage.conversationsThisMonth.used / usage.usage.conversationsThisMonth.limit) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            </div>
            <p className="text-[11px] text-gray-400 mt-3">Canais inclusos: {usage.plan.channels.join(", ")}</p>
          </div>
        )}

        <div className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-700 mb-3">Personalização do widget (white-label)</p>
          <form onSubmit={saveBranding} className="space-y-2">
            <input placeholder="URL do logo" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} className="w-full border rounded-md px-3 py-1.5 text-sm" />
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">Cor principal</label>
              <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="w-10 h-7" />
            </div>
            <textarea placeholder="Mensagem de boas-vindas" value={welcomeMessage} onChange={(e) => setWelcomeMessage(e.target.value)} className="w-full border rounded-md px-3 py-1.5 text-sm" rows={2} />
            <textarea placeholder="Mensagem fora do horário" value={offlineMessage} onChange={(e) => setOfflineMessage(e.target.value)} className="w-full border rounded-md px-3 py-1.5 text-sm" rows={2} />
            <button type="submit" className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-md">Salvar personalização</button>
          </form>
        </div>

        <div className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <p className="text-sm font-semibold text-slate-900">Canais conectados</p>
            <p className="mt-1 text-xs text-slate-500">Conecte os canais que chegam na caixa de atendimento da empresa.</p>
          </div>
          <div className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-3 text-sm">
            <span>Webchat</span>
            <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">Sempre ativo</span>
          </div>
          <div className="mt-3 flex items-center justify-between rounded-md border border-slate-200 px-3 py-3 text-sm">
            <div>
              <span>WhatsApp</span>
              {channels.find((c) => c.channel === "WHATSAPP") && (
                <span className="text-xs text-gray-400 ml-2">
                  número {channels.find((c) => c.channel === "WHATSAPP")?.externalAccountId}
                </span>
              )}
            </div>
            {channels.find((c) => c.channel === "WHATSAPP") ? (
              <button onClick={removeWhatsapp} className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50">
                Remover
              </button>
            ) : (
              <button onClick={connectWhatsappQr} className="rounded-md bg-slate-950 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800">
                Conectar WhatsApp
              </button>
            )}
          </div>
        </div>

        {settings && (
          <div className="flex items-center justify-between rounded-md border border-slate-200 bg-white p-5 shadow-sm">
            <div>
              <p className="text-sm font-medium text-gray-700">Distribuição automática de conversas</p>
              <p className="text-xs text-gray-400">
                Conversas novas são atribuídas em round-robin entre os agentes online
              </p>
            </div>
            <button
              onClick={toggleDistribution}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                settings.autoDistributionEnabled ? "bg-blue-600" : "bg-gray-300"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                  settings.autoDistributionEnabled ? "translate-x-5" : ""
                }`}
              />
            </button>
          </div>
        )}

        <div className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-gray-700">Departamentos</p>
            <Link to="/departments" className="text-xs text-blue-600 hover:underline">Gerenciar →</Link>
          </div>
          <ul className="space-y-1 mb-3">
            {departments.map((d) => (
              <li key={d.id} className="flex items-center justify-between text-sm py-1">
                <span className={d.active ? "" : "text-gray-400 line-through"}>
                  {d.name} <span className="text-xs text-gray-400">({d.agents.length} agente(s))</span>
                  {d.description && <span className="block text-xs text-gray-400">{d.description}</span>}
                  {d.keywords?.length > 0 && (
                    <span className="block text-xs text-blue-400">Palavras-chave: {d.keywords.join(", ")}</span>
                  )}
                </span>
                <button onClick={() => toggleDeptActive(d)} className="text-xs text-gray-500 hover:text-gray-800">
                  {d.active ? "Desativar" : "Ativar"}
                </button>
              </li>
            ))}
          </ul>
          <form onSubmit={createDepartment} className="grid gap-2 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_auto]">
            <input placeholder="Novo departamento (ex: Vendas)" value={newDeptName} onChange={(e) => setNewDeptName(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
            <input placeholder="Descrição (opcional)" value={newDeptDesc} onChange={(e) => setNewDeptDesc(e.target.value)} className="flex-1 border rounded-md px-3 py-1.5 text-sm" />
            <input placeholder="Palavras-chave (vírgula)" value={newDeptKeywords} onChange={(e) => setNewDeptKeywords(e.target.value)} className="flex-1 border rounded-md px-3 py-1.5 text-sm" />
            <button type="submit" className="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white">Criar</button>
          </form>
        </div>

        <div className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-700 mb-3">Respostas rápidas</p>
          <ul className="space-y-1 mb-3">
            {quickReplies.map((q) => (
              <li key={q.id} className="flex items-center justify-between text-sm py-1">
                <span><code className="text-blue-600">/{q.shortcut}</code> — {q.title}</span>
                <button onClick={() => deleteQuickReply(q.id)} className="text-xs text-red-500 hover:text-red-700">Remover</button>
              </li>
            ))}
          </ul>
          <form onSubmit={createQuickReply} className="grid grid-cols-2 gap-2">
            <input placeholder="Título" value={qrTitle} onChange={(e) => setQrTitle(e.target.value)} className="border rounded-md px-3 py-1.5 text-sm" required />
            <input placeholder="Atalho (ex: boleto)" value={qrShortcut} onChange={(e) => setQrShortcut(e.target.value)} className="border rounded-md px-3 py-1.5 text-sm" required />
            <textarea placeholder="Mensagem" value={qrMessage} onChange={(e) => setQrMessage(e.target.value)} className="col-span-2 border rounded-md px-3 py-1.5 text-sm" rows={2} required />
            <button type="submit" className="col-span-2 text-xs bg-blue-600 text-white px-3 py-1.5 rounded-md">Criar</button>
          </form>
        </div>

        <div className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <p className="font-medium text-sm text-gray-700">Agentes</p>
            <button onClick={openCreate} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700">
              + Novo agente
            </button>
          </div>
          <ul>
            {agents.map((a) => (
              <li key={a.id} className="flex items-center justify-between px-4 py-3 border-b last:border-b-0">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${a.isOnline ? "bg-green-500" : "bg-gray-300"}`} />
                  <div>
                    <p className={`text-sm ${a.isActive ? "text-gray-800" : "text-gray-400 line-through"}`}>
                      {a.name} <span className="text-[10px] text-gray-400 font-normal">({a.role})</span>
                    </p>
                    <p className="text-xs text-gray-400">{a.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => openEdit(a)} className="text-xs text-gray-500 hover:text-gray-800">
                    Editar
                  </button>
                  <button onClick={() => toggleActive(a)} className="text-xs text-gray-500 hover:text-gray-800">
                    {a.isActive ? "Desativar" : "Ativar"}
                  </button>
                  <button onClick={() => handleDelete(a)} className="text-xs text-red-500 hover:text-red-700">
                    Remover
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </main>

      {showForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center">
          <form onSubmit={handleSubmit} className="bg-white rounded-lg p-6 w-full max-w-sm space-y-3">
            <h2 className="font-semibold text-gray-800">{editing ? "Editar agente" : "Novo agente"}</h2>
            <input
              placeholder="Nome"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm"
              required
            />
            <input
              type="email"
              placeholder="E-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm"
              required
            />
            <input
              type="password"
              placeholder={editing ? "Nova senha (opcional)" : "Senha"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm"
              required={!editing}
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "ADMIN" | "AGENT")}
              className="w-full border rounded-md px-3 py-2 text-sm"
            >
              <option value="AGENT">Agente</option>
              <option value="ADMIN">Administrador</option>
            </select>
            {departments.length > 0 && (
              <div>
                <p className="text-xs text-gray-400 mb-1">Departamentos</p>
                <div className="flex flex-wrap gap-2">
                  {departments.map((d) => (
                    <label key={d.id} className="flex items-center gap-1 text-xs">
                      <input
                        type="checkbox"
                        checked={editingDepts.includes(d.id)}
                        onChange={(e) =>
                          setEditingDepts((prev) => (e.target.checked ? [...prev, d.id] : prev.filter((id) => id !== d.id)))
                        }
                      />
                      {d.name}
                    </label>
                  ))}
                </div>
              </div>
            )}
            {error && <p className="text-xs text-red-500">{error}</p>}
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setShowForm(false)} className="flex-1 border rounded-md py-2 text-sm">
                Fechar
              </button>
              <button type="submit" className="flex-1 bg-blue-600 text-white rounded-md py-2 text-sm">
                Salvar
              </button>
            </div>
          </form>
        </div>
      )}

      {showWhatsapp && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-md space-y-4 rounded-md bg-white p-6 shadow-xl">
            <h2 className="font-semibold text-slate-950">Conectar WhatsApp</h2>
            <div className="flex min-h-[260px] items-center justify-center rounded-md border border-slate-200 bg-slate-50 p-4">
              {waQrStatus?.status === "connected" ? (
                <div className="text-center">
                  <p className="text-sm font-semibold text-emerald-700">WhatsApp conectado</p>
                  <p className="mt-1 text-xs text-slate-500">{waQrStatus.jid}</p>
                </div>
              ) : waQrStatus?.qrDataUrl ? (
                <img src={waQrStatus.qrDataUrl} alt="QR Code do WhatsApp" className="h-56 w-56 rounded-md bg-white p-2 shadow-sm" />
              ) : waQrStatus?.status === "disconnected" ? (
                <div className="text-center">
                  <p className="text-sm font-semibold text-red-700">WhatsApp nao conectou</p>
                  <p className="mt-1 text-xs text-slate-500">{waQrStatus.lastError || "Clique em Novo QR e tente escanear de novo."}</p>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-sm text-slate-500">Gerando QR Code...</p>
                  <p className="mt-1 text-xs text-slate-400">Se demorar mais de alguns segundos, clique em Novo QR.</p>
                </div>
              )}
            </div>
            <p className="hidden text-xs text-gray-400">Dados da conexao antiga</p>
            <input
              placeholder="Phone Number ID"
              value={waPhoneId}
              onChange={(e) => setWaPhoneId(e.target.value)}
              className="hidden w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              placeholder="Access Token"
              value={waToken}
              onChange={(e) => setWaToken(e.target.value)}
              className="hidden w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            {error && <p className="text-xs text-red-500">{error}</p>}
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setShowWhatsapp(false)} className="flex-1 rounded-md border border-slate-300 py-2 text-sm font-medium">
                Fechar
              </button>
              <button type="button" onClick={connectWhatsappQr} className="flex-1 rounded-md bg-slate-950 py-2 text-sm font-medium text-white">
                Novo QR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

