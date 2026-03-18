-- Twilio accounts table (supports multiple accounts)
CREATE TABLE public.twilio_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone_number TEXT NOT NULL UNIQUE,
  api_key TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.twilio_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage twilio accounts" ON public.twilio_accounts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Service role can manage twilio accounts" ON public.twilio_accounts FOR ALL USING (true) WITH CHECK (true);

-- Link conversations to a specific Twilio account
ALTER TABLE public.conversations ADD COLUMN twilio_account_id UUID REFERENCES public.twilio_accounts(id);
