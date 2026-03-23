import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const META_ACCESS_TOKEN = Deno.env.get("META_ACCESS_TOKEN")!;
  const META_PHONE_NUMBER_ID = Deno.env.get("META_PHONE_NUMBER_ID")!;

  try {
    const { conversation_id, message } = await req.json();

    if (!conversation_id || !message?.trim()) {
      return new Response(JSON.stringify({ error: "conversation_id and message are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: conv, error: convErr } = await supabase
      .from("conversations")
      .select("id, whatsapp_number")
      .eq("id", conversation_id)
      .single();

    if (convErr || !conv) {
      return new Response(JSON.stringify({ error: "Conversation not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase.from("messages").insert({
      conversation_id,
      role: "assistant",
      content: message.trim(),
    });

    const to = conv.whatsapp_number.replace(/^\+/, "");
    const metaUrl = `https://graph.facebook.com/v19.0/${META_PHONE_NUMBER_ID}/messages`;
    const metaRes = await fetch(metaUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${META_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { body: message.trim() },
      }),
    });

    if (!metaRes.ok) {
      const err = await metaRes.text();
      console.error("Meta API error:", err);
      return new Response(JSON.stringify({ error: "Failed to send via Meta API", detail: err }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-whatsapp error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
