
-- Categories for PC components
CREATE TABLE public.product_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view categories" ON public.product_categories FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage categories" ON public.product_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Products table
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID NOT NULL REFERENCES public.product_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  brand TEXT,
  description TEXT,
  price NUMERIC(10,2) NOT NULL,
  specs JSONB DEFAULT '{}'::jsonb,
  stock INT NOT NULL DEFAULT 0,
  image_url TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active products" ON public.products FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage products" ON public.products FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Conversations from WhatsApp
CREATE TABLE public.conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  whatsapp_number TEXT NOT NULL,
  customer_name TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view conversations" ON public.conversations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role can manage conversations" ON public.conversations FOR ALL USING (true) WITH CHECK (true);

-- Messages within conversations
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('customer', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view messages" ON public.messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role can manage messages" ON public.messages FOR ALL USING (true) WITH CHECK (true);

-- Cart/builds suggested by AI
CREATE TABLE public.suggested_builds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  total_price NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.suggested_builds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view builds" ON public.suggested_builds FOR SELECT USING (true);
CREATE POLICY "Service role can manage builds" ON public.suggested_builds FOR ALL USING (true) WITH CHECK (true);

-- Items in a suggested build
CREATE TABLE public.build_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  build_id UUID NOT NULL REFERENCES public.suggested_builds(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INT NOT NULL DEFAULT 1
);

ALTER TABLE public.build_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view build items" ON public.build_items FOR SELECT USING (true);
CREATE POLICY "Service role can manage build items" ON public.build_items FOR ALL USING (true) WITH CHECK (true);

-- Timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
