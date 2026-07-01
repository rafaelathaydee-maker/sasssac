export type UserRole = "SUPER_ADMIN" | "ADMIN" | "AGENT";
export type ConversationStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED";
export type ConversationPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";
export type ConversationFilter = "unassigned" | "mine" | "all";
export type SenderType = "USER" | "CONTACT" | "SYSTEM";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface Company {
  id: string;
  name: string;
  slug: string;
}

export interface CompanySettings extends Company {
  autoDistributionEnabled: boolean;
}

export interface PlanUsage {
  plan: { id: string; name: string; priceCents: number; channels: string[] };
  usage: {
    agents: { used: number; limit: number };
    conversationsThisMonth: { used: number; limit: number };
  };
}

export interface ChannelConfigInfo {
  channel: string;
  externalAccountId: string | null;
  isActive: boolean;
  configured: boolean;
}

export type PipelineStage = "NEW_LEAD" | "NEGOTIATION" | "PROPOSAL" | "WON" | "LOST";

export interface Contact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  tags: string[];
  pipelineStage?: PipelineStage;
}

export interface Agent {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isOnline: boolean;
  isActive: boolean;
  lastSeenAt: string | null;
  departments?: { id: string; name: string }[];
}

export type MessageType = "TEXT" | "IMAGE" | "DOCUMENT" | "AUDIO" | "VIDEO" | "INTERNAL";

export interface Message {
  id: string;
  conversationId: string;
  senderType: SenderType;
  userId: string | null;
  contactId: string | null;
  content: string;
  createdAt: string;
  readAt: string | null;
  type: MessageType;
  mediaUrl: string | null;
  fileName: string | null;
  mimeType: string | null;
  fileSize: number | null;
}

export interface ConversationListItem {
  id: string;
  status: ConversationStatus;
  contact: Contact;
  assignedUser: { id: string; name: string } | null;
  lastMessage: Message | null;
  updatedAt: string;
  departmentId?: string | null;
  isPinned: boolean;
  isFavorite: boolean;
  priority: ConversationPriority;
  department: { id: string; name: string } | null;
}

export interface ConversationSummary {
  unassigned: number;
  mine: number;
  pending: number;
}

export interface Department {
  id: string;
  name: string;
  description: string | null;
  keywords: string[];
  active: boolean;
  agents: { id: string; name: string }[];
}

export interface QuickReply {
  id: string;
  title: string;
  shortcut: string;
  message: string;
}

export type FlowNodeType = "START" | "MESSAGE" | "QUESTION" | "OPTIONS" | "ROUTE_DEPARTMENT" | "TRANSFER_HUMAN";

export interface ChatbotFlow {
  id: string;
  name: string;
  isActive: boolean;
  channels: ("WEBCHAT" | "WHATSAPP" | "INSTAGRAM")[];
  nodes: any[];
  edges: any[];
  updatedAt: string;
}

export interface Campaign {
  id: string;
  name: string;
  message: string;
  channel: string;
  status: "DRAFT" | "SCHEDULED" | "SENDING" | "COMPLETED" | "CANCELLED";
  scheduledAt: string | null;
  rateLimitPerMinute: number;
  total: number;
  sent: number;
  failed: number;
  createdAt: string;
}
