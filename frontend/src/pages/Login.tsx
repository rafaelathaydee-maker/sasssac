import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getTenantSlugFromHost, isPlainDevHost, setDevCompanySlug } from "../lib/tenant";

export function Login() {
  const [error, setError] = useState<string | null>(null);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [devSlug, setDevSlug] = useState(getTenantSlugFromHost() || "");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoadingSubmit(true);
    try {
      if (isPlainDevHost() && devSlug) setDevCompanySlug(devSlug);
      await login(email, password);
      const role = await api_meRole();
      navigate(role === "SUPER_ADMIN" ? "/admin" : "/inbox");
    } catch (err: any) {
      setError(err?.response?.data?.error?.toString() || "Algo deu errado");
    } finally {
      setLoadingSubmit(false);
    }
  }

  // pequeno helper local só pra pegar o role recém-logado sem duplicar estado no contexto
  async function api_meRole(): Promise<string> {
    const token = localStorage.getItem("token");
    if (!token) return "";
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.role;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white shadow-md rounded-xl p-8 w-full max-w-sm">
        <h1 className="text-xl font-semibold mb-1 text-gray-800">Entrar</h1>
        <p className="text-sm text-gray-500 mb-6">Acesse sua caixa de atendimento</p>

        {isPlainDevHost() && (
          <div className="mb-4 p-2 bg-yellow-50 border border-yellow-200 rounded-md">
            <label className="text-[11px] text-yellow-700 font-medium">
              Dev: slug da empresa (sem subdomínio real)
            </label>
            <input
              value={devSlug}
              onChange={(e) => setDevSlug(e.target.value)}
              placeholder="ex: acme (vazio = domínio raiz / super admin)"
              className="w-full border rounded-md px-2 py-1 text-xs mt-1"
            />
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
            required
          />
          <input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
            required
          />

          {error && <p className="text-xs text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={loadingSubmit}
            className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50"
          >
            {loadingSubmit ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
