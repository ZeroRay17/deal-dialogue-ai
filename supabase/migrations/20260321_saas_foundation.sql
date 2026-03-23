-- ============================================================
-- SaaS Foundation Migration
-- Multi-tenant conversational commerce platform
-- ============================================================

-- ── 1. TENANTS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tenants (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  plan        TEXT NOT NULL DEFAULT 'starter'
                CHECK (plan IN ('starter','growth','pro','enterprise')),
  plan_limits JSONB NOT NULL DEFAULT
                '{"max_users":3,"max_contacts":500,"max_messages":5000,"ai_features":false}'::jsonb,
  settings    JSONB NOT NULL DEFAULT '{}'::jsonb,
  logo_url    TEXT,
  ai_system_prompt TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── 2. TENANT USERS (membership) ────────────────────────────
CREATE TABLE IF NOT EXISTS public.tenant_users (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'sales_rep'
               CHECK (role IN (
                 'platform_admin','tenant_owner','tenant_admin',
                 'sales_manager','sales_rep','support_agent','analyst','client_viewer'
               )),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, user_id)
);

ALTER TABLE public.tenant_users ENABLE ROW LEVEL SECURITY;

-- ── 3. CONTACTS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.contacts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  email            TEXT,
  phone            TEXT,
  whatsapp_number  TEXT,
  company_name     TEXT,
  stage            TEXT NOT NULL DEFAULT 'lead'
                     CHECK (stage IN ('lead','qualified','proposal','negotiation','won','lost','churned')),
  source           TEXT NOT NULL DEFAULT 'manual',
  tags             TEXT[] NOT NULL DEFAULT '{}',
  lead_score       INT NOT NULL DEFAULT 0,
  owner_id         UUID REFERENCES auth.users(id),
  notes            TEXT,
  metadata         JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS contacts_tenant_id_idx ON public.contacts(tenant_id);
CREATE INDEX IF NOT EXISTS contacts_whatsapp_idx  ON public.contacts(whatsapp_number) WHERE whatsapp_number IS NOT NULL;

CREATE TRIGGER update_contacts_updated_at
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── 4. CHANNELS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.channels (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  type       TEXT NOT NULL DEFAULT 'whatsapp_meta'
               CHECK (type IN ('whatsapp_meta','whatsapp_twilio','email','web')),
  config     JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;

-- ── 5. OPPORTUNITIES ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.opportunities (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_id          UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  conversation_id     UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  title               TEXT NOT NULL,
  value               NUMERIC(12,2) NOT NULL DEFAULT 0,
  stage               TEXT NOT NULL DEFAULT 'prospecting'
                        CHECK (stage IN (
                          'prospecting','qualification','proposal',
                          'negotiation','closed_won','closed_lost'
                        )),
  probability         INT NOT NULL DEFAULT 0 CHECK (probability BETWEEN 0 AND 100),
  expected_close_date DATE,
  owner_id            UUID REFERENCES auth.users(id),
  lost_reason         TEXT,
  won_reason          TEXT,
  notes               TEXT,
  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS opportunities_tenant_id_idx ON public.opportunities(tenant_id);
CREATE INDEX IF NOT EXISTS opportunities_stage_idx     ON public.opportunities(stage);

CREATE TRIGGER update_opportunities_updated_at
  BEFORE UPDATE ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── 6. ORDERS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_id      UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  opportunity_id  UUID REFERENCES public.opportunities(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','confirmed','processing','shipped','delivered','cancelled')),
  total           NUMERIC(12,2) NOT NULL DEFAULT 0,
  origin          TEXT NOT NULL DEFAULT 'whatsapp',
  owner_id        UUID REFERENCES auth.users(id),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS orders_tenant_id_idx ON public.orders(tenant_id);
CREATE INDEX IF NOT EXISTS orders_status_idx    ON public.orders(status);

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── 7. ORDER ITEMS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.order_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id   UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity     INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price   NUMERIC(12,2) NOT NULL,
  total        NUMERIC(12,2) NOT NULL
);

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- ── 8. AI RUNS LOG ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  run_type        TEXT NOT NULL DEFAULT 'chat_reply',
  model           TEXT,
  input_tokens    INT NOT NULL DEFAULT 0,
  output_tokens   INT NOT NULL DEFAULT 0,
  cost_usd        NUMERIC(10,6) NOT NULL DEFAULT 0,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_runs ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS ai_runs_tenant_id_idx ON public.ai_runs(tenant_id);

-- ── 9. AUDIT LOGS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action        TEXT NOT NULL,
  resource_type TEXT,
  resource_id   UUID,
  metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS audit_logs_tenant_id_idx ON public.audit_logs(tenant_id);

-- ── 10. ALTER EXISTING TABLES ────────────────────────────────

-- conversations: add SaaS columns
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS tenant_id       UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS contact_id      UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS channel_id      UUID REFERENCES public.channels(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_to     UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS stage           TEXT NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS channel         TEXT NOT NULL DEFAULT 'whatsapp',
  ADD COLUMN IF NOT EXISTS metadata        JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS conversations_tenant_id_idx ON public.conversations(tenant_id);

-- messages: add metadata columns
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS tenant_id    UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS message_type TEXT NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS external_id  TEXT,
  ADD COLUMN IF NOT EXISTS metadata     JSONB NOT NULL DEFAULT '{}'::jsonb;

-- products: add SaaS columns
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS tenant_id   UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS sku         TEXT,
  ADD COLUMN IF NOT EXISTS price_promo NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS cost        NUMERIC(12,2);

CREATE INDEX IF NOT EXISTS products_tenant_id_idx ON public.products(tenant_id);

-- product_categories: add tenant
ALTER TABLE public.product_categories
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

-- ── 11. RLS POLICIES ────────────────────────────────────────

-- Tenants
CREATE POLICY "Users can view their tenants"
  ON public.tenants FOR SELECT
  USING (id IN (
    SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
  ));

CREATE POLICY "Authenticated users can create tenants"
  ON public.tenants FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Tenant admins can update their tenant"
  ON public.tenants FOR UPDATE
  USING (id IN (
    SELECT tenant_id FROM public.tenant_users
    WHERE user_id = auth.uid()
      AND role IN ('tenant_owner','tenant_admin','platform_admin')
  ));

-- Tenant Users
CREATE POLICY "Users can view their memberships"
  ON public.tenant_users FOR SELECT
  USING (
    user_id = auth.uid()
    OR tenant_id IN (
      SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can insert their own membership"
  ON public.tenant_users FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Tenant admins can manage memberships"
  ON public.tenant_users FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_users
      WHERE user_id = auth.uid()
        AND role IN ('tenant_owner','tenant_admin','platform_admin')
    )
  );

-- Contacts
CREATE POLICY "Tenant members can view contacts"
  ON public.contacts FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
  ));

CREATE POLICY "Tenant members can manage contacts"
  ON public.contacts FOR ALL
  USING (tenant_id IN (
    SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
  ));

-- Channels
CREATE POLICY "Tenant members can view channels"
  ON public.channels FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
  ));

CREATE POLICY "Tenant admins can manage channels"
  ON public.channels FOR ALL
  USING (tenant_id IN (
    SELECT tenant_id FROM public.tenant_users
    WHERE user_id = auth.uid()
      AND role IN ('tenant_owner','tenant_admin','platform_admin')
  ));

-- Opportunities
CREATE POLICY "Tenant members can view opportunities"
  ON public.opportunities FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
  ));

CREATE POLICY "Tenant members can manage opportunities"
  ON public.opportunities FOR ALL
  USING (tenant_id IN (
    SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
  ));

-- Orders
CREATE POLICY "Tenant members can view orders"
  ON public.orders FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
  ));

CREATE POLICY "Tenant members can manage orders"
  ON public.orders FOR ALL
  USING (tenant_id IN (
    SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
  ));

-- Order Items (scoped via orders)
CREATE POLICY "Tenant members can view order items"
  ON public.order_items FOR SELECT
  USING (order_id IN (
    SELECT id FROM public.orders
    WHERE tenant_id IN (
      SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "Tenant members can manage order items"
  ON public.order_items FOR ALL
  USING (order_id IN (
    SELECT id FROM public.orders
    WHERE tenant_id IN (
      SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
    )
  ));

-- AI Runs
CREATE POLICY "Tenant members can view ai runs"
  ON public.ai_runs FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
  ));

CREATE POLICY "Service role can manage ai runs"
  ON public.ai_runs FOR ALL USING (true);

-- Audit Logs
CREATE POLICY "Tenant members can view audit logs"
  ON public.audit_logs FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
  ));

-- ── 12. UPDATE EXISTING RLS POLICIES ────────────────────────

-- conversations: replace old broad policies with tenant-scoped ones
DROP POLICY IF EXISTS "Authenticated users can view conversations" ON public.conversations;
DROP POLICY IF EXISTS "Service role can manage conversations" ON public.conversations;

CREATE POLICY "Tenant members can view conversations"
  ON public.conversations FOR SELECT
  USING (
    tenant_id IS NULL
    OR tenant_id IN (
      SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Tenant members can manage conversations"
  ON public.conversations FOR ALL
  USING (
    tenant_id IS NULL
    OR tenant_id IN (
      SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
    )
  );

-- messages: replace old policies
DROP POLICY IF EXISTS "Authenticated users can view messages" ON public.messages;
DROP POLICY IF EXISTS "Service role can manage messages"      ON public.messages;

CREATE POLICY "Tenant members can view messages"
  ON public.messages FOR SELECT
  USING (
    conversation_id IN (
      SELECT id FROM public.conversations
      WHERE tenant_id IS NULL
         OR tenant_id IN (
           SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
         )
    )
  );

CREATE POLICY "Service role can insert messages"
  ON public.messages FOR ALL USING (true);

-- products: replace old policies
DROP POLICY IF EXISTS "Anyone can view active products"        ON public.products;
DROP POLICY IF EXISTS "Authenticated users can manage products" ON public.products;
DROP POLICY IF EXISTS "Anyone can insert products"             ON public.products;

CREATE POLICY "Tenant members can view products"
  ON public.products FOR SELECT
  USING (
    tenant_id IS NULL
    OR tenant_id IN (
      SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Tenant members can manage products"
  ON public.products FOR ALL
  USING (
    tenant_id IS NULL
    OR tenant_id IN (
      SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
    )
  );

-- product_categories: replace old policies
DROP POLICY IF EXISTS "Anyone can view categories"                 ON public.product_categories;
DROP POLICY IF EXISTS "Authenticated users can manage categories"  ON public.product_categories;

CREATE POLICY "Tenant members can view categories"
  ON public.product_categories FOR SELECT
  USING (
    tenant_id IS NULL
    OR tenant_id IN (
      SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Tenant members can manage categories"
  ON public.product_categories FOR ALL
  USING (
    tenant_id IS NULL
    OR tenant_id IN (
      SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
    )
  );
