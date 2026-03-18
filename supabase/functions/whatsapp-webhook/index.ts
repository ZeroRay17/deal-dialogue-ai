import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const twimlEmpty = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';

// Validate Twilio webhook signature using Web Crypto API
async function validateTwilioSignature(authToken: string, url: string, params: Record<string, string>, signature: string): Promise<boolean> {
  const sortedKeys = Object.keys(params).sort();
  const str = url + sortedKeys.map((k) => k + params[k]).join("");
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(authToken),
    { name: "HMAC", hash: "SHA-1" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(str));
  const expected = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return expected === signature;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  const TWILIO_API_KEY_SID = Deno.env.get("TWILIO_API_KEY_SID");
  const TWILIO_API_KEY_SECRET = Deno.env.get("TWILIO_API_KEY_SECRET");
  const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
  const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");

  if (!OPENAI_API_KEY) return new Response("OPENAI_API_KEY not configured", { status: 500, headers: corsHeaders });
  if (!TWILIO_API_KEY_SID || !TWILIO_API_KEY_SECRET) return new Response("Twilio credentials not configured", { status: 500, headers: corsHeaders });
  if (!TWILIO_ACCOUNT_SID) return new Response("TWILIO_ACCOUNT_SID not configured", { status: 500, headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const contentType = req.headers.get("content-type") || "";
    let from = "", to = "", body = "";
    let allParams: Record<string, string> = {};

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      formData.forEach((v, k) => { allParams[k] = v.toString(); });
      from = allParams["From"] || "";
      to = allParams["To"] || "";
      body = allParams["Body"] || "";
    } else {
      const json = await req.json();
      from = json.From || json.from || "";
      to = json.To || json.to || "";
      body = json.Body || json.body || "";
      allParams = json;
    }

    // Validate Twilio signature (skip if no auth token configured)
    if (TWILIO_AUTH_TOKEN) {
      const signature = req.headers.get("x-twilio-signature") || "";
      const url = req.url;
      const valid = await validateTwilioSignature(TWILIO_AUTH_TOKEN, url, allParams, signature);
      if (!valid) {
        console.warn("Invalid Twilio signature — request rejected");
        return new Response("Forbidden", { status: 403, headers: corsHeaders });
      }
    }

    if (!from || !body) {
      return new Response(twimlEmpty, { headers: { ...corsHeaders, "Content-Type": "text/xml" } });
    }

    // Rate limiting: max 10 messages per number per minute
    const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
    const { count: recentCount } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("role", "customer")
      .gte("created_at", oneMinuteAgo)
      .eq("content", body); // approximate: check via conversation

    // More precise: count messages from this number in last minute
    const { data: recentConv } = await supabase
      .from("conversations")
      .select("id")
      .eq("whatsapp_number", from)
      .single();

    if (recentConv) {
      const { count: msgCount } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", recentConv.id)
        .eq("role", "customer")
        .gte("created_at", oneMinuteAgo);

      if ((msgCount || 0) >= 10) {
        console.warn(`Rate limit hit for ${from}`);
        return new Response(twimlEmpty, { headers: { ...corsHeaders, "Content-Type": "text/xml" } });
      }
    }

    console.log(`Message from ${from} to ${to}: ${body}`);

    // Resolve which Twilio account received this message
    const toNormalized = to.replace("whatsapp:", "");
    const { data: twilioAccount } = await supabase
      .from("twilio_accounts")
      .select("id, phone_number, api_key")
      .eq("is_active", true)
      .or(`phone_number.eq.${toNormalized},phone_number.eq.whatsapp:${toNormalized}`)
      .maybeSingle();

    // Use per-account key if available, otherwise fall back to env
    const fromNumber = twilioAccount?.phone_number ?? toNormalized ?? "+14155238886";

    // Find or create conversation
    let { data: conversation } = await supabase
      .from("conversations")
      .select("id")
      .eq("whatsapp_number", from)
      .eq("status", "active")
      .single();

    if (!conversation) {
      const { data: newConv, error: convError } = await supabase
        .from("conversations")
        .insert({ whatsapp_number: from, twilio_account_id: twilioAccount?.id ?? null })
        .select("id")
        .single();
      if (convError) throw convError;
      conversation = newConv;
    }

    // Save customer message
    await supabase.from("messages").insert({ conversation_id: conversation!.id, role: "customer", content: body });

    // Get conversation history
    const { data: history } = await supabase
      .from("messages")
      .select("role, content")
      .eq("conversation_id", conversation!.id)
      .order("created_at", { ascending: true })
      .limit(20);

    // Get product catalog
    const { data: products } = await supabase
      .from("products")
      .select("id, name, brand, price, category_id, specs, stock, product_categories(name)")
      .eq("active", true)
      .gt("stock", 0)
      .order("price");

    const catalogText = (products || [])
      .map((p: any) =>
        `- ${p.name} (${p.brand}) | Categoria: ${p.product_categories?.name} | R$${p.price} | Estoque: ${p.stock} | Specs: ${JSON.stringify(p.specs)}`
      )
      .join("\n");

    const systemPrompt = `Você é um assistente de vendas de uma loja de peças de computador. Seu trabalho é:

1. Entender o que o cliente precisa (tipo de uso, orçamento, preferências)
2. Sugerir uma configuração completa de PC com peças do catálogo
3. Garantir compatibilidade (socket CPU = socket placa mãe, tipo RAM, etc.)
4. Ficar dentro do orçamento do cliente
5. Ser amigável, direto e usar emojis ocasionalmente

CATÁLOGO DISPONÍVEL:
${catalogText || "Nenhum produto cadastrado ainda."}

REGRAS:
- Só sugira produtos que estão no catálogo acima
- Sempre verifique compatibilidade de socket entre CPU e placa mãe
- Sempre inclua: CPU, Placa Mãe, RAM, Armazenamento, Fonte, Gabinete
- Placa de vídeo é opcional se o orçamento não permitir (mas recomende se possível)
- Ao final da sugestão, mostre o total e cada peça com preço
- Formate a resposta de forma clara para WhatsApp (sem markdown complexo, use *negrito* e linhas simples)`;

    const aiMessages = [
      { role: "system", content: systemPrompt },
      ...(history || []).map((m: any) => ({
        role: m.role === "customer" ? "user" : "assistant",
        content: m.content,
      })),
    ];

    // Call OpenAI directly
    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: "gpt-4o-mini", messages: aiMessages }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("OpenAI error:", aiResponse.status, errText);
      throw new Error(`OpenAI error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const reply = aiData.choices?.[0]?.message?.content || "Desculpe, tive um problema. Pode repetir?";

    // Log token usage (gpt-4o-mini: $0.15/1M input, $0.60/1M output)
    const usage = aiData.usage;
    if (usage) {
      const inputCost  = (usage.prompt_tokens     / 1_000_000) * 0.15;
      const outputCost = (usage.completion_tokens / 1_000_000) * 0.60;
      console.log(`[tokens] prompt=${usage.prompt_tokens} completion=${usage.completion_tokens} total=${usage.total_tokens} | cost=~$${(inputCost + outputCost).toFixed(6)}`);
    }

    // Save assistant reply
    await supabase.from("messages").insert({ conversation_id: conversation!.id, role: "assistant", content: reply });

    // Send reply via Twilio API directly
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    const twilioAuth = btoa(`${TWILIO_API_KEY_SID}:${TWILIO_API_KEY_SECRET}`);

    const twilioResponse = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${twilioAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: from,
        From: from.startsWith("whatsapp:") ? `whatsapp:${fromNumber}` : fromNumber,
        Body: reply,
      }),
    });

    if (!twilioResponse.ok) {
      const twilioErr = await twilioResponse.text();
      console.error("Twilio error:", twilioResponse.status, twilioErr);
    }

    return new Response(
      twimlEmpty,
      { headers: { ...corsHeaders, "Content-Type": "text/xml" } }
    );
  } catch (e) {
    console.error("Webhook error:", e);
    return new Response(
      twimlEmpty,
      { headers: { ...corsHeaders, "Content-Type": "text/xml" } }
    );
  }
});
