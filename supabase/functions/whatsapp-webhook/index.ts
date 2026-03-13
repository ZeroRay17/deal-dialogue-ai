import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";
const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");

  if (!LOVABLE_API_KEY) {
    return new Response("LOVABLE_API_KEY not configured", { status: 500, headers: corsHeaders });
  }
  if (!TWILIO_API_KEY) {
    return new Response("TWILIO_API_KEY not configured", { status: 500, headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // Twilio sends form-urlencoded data
    const contentType = req.headers.get("content-type") || "";
    let from = "";
    let body = "";

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      from = formData.get("From")?.toString() || "";
      body = formData.get("Body")?.toString() || "";
    } else {
      const json = await req.json();
      from = json.From || json.from || "";
      body = json.Body || json.body || "";
    }

    if (!from || !body) {
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        { headers: { ...corsHeaders, "Content-Type": "text/xml" } }
      );
    }

    console.log(`Message from ${from}: ${body}`);

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
        .insert({ whatsapp_number: from })
        .select("id")
        .single();

      if (convError) throw convError;
      conversation = newConv;
    }

    // Save customer message
    await supabase.from("messages").insert({
      conversation_id: conversation!.id,
      role: "customer",
      content: body,
    });

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
      .map(
        (p: any) =>
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
${catalogText}

REGRAS:
- Só sugira produtos que estão no catálogo acima
- Sempre verifique compatibilidade de socket entre CPU e placa mãe
- Sempre inclua: CPU, Placa Mãe, RAM, Armazenamento, Fonte, Gabinete
- Placa de vídeo é opcional se o orçamento não permitir (mas recomende se possível)
- Cooler box gratuito pode ser incluído se o processador suportar
- Ao final da sugestão, mostre o total e cada peça com preço
- Formate a resposta de forma clara para WhatsApp (sem markdown complexo, use *negrito* e linhas simples)
- Se o cliente confirmar, diga que ele pode finalizar a compra pelo link (será gerado automaticamente)`;

    const aiMessages = [
      { role: "system", content: systemPrompt },
      ...(history || []).map((m: any) => ({
        role: m.role === "customer" ? "user" : "assistant",
        content: m.content,
      })),
    ];

    // Call AI
    const aiResponse = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: aiMessages,
        stream: false,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const reply = aiData.choices?.[0]?.message?.content || "Desculpe, tive um problema. Pode repetir?";

    // Save assistant reply
    await supabase.from("messages").insert({
      conversation_id: conversation!.id,
      role: "assistant",
      content: reply,
    });

    // Send reply via Twilio WhatsApp
    const twilioResponse = await fetch(`${GATEWAY_URL}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": TWILIO_API_KEY,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: from,
        From: from.startsWith("whatsapp:") ? "whatsapp:+14155238886" : "+14155238886",
        Body: reply,
      }),
    });

    if (!twilioResponse.ok) {
      const twilioErr = await twilioResponse.text();
      console.error("Twilio error:", twilioResponse.status, twilioErr);
    }

    // Return TwiML empty response (Twilio expects this)
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { headers: { ...corsHeaders, "Content-Type": "text/xml" } }
    );
  } catch (e) {
    console.error("Webhook error:", e);
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { headers: { ...corsHeaders, "Content-Type": "text/xml" } }
    );
  }
});
