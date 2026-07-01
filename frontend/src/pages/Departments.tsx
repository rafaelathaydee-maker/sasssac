import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Agent, Department } from "../types";

export function Departments() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [managingId, setManagingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [keywords, setKeywords] = useState("");

  useEffect(() => {
    if (!loading && user && user.role !== "ADMIN") navigate("/inbox");
  }, [loading, user, navigate]);

  function load() {
    api.get("/departments").then(({ data }) => setDepartments(data));
    api.get("/users").then(({ data }) => setAgents(data));
  }
  useEffect(load, []);

  function openCreate() {
    setEditing(null);
    setName("");
    setDescription("");
    setKeywords("");
    setError(null);
    setShowForm(true);
  }
  function openEdit(d: Department) {
    setEditing(d);
    setName(d.name);
    setDescription(d.description || "");
    setKeywords((d.keywords || []).join(", "));
    setError(null);
    setShowForm(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const payload = {
      name,
      description: description || undefined,
      keywords: keywords ? keywords.split(",").map((k) => k.trim()).filter(Boolean) : [],
    };
    try {
      if (editing) await api.patch(`/departments/${editing.id}`, payload);
      else await api.post("/departments", payload);
      setShowForm(false);
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error?.toString() || "Não foi possível salvar");
    }
  }

  async function toggleActive(d: Department) {
    await api.patch(`/departments/${d.id}`, { active: !d.active });
    load();
  }

  async function handleDelete(d: Department) {
    if (!confirm(`Excluir "${d.name}"? Conversas desse departamento ficam sem departamento.`)) return;
    await api.delete(`/departments/${d.id}`);
    load();
  }

  async function toggleAgent(deptId: string, agentId: string, has: boolean) {
    if (has) await api.delete(`/departments/${deptId}/agents/${agentId}`);
    else await api.post(`/departments/${deptId}/agents/${agentId}`);
    load();
  }

  const managing = departments.find((d) => d.id === managingId) || null;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="font-semibold text-gray-800">Departamentos</h1>
          <p className="text-xs text-gray-400">Filas de atendimento</p>
        </div>
        <Link to="/team" className="text-sm text-blue-600 hover:underline">← Voltar pra equipe</Link>
      </header>

      <main className="p-6 max-w-3xl mx-auto space-y-4">
        <div className="flex justify-end">
          <button onClick={openCreate} className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700">
            + Novo departamento
          </button>
        </div>

        <div className="bg-white border rounded-lg">
          {departments.map((d) => (
            <div key={d.id} className="px-4 py-3 border-b last:border-b-0">
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm font-medium ${d.active ? "text-gray-800" : "text-gray-400 line-through"}`}>{d.name}</p>
                  {d.description && <p className="text-xs text-gray-400">{d.description}</p>}
                  {d.keywords?.length > 0 && <p className="text-xs text-blue-400">Palavras-chave: {d.keywords.join(", ")}</p>}
                  <p className="text-xs text-gray-400 mt-1">{d.agents.length} agente(s)</p>
                </div>
                <div className="flex gap-2 text-xs">
                  <button onClick={() => setManagingId(managingId === d.id ? null : d.id)} className="text-gray-500 hover:text-gray-800">
                    Agentes
                  </button>
                  <button onClick={() => openEdit(d)} className="text-gray-500 hover:text-gray-800">Editar</button>
                  <button onClick={() => toggleActive(d)} className="text-gray-500 hover:text-gray-800">
                    {d.active ? "Desativar" : "Ativar"}
                  </button>
                  <button onClick={() => handleDelete(d)} className="text-red-500 hover:text-red-700">Excluir</button>
                </div>
              </div>

              {managing?.id === d.id && (
                <div className="mt-3 bg-gray-50 rounded-md p-3">
                  <p className="text-xs text-gray-500 mb-2">Agentes deste departamento</p>
                  <div className="flex flex-wrap gap-2">
                    {agents.map((a) => {
                      const has = d.agents.some((ag) => ag.id === a.id);
                      return (
                        <button
                          key={a.id}
                          onClick={() => toggleAgent(d.id, a.id, has)}
                          className={`text-xs px-2 py-1 rounded-full border ${
                            has ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600"
                          }`}
                        >
                          {a.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
          {departments.length === 0 && <p className="p-4 text-sm text-gray-400">Nenhum departamento ainda.</p>}
        </div>
      </main>

      {showForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center">
          <form onSubmit={handleSubmit} className="bg-white rounded-lg p-6 w-full max-w-sm space-y-3">
            <h2 className="font-semibold text-gray-800">{editing ? "Editar departamento" : "Novo departamento"}</h2>
            <input placeholder="Nome (ex: Vendas)" value={name} onChange={(e) => setName(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" required />
            <input placeholder="Descrição (opcional)" value={description} onChange={(e) => setDescription(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" />
            <input placeholder="Palavras-chave (separadas por vírgula)" value={keywords} onChange={(e) => setKeywords(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" />
            {error && <p className="text-xs text-red-500">{error}</p>}
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setShowForm(false)} className="flex-1 border rounded-md py-2 text-sm">Cancelar</button>
              <button type="submit" className="flex-1 bg-blue-600 text-white rounded-md py-2 text-sm">Salvar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
