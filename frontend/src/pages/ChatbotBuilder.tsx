import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import ReactFlow, {
  Background,
  Controls,
  Handle,
  Position,
  addEdge,
  useEdgesState,
  useNodesState,
  Connection,
  Edge,
  Node,
} from "reactflow";
import "reactflow/dist/style.css";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { ChatbotFlow, Department } from "../types";

const NODE_LABELS: Record<string, string> = {
  START: "Início",
  MESSAGE: "Mensagem",
  QUESTION: "Pergunta",
  OPTIONS: "Opções",
  ROUTE_DEPARTMENT: "Encaminhar departamento",
  TRANSFER_HUMAN: "Transferir p/ humano",
};
const NODE_COLORS: Record<string, string> = {
  START: "bg-gray-800 text-white",
  MESSAGE: "bg-blue-50 border-blue-300",
  QUESTION: "bg-purple-50 border-purple-300",
  OPTIONS: "bg-amber-50 border-amber-300",
  ROUTE_DEPARTMENT: "bg-green-50 border-green-300",
  TRANSFER_HUMAN: "bg-red-50 border-red-300",
};

function BaseNode({ id, data, type }: { id: string; data: any; type: string }) {
  return (
    <div className={`rounded-lg border-2 px-3 py-2 text-xs min-w-[160px] ${NODE_COLORS[type] || "bg-white"}`}>
      <p className="font-semibold mb-1">{NODE_LABELS[type] || type}</p>
      {type !== "START" && <Handle type="target" position={Position.Top} />}
      {(type === "MESSAGE" || type === "QUESTION" || type === "ROUTE_DEPARTMENT" || type === "START") && (
        <Handle type="source" position={Position.Bottom} />
      )}
      {type !== "TRANSFER_HUMAN" && type !== "START" && (
        <p className="text-gray-600 truncate">{data.text || data.departmentId || "(clique pra editar)"}</p>
      )}
      {type === "OPTIONS" && (
        <div className="mt-1 space-y-1">
          {(data.options || []).map((o: any, i: number) => (
            <div key={o.id} className="relative bg-white border rounded px-1 py-0.5 pr-4">
              {i + 1}. {o.label}
              <Handle type="source" position={Position.Right} id={o.id} style={{ top: "50%" }} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const nodeTypes = {
  START: (p: any) => <BaseNode {...p} type="START" />,
  MESSAGE: (p: any) => <BaseNode {...p} type="MESSAGE" />,
  QUESTION: (p: any) => <BaseNode {...p} type="QUESTION" />,
  OPTIONS: (p: any) => <BaseNode {...p} type="OPTIONS" />,
  ROUTE_DEPARTMENT: (p: any) => <BaseNode {...p} type="ROUTE_DEPARTMENT" />,
  TRANSFER_HUMAN: (p: any) => <BaseNode {...p} type="TRANSFER_HUMAN" />,
};

let idCounter = 1;
function newId() {
  return `node_${Date.now()}_${idCounter++}`;
}

export function ChatbotBuilder() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [flows, setFlows] = useState<ChatbotFlow[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [activeFlowId, setActiveFlowId] = useState<string | null>(null);
  const [flowName, setFlowName] = useState("");
  const [channels, setChannels] = useState<string[]>(["WEBCHAT"]);
  const [isActive, setIsActive] = useState(false);

  const [nodes, setNodes, onNodesChange] = useNodesState<any>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<any>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user && user.role !== "ADMIN") navigate("/inbox");
  }, [loading, user, navigate]);

  function loadFlows() {
    api.get("/chatbot-flows").then(({ data }) => setFlows(data));
    api.get("/departments").then(({ data }) => setDepartments(data));
  }
  useEffect(loadFlows, []);

  function openFlow(flow: ChatbotFlow) {
    setActiveFlowId(flow.id);
    setFlowName(flow.name);
    setChannels(flow.channels);
    setIsActive(flow.isActive);
    setNodes(flow.nodes.length ? flow.nodes : [{ id: "start", type: "START", data: {}, position: { x: 50, y: 50 } }]);
    setEdges(flow.edges);
    setSelectedNodeId(null);
  }

  function newFlow() {
    setActiveFlowId("__new__");
    setFlowName("Novo fluxo");
    setChannels(["WEBCHAT"]);
    setIsActive(false);
    setNodes([{ id: "start", type: "START", data: {}, position: { x: 50, y: 50 } }]);
    setEdges([]);
    setSelectedNodeId(null);
  }

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, id: `e_${Date.now()}` }, eds)),
    [setEdges]
  );

  function addNode(type: string) {
    const id = newId();
    const data: any = type === "OPTIONS" ? { text: "", options: [{ id: newId(), label: "Opção 1" }] } : {};
    setNodes((nds: Node[]) => [...nds, { id, type, data, position: { x: 250 + Math.random() * 200, y: 50 + nds.length * 90 } }]);
  }

  function updateSelectedData(patch: Record<string, any>) {
    setNodes((nds: Node[]) => nds.map((n) => (n.id === selectedNodeId ? { ...n, data: { ...n.data, ...patch } } : n)));
  }

  function addOption() {
    const node = nodes.find((n) => n.id === selectedNodeId);
    if (!node) return;
    const options = [...(node.data.options || []), { id: newId(), label: `Opção ${(node.data.options || []).length + 1}` }];
    updateSelectedData({ options });
  }
  function removeOption(optId: string) {
    const node = nodes.find((n) => n.id === selectedNodeId);
    if (!node) return;
    updateSelectedData({ options: (node.data.options || []).filter((o: any) => o.id !== optId) });
    setEdges((eds: Edge[]) => eds.filter((e) => e.sourceHandle !== optId));
  }

  async function save() {
    const payload = { name: flowName, channels, isActive, nodes, edges };
    if (activeFlowId === "__new__") {
      const { data } = await api.post("/chatbot-flows", payload);
      setActiveFlowId(data.id);
    } else {
      await api.patch(`/chatbot-flows/${activeFlowId}`, payload);
    }
    loadFlows();
    alert("Fluxo salvo!");
  }

  async function removeFlow(id: string) {
    if (!confirm("Excluir este fluxo?")) return;
    await api.delete(`/chatbot-flows/${id}`);
    if (activeFlowId === id) setActiveFlowId(null);
    loadFlows();
  }

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  if (activeFlowId === null) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-semibold text-gray-800">Chatbot</h1>
            <p className="text-xs text-gray-400">Fluxos automáticos por canal</p>
          </div>
          <Link to="/team" className="text-sm text-blue-600 hover:underline">← Voltar pra equipe</Link>
        </header>
        <main className="p-6 max-w-2xl mx-auto space-y-4">
          <button onClick={newFlow} className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-md">+ Novo fluxo</button>
          <div className="bg-white border rounded-lg">
            {flows.map((f) => (
              <div key={f.id} className="flex items-center justify-between px-4 py-3 border-b last:border-b-0">
                <div>
                  <p className="text-sm font-medium">{f.name} {f.isActive && <span className="text-xs text-green-600">(ativo)</span>}</p>
                  <p className="text-xs text-gray-400">{f.channels.join(", ")}</p>
                </div>
                <div className="flex gap-2 text-xs">
                  <button onClick={() => openFlow(f)} className="text-gray-500 hover:text-gray-800">Editar</button>
                  <button onClick={() => removeFlow(f.id)} className="text-red-500 hover:text-red-700">Excluir</button>
                </div>
              </div>
            ))}
            {flows.length === 0 && <p className="p-4 text-sm text-gray-400">Nenhum fluxo ainda.</p>}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      <header className="bg-white border-b px-4 py-2 flex items-center gap-3 flex-wrap">
        <button onClick={() => setActiveFlowId(null)} className="text-sm text-gray-500">← Fluxos</button>
        <input value={flowName} onChange={(e) => setFlowName(e.target.value)} className="border rounded-md px-2 py-1 text-sm" />
        {["WEBCHAT", "WHATSAPP"].map((c) => (
          <label key={c} className="text-xs flex items-center gap-1">
            <input
              type="checkbox"
              checked={channels.includes(c)}
              onChange={(e) => setChannels((prev) => (e.target.checked ? [...prev, c] : prev.filter((x) => x !== c)))}
            />
            {c}
          </label>
        ))}
        <label className="text-xs flex items-center gap-1">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> Ativo
        </label>
        <div className="ml-auto flex gap-1">
          {Object.keys(NODE_LABELS).filter((t) => t !== "START").map((t) => (
            <button key={t} onClick={() => addNode(t)} className="text-xs border rounded-md px-2 py-1 hover:bg-gray-50">
              + {NODE_LABELS[t]}
            </button>
          ))}
          <button onClick={save} className="text-xs bg-blue-600 text-white rounded-md px-3 py-1">Salvar</button>
        </div>
      </header>

      <div className="flex-1 flex">
        <div className="flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_e, n) => setSelectedNodeId(n.id)}
            nodeTypes={nodeTypes}
            fitView
          >
            <Background />
            <Controls />
          </ReactFlow>
        </div>

        {selectedNode && (
          <aside className="w-72 border-l bg-white p-4 overflow-y-auto">
            <p className="text-sm font-medium mb-3">{NODE_LABELS[selectedNode.type as string]}</p>

            {(selectedNode.type === "MESSAGE" || selectedNode.type === "QUESTION" || selectedNode.type === "OPTIONS") && (
              <textarea
                value={selectedNode.data.text || ""}
                onChange={(e) => updateSelectedData({ text: e.target.value })}
                placeholder="Texto da mensagem"
                rows={3}
                className="w-full border rounded-md px-2 py-1.5 text-sm mb-2"
              />
            )}

            {selectedNode.type === "QUESTION" && (
              <input
                value={selectedNode.data.variableName || ""}
                onChange={(e) => updateSelectedData({ variableName: e.target.value })}
                placeholder="Nome da variável (opcional)"
                className="w-full border rounded-md px-2 py-1.5 text-sm"
              />
            )}

            {selectedNode.type === "OPTIONS" && (
              <div className="space-y-1.5">
                {(selectedNode.data.options || []).map((o: any) => (
                  <div key={o.id} className="flex gap-1">
                    <input
                      value={o.label}
                      onChange={(e) =>
                        updateSelectedData({
                          options: selectedNode.data.options.map((x: any) => (x.id === o.id ? { ...x, label: e.target.value } : x)),
                        })
                      }
                      className="flex-1 border rounded-md px-2 py-1 text-sm"
                    />
                    <button onClick={() => removeOption(o.id)} className="text-red-400 text-xs px-1">×</button>
                  </div>
                ))}
                <button onClick={addOption} className="text-xs text-blue-600">+ Adicionar opção</button>
              </div>
            )}

            {selectedNode.type === "ROUTE_DEPARTMENT" && (
              <select
                value={selectedNode.data.departmentId || ""}
                onChange={(e) => updateSelectedData({ departmentId: e.target.value })}
                className="w-full border rounded-md px-2 py-1.5 text-sm"
              >
                <option value="">Selecione...</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            )}

            {selectedNode.type === "TRANSFER_HUMAN" && (
              <p className="text-xs text-gray-400">Termina o bot e entrega a conversa pra um agente (distribuição automática se aplicar).</p>
            )}

            <p className="text-[11px] text-gray-400 mt-3">
              Conecte arrastando da borda inferior do bloco até o próximo. Em "Opções", arraste a partir de cada opção.
            </p>
          </aside>
        )}
      </div>
    </div>
  );
}
