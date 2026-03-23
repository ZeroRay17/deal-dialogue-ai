// ── Domain Types ──────────────────────────────────────────────────────────────
// Typed business entities for the SaaS platform.
// These mirror the Supabase schema but are typed for frontend use.

export type UserRole =
  | 'platform_admin'
  | 'tenant_owner'
  | 'tenant_admin'
  | 'sales_manager'
  | 'sales_rep'
  | 'support_agent'
  | 'analyst'
  | 'client_viewer';

export type Plan = 'starter' | 'growth' | 'pro' | 'enterprise';

export interface PlanLimits {
  max_users: number;
  max_contacts: number;
  max_messages: number;
  ai_features: boolean;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: Plan;
  plan_limits: PlanLimits;
  settings: Record<string, unknown>;
  logo_url: string | null;
  ai_system_prompt: string | null;
  created_at: string;
  updated_at: string;
}

export interface TenantUser {
  id: string;
  tenant_id: string;
  user_id: string;
  role: UserRole;
  created_at: string;
}

export type ContactStage =
  | 'lead'
  | 'qualified'
  | 'proposal'
  | 'negotiation'
  | 'won'
  | 'lost'
  | 'churned';

export interface Contact {
  id: string;
  tenant_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  whatsapp_number: string | null;
  company_name: string | null;
  stage: ContactStage;
  source: string;
  tags: string[];
  lead_score: number;
  owner_id: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type ChannelType = 'whatsapp_meta' | 'whatsapp_twilio' | 'email' | 'web';

export interface Channel {
  id: string;
  tenant_id: string;
  name: string;
  type: ChannelType;
  config: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
}

export type ConversationStatus = 'open' | 'bot' | 'human' | 'closed' | 'archived';

export interface Conversation {
  id: string;
  tenant_id: string | null;
  contact_id: string | null;
  channel_id: string | null;
  whatsapp_number: string;
  customer_name: string | null;
  status: ConversationStatus | string;
  stage: string;
  channel: string;
  assigned_to: string | null;
  last_message_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type MessageRole = 'customer' | 'assistant' | 'agent';

export interface Message {
  id: string;
  conversation_id: string;
  tenant_id: string | null;
  role: MessageRole | string;
  content: string;
  message_type: string;
  external_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export type OpportunityStage =
  | 'prospecting'
  | 'qualification'
  | 'proposal'
  | 'negotiation'
  | 'closed_won'
  | 'closed_lost';

export interface Opportunity {
  id: string;
  tenant_id: string;
  contact_id: string | null;
  conversation_id: string | null;
  title: string;
  value: number;
  stage: OpportunityStage;
  probability: number;
  expected_close_date: string | null;
  owner_id: string | null;
  lost_reason: string | null;
  won_reason: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

export interface Order {
  id: string;
  tenant_id: string;
  contact_id: string | null;
  opportunity_id: string | null;
  conversation_id: string | null;
  status: OrderStatus;
  total: number;
  origin: string;
  owner_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface Product {
  id: string;
  tenant_id: string | null;
  category_id: string;
  name: string;
  brand: string | null;
  sku: string | null;
  description: string | null;
  price: number;
  price_promo: number | null;
  cost: number | null;
  specs: Record<string, unknown>;
  stock: number;
  image_url: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductCategory {
  id: string;
  tenant_id: string | null;
  name: string;
  slug: string;
  display_order: number;
  created_at: string;
}

// Dashboard / Analytics
export interface KpiMetric {
  label: string;
  value: number | string;
  delta?: number;
  deltaLabel?: string;
  trend?: 'up' | 'down' | 'neutral';
  format?: 'number' | 'currency' | 'percent';
}

export interface FunnelStage {
  stage: ContactStage | OpportunityStage;
  label: string;
  count: number;
  value?: number;
}

// Permissions helper
export const ADMIN_ROLES: UserRole[] = ['platform_admin', 'tenant_owner', 'tenant_admin'];
export const MANAGER_ROLES: UserRole[] = [...ADMIN_ROLES, 'sales_manager'];

export function canManageTenant(role: UserRole): boolean {
  return ADMIN_ROLES.includes(role);
}

export function canManageTeam(role: UserRole): boolean {
  return MANAGER_ROLES.includes(role);
}
