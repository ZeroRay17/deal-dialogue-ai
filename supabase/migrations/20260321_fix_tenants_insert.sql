-- Fix: missing INSERT policy on tenants table.
-- Without this, authenticated users cannot create a workspace.

DROP POLICY IF EXISTS "Authenticated users can create tenants" ON public.tenants;
DROP POLICY IF EXISTS "tenants_insert"                         ON public.tenants;

CREATE POLICY "tenants_insert"
  ON public.tenants FOR INSERT
  TO authenticated
  WITH CHECK (true);
