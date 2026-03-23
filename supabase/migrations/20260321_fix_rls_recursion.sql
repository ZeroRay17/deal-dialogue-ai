-- ============================================================
-- Fix: infinite recursion in tenant_users RLS policies
--
-- Root cause: policies on tenant_users referenced tenant_users
-- itself via subqueries, causing infinite recursion.
--
-- Solution:
--   1. Create a SECURITY DEFINER helper that bypasses RLS
--      when reading tenant_users (runs as the function owner,
--      not the caller, so RLS is not applied to that query).
--   2. Replace all self-referencing policies with simple ones.
--   3. Replace inline subquery policies on other tables with
--      calls to the helper function for consistency.
-- ============================================================

-- ── Helper function (bypasses RLS) ──────────────────────────
CREATE OR REPLACE FUNCTION public.get_my_tenant_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_tenant_admin(p_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_users
    WHERE tenant_id = p_tenant_id
      AND user_id   = auth.uid()
      AND role IN ('platform_admin','tenant_owner','tenant_admin')
  );
$$;

-- ── Fix tenant_users policies (remove self-references) ──────
DROP POLICY IF EXISTS "Users can view their memberships"                ON public.tenant_users;
DROP POLICY IF EXISTS "Authenticated users can insert their own membership" ON public.tenant_users;
DROP POLICY IF EXISTS "Tenant admins can manage memberships"            ON public.tenant_users;

-- Users can see only their own membership records (no recursion)
CREATE POLICY "tenant_users_select_own"
  ON public.tenant_users FOR SELECT
  USING (user_id = auth.uid());

-- Any authenticated user can insert a record for themselves
CREATE POLICY "tenant_users_insert_own"
  ON public.tenant_users FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Admins can update/delete memberships within their tenant
-- (uses SECURITY DEFINER function — no recursion)
CREATE POLICY "tenant_users_admin_update"
  ON public.tenant_users FOR UPDATE
  USING (public.is_tenant_admin(tenant_id));

CREATE POLICY "tenant_users_admin_delete"
  ON public.tenant_users FOR DELETE
  USING (public.is_tenant_admin(tenant_id));

-- ── Re-create tenants policies (use helper function) ────────
DROP POLICY IF EXISTS "Users can view their tenants"        ON public.tenants;
DROP POLICY IF EXISTS "Tenant admins can update their tenant" ON public.tenants;

CREATE POLICY "tenants_select"
  ON public.tenants FOR SELECT
  USING (id IN (SELECT public.get_my_tenant_ids()));

CREATE POLICY "tenants_update"
  ON public.tenants FOR UPDATE
  USING (public.is_tenant_admin(id));

-- ── Re-create contacts policies ──────────────────────────────
DROP POLICY IF EXISTS "Tenant members can view contacts"    ON public.contacts;
DROP POLICY IF EXISTS "Tenant members can manage contacts"  ON public.contacts;

CREATE POLICY "contacts_select"
  ON public.contacts FOR SELECT
  USING (tenant_id IN (SELECT public.get_my_tenant_ids()));

CREATE POLICY "contacts_all"
  ON public.contacts FOR ALL
  USING (tenant_id IN (SELECT public.get_my_tenant_ids()));

-- ── Re-create channels policies ──────────────────────────────
DROP POLICY IF EXISTS "Tenant members can view channels"    ON public.channels;
DROP POLICY IF EXISTS "Tenant admins can manage channels"   ON public.channels;

CREATE POLICY "channels_select"
  ON public.channels FOR SELECT
  USING (tenant_id IN (SELECT public.get_my_tenant_ids()));

CREATE POLICY "channels_admin_all"
  ON public.channels FOR ALL
  USING (public.is_tenant_admin(tenant_id));

-- ── Re-create opportunities policies ────────────────────────
DROP POLICY IF EXISTS "Tenant members can view opportunities"   ON public.opportunities;
DROP POLICY IF EXISTS "Tenant members can manage opportunities" ON public.opportunities;

CREATE POLICY "opportunities_select"
  ON public.opportunities FOR SELECT
  USING (tenant_id IN (SELECT public.get_my_tenant_ids()));

CREATE POLICY "opportunities_all"
  ON public.opportunities FOR ALL
  USING (tenant_id IN (SELECT public.get_my_tenant_ids()));

-- ── Re-create orders policies ────────────────────────────────
DROP POLICY IF EXISTS "Tenant members can view orders"    ON public.orders;
DROP POLICY IF EXISTS "Tenant members can manage orders"  ON public.orders;

CREATE POLICY "orders_select"
  ON public.orders FOR SELECT
  USING (tenant_id IN (SELECT public.get_my_tenant_ids()));

CREATE POLICY "orders_all"
  ON public.orders FOR ALL
  USING (tenant_id IN (SELECT public.get_my_tenant_ids()));

-- ── Re-create order_items policies ──────────────────────────
DROP POLICY IF EXISTS "Tenant members can view order items"    ON public.order_items;
DROP POLICY IF EXISTS "Tenant members can manage order items"  ON public.order_items;

CREATE POLICY "order_items_select"
  ON public.order_items FOR SELECT
  USING (
    order_id IN (
      SELECT id FROM public.orders
      WHERE tenant_id IN (SELECT public.get_my_tenant_ids())
    )
  );

CREATE POLICY "order_items_all"
  ON public.order_items FOR ALL
  USING (
    order_id IN (
      SELECT id FROM public.orders
      WHERE tenant_id IN (SELECT public.get_my_tenant_ids())
    )
  );

-- ── Re-create ai_runs policies ───────────────────────────────
DROP POLICY IF EXISTS "Tenant members can view ai runs" ON public.ai_runs;
DROP POLICY IF EXISTS "Service role can manage ai runs" ON public.ai_runs;

CREATE POLICY "ai_runs_select"
  ON public.ai_runs FOR SELECT
  USING (tenant_id IN (SELECT public.get_my_tenant_ids()));

CREATE POLICY "ai_runs_service_all"
  ON public.ai_runs FOR ALL
  USING (true);

-- ── Re-create audit_logs policies ───────────────────────────
DROP POLICY IF EXISTS "Tenant members can view audit logs" ON public.audit_logs;

CREATE POLICY "audit_logs_select"
  ON public.audit_logs FOR SELECT
  USING (tenant_id IN (SELECT public.get_my_tenant_ids()));

-- ── Re-create conversations policies ────────────────────────
DROP POLICY IF EXISTS "Tenant members can view conversations"   ON public.conversations;
DROP POLICY IF EXISTS "Tenant members can manage conversations" ON public.conversations;

CREATE POLICY "conversations_select"
  ON public.conversations FOR SELECT
  USING (
    tenant_id IS NULL
    OR tenant_id IN (SELECT public.get_my_tenant_ids())
  );

CREATE POLICY "conversations_all"
  ON public.conversations FOR ALL
  USING (
    tenant_id IS NULL
    OR tenant_id IN (SELECT public.get_my_tenant_ids())
  );

-- ── Re-create messages policies ──────────────────────────────
DROP POLICY IF EXISTS "Tenant members can view messages" ON public.messages;
DROP POLICY IF EXISTS "Service role can insert messages" ON public.messages;

CREATE POLICY "messages_select"
  ON public.messages FOR SELECT
  USING (
    conversation_id IN (
      SELECT id FROM public.conversations
      WHERE tenant_id IS NULL
         OR tenant_id IN (SELECT public.get_my_tenant_ids())
    )
  );

CREATE POLICY "messages_service_all"
  ON public.messages FOR ALL
  USING (true);

-- ── Re-create products policies ──────────────────────────────
DROP POLICY IF EXISTS "Tenant members can view products"   ON public.products;
DROP POLICY IF EXISTS "Tenant members can manage products" ON public.products;

CREATE POLICY "products_select"
  ON public.products FOR SELECT
  USING (
    tenant_id IS NULL
    OR tenant_id IN (SELECT public.get_my_tenant_ids())
  );

CREATE POLICY "products_all"
  ON public.products FOR ALL
  USING (
    tenant_id IS NULL
    OR tenant_id IN (SELECT public.get_my_tenant_ids())
  );

-- ── Re-create product_categories policies ───────────────────
DROP POLICY IF EXISTS "Tenant members can view categories"   ON public.product_categories;
DROP POLICY IF EXISTS "Tenant members can manage categories" ON public.product_categories;

CREATE POLICY "product_categories_select"
  ON public.product_categories FOR SELECT
  USING (
    tenant_id IS NULL
    OR tenant_id IN (SELECT public.get_my_tenant_ids())
  );

CREATE POLICY "product_categories_all"
  ON public.product_categories FOR ALL
  USING (
    tenant_id IS NULL
    OR tenant_id IN (SELECT public.get_my_tenant_ids())
  );
