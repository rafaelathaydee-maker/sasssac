import { Navigate, Route, BrowserRouter, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { Login } from "./pages/Login";
import { Inbox } from "./pages/Inbox";
import { Team } from "./pages/Team";
import { Departments } from "./pages/Departments";
import { ChatbotBuilder } from "./pages/ChatbotBuilder";
import { Campaigns } from "./pages/Campaigns";
import { CrmPipeline } from "./pages/CrmPipeline";
import { Reports } from "./pages/Reports";
import { Audit } from "./pages/Audit";
import { AdminPanel } from "./pages/AdminPanel";
import { WebchatWidget } from "./pages/WebchatWidget";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/inbox" element={<Inbox />} />
          <Route path="/team" element={<Team />} />
          <Route path="/departments" element={<Departments />} />
          <Route path="/chatbot" element={<ChatbotBuilder />} />
          <Route path="/campaigns" element={<Campaigns />} />
          <Route path="/crm" element={<CrmPipeline />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/audit" element={<Audit />} />
          <Route path="/admin" element={<AdminPanel />} />
          {/* página pública do cliente final, ex: /widget/acme-atendimento */}
          <Route path="/widget/:slug" element={<WebchatWidget />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
