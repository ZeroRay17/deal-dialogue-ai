import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

type ConversationStage =
  | "greeting"        // first contact
  | "discovery"       // understanding need
  | "qualification"   // refining details
  | "recommendation"  // suggesting options
  | "comparison"      // comparing specific options
  | "closing"         // moving toward decision
  | "scheduling"      // booking/appointment
  | "support"         // existing customer needs help
  | "complaint"       // something went wrong
  | "handoff";        // needs human agent

type LeadQuality = "low" | "medium" | "high";

interface SearchIntent {
  intent: "search" | "cart_view" | "confirm" | "order_complete" | "checkout" | "greeting" | "other";
  categories: string[];
  name_keywords: string[];
  min_price: number | null;
  max_price: number | null;
  wants_cheapest: boolean;
  wants_premium: boolean;
}

interface CartItem { name: string; price: number; qty: number; }

interface ConversationState {
  // Transactional
  cart: CartItem[];
  last_shown_products: any[];
  pending_suggestions: any[];
  // Conversational context
  stage: ConversationStage;
  desired_budget: number | null;
  desired_use_case: string | null;
  desired_brand: string | null;
  current_category: string | null;
  unavailable_mentioned: string[];   // items already said we don't have
  last_question: string | null;      // last question asked — don't repeat
  objections: string[];              // "muito caro", "prefiro outro", etc.
  lead_quality: LeadQuality;
  handoff_recommended: boolean;
  turn_count: number;
}

// The plan produced by buildResponsePlan before the final response
interface ResponsePlan {
  detected_intent: string;
  detected_subintent: string;
  conversation_stage: ConversationStage;
  tone_needed: string;
  missing_information: string[];
  response_objective: string;
  response_strategy: string;
  key_points_to_address: string[];
  catalog_items_to_feature: string[];
  avoid_repeating: string;
  response_length: "short" | "medium" | "long";
  should_use_list: boolean;
  next_best_action: string;
  should_recommend_handoff: boolean;
  handoff_reason: string;
  response_ends_with_question: boolean;
  question_to_ask: string;
  lead_quality: LeadQuality;
  detected_objection: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATE HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function buildContextBlock(state: ConversationState): string {
  const lines: string[] = [];
  lines.push(`Estagio: ${state.stage} | Turno: ${state.turn_count} | Lead: ${state.lead_quality}`);
  if (state.desired_budget)    lines.push(`Orcamento: R$${state.desired_budget.toFixed(0)}`);
  if (state.desired_use_case)  lines.push(`Uso/objetivo: ${state.desired_use_case}`);
  if (state.desired_brand)     lines.push(`Preferencia de marca: ${state.desired_brand}`);
  if (state.current_category)  lines.push(`Categoria de interesse: ${state.current_category}`);
  if (state.objections.length > 0)
    lines.push(`Objecoes: ${state.objections.slice(-3).join(", ")}`);
  if (state.cart.length > 0) {
    const total = state.cart.reduce((s, i) => s + i.price * i.qty, 0);
    lines.push(`Carrinho: ${state.cart.map(i => i.name).join(", ")} | Total: R$${total.toFixed(2)}`);
    if (state.desired_budget && state.desired_budget > total)
      lines.push(`Saldo do orcamento: R$${(state.desired_budget - total).toFixed(2)}`);
  }
  if (state.unavailable_mentioned.length > 0)
    lines.push(`Ja disse que NAO TEM (nao repita): ${state.unavailable_mentioned.slice(-5).join(", ")}`);
  if (state.last_question)
    lines.push(`Ultima pergunta feita: "${state.last_question}" — nao repita`);
  return lines.join("\n");
}

function extractLastQuestion(text: string): string | null {
  const clean = text.replace(/\[.*?\]/g, "");
  const parts = clean.split(/(?<=[.!])\s+/);
  const questions = parts.filter(p => p.trim().endsWith("?") && p.trim().length > 15);
  return questions.length > 0 ? questions[questions.length - 1].trim() : null;
}

function extractBudgetFromHistory(history: Array<{ role: string; content: string }>): number | null {
  for (const msg of [...history].reverse()) {
    if (msg.role !== "customer") continue;
    const t = msg.content.toLowerCase();
    const patterns: RegExp[] = [
      /r\$\s*([\d.]+(?:[.,]\d+)?)/,
      /uns?\s+([\d.]+(?:[.,]\d+)?)/,
      /([\d.]+(?:[.,]\d+)?)\s*mil(?:hao|hoes)?\b/,
      /(?:orcamento|gastar|pagar|investir|custa|custo)\s+(?:de\s+|e\s+|e\s+)?r?\$?\s*([\d.]+(?:[.,]\d+)?)/,
      /ate\s+r?\$?\s*([\d.]+(?:[.,]\d+)?)/,
    ];
    for (const re of patterns) {
      const m = t.match(re);
      if (m) {
        let v = parseFloat(m[1].replace(/\./g, "").replace(",", "."));
        if (/mil\b/.test(t) && v < 100) v *= 1000;
        if (v >= 50 && v <= 500_000) return v;
      }
    }
  }
  return null;
}

function extractUseCaseFromHistory(history: Array<{ role: string; content: string }>): string | null {
  const text = history.filter(m => m.role === "customer").map(m => m.content).join(" ").toLowerCase();
  if (/jog\w+|gam\w+|fps\b|warzone|fortnite|stream|game\b/.test(text)) return "jogos";
  if (/trabalh\w+|edicao|render\w+|design|produtiv|empresarial/.test(text)) return "trabalho";
  if (/estud\w+|escola\b|faculdade|universidade/.test(text)) return "estudos";
  if (/consulta\b|medic|clinica|exame|agendamento/.test(text)) return "saude";
  if (/viagem|hospedagem|hotel|passagem|turismo/.test(text)) return "viagem";
  if (/imovel|apartamento|casa\b|alugar|comprar imovel/.test(text)) return "imovel";
  if (/carro|veiculo|automovel|financiar veiculo/.test(text)) return "automovel";
  if (/seguro|apolice|cobertura/.test(text)) return "seguro";
  return null;
}

function extractBrandFromHistory(history: Array<{ role: string; content: string }>): string | null {
  for (const msg of [...history].reverse()) {
    if (msg.role !== "customer") continue;
    const t = msg.content.toLowerCase();
    // Tech
    if (/\bintel\b/.test(t)) return "Intel";
    if (/\bamd\b|\bryzen\b/.test(t)) return "AMD";
    if (/\bnvidia\b|\brtx\b/.test(t)) return "NVIDIA";
    if (/\bsamsung\b/.test(t)) return "Samsung";
    if (/\bapple\b|\biphone\b|\bmac\b/.test(t)) return "Apple";
    // Auto
    if (/\btoyota\b/.test(t)) return "Toyota";
    if (/\bvolkswagen\b|\bvw\b/.test(t)) return "Volkswagen";
    if (/\bhonda\b/.test(t)) return "Honda";
    // Apparel
    if (/\bnike\b/.test(t)) return "Nike";
    if (/\badidas\b/.test(t)) return "Adidas";
  }
  return null;
}

function extractObjectionsFromHistory(history: Array<{ role: string; content: string }>): string[] {
  const objections: string[] = [];
  for (const msg of history) {
    if (msg.role !== "customer") continue;
    const t = msg.content.toLowerCase();
    if (/caro|salgado|pesado|tao caro/.test(t)) objections.push("preco alto");
    if (/prefiro|preferia|quero outro|nao gostei/.test(t)) objections.push("prefere alternativa");
    if (/sem dinheiro|sem budget|sem orcamento/.test(t)) objections.push("orcamento limitado");
    if (/pensar|vou ver|nao sei|preciso pensar/.test(t)) objections.push("indecisao");
  }
  return [...new Set(objections)].slice(-5);
}

function detectLeadQuality(state: ConversationState, intent: SearchIntent): LeadQuality {
  let score = 0;
  if (state.desired_budget) score += 2;
  if (state.desired_use_case) score += 1;
  if (state.desired_brand) score += 1;
  if (state.cart.length > 0) score += 3;
  if (intent.intent === "confirm" || intent.intent === "checkout") score += 3;
  if (state.turn_count > 4) score += 1;
  if (score >= 5) return "high";
  if (score >= 2) return "medium";
  return "low";
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP 1 — INTENT EXTRACTION (gpt-4.1-nano, JSON, fast)
// ═══════════════════════════════════════════════════════════════════════════════

async function extractSearchIntent(
  openaiKey: string,
  lastMessage: string,
  history: Array<{ role: string; content: string }>,
  allCategories: string[]
): Promise<SearchIntent> {
  const recentHistory = history
    .slice(-6)
    .map(m => `${m.role === "customer" ? "Cliente" : "Atendente"}: ${m.content}`)
    .join("\n");

  const prompt = `Voce e um extrator de intencao para um chatbot de vendas. Retorne APENAS JSON valido.

CATEGORIAS DO NEGOCIO: ${allCategories.length > 0 ? allCategories.join(", ") : "(sem categorias)"}
HISTORICO: ${recentHistory || "(inicio)"}
MENSAGEM: "${lastMessage}"

JSON:
{
  "intent": "search",
  "categories": [],
  "name_keywords": [],
  "min_price": null,
  "max_price": null,
  "wants_cheapest": false,
  "wants_premium": false
}

REGRAS:
intent:
- "search": quer ver/comprar produto ou servico
- "cart_view": ver carrinho
- "confirm": adicionar itens ja sugeridos ("sim", "quero", "pode", "adicione", "os dois", "o primeiro", "ok", "esse", "essa", "ambos", "todos")
- "order_complete": completar conjunto/config ("o que falta", "preciso de mais", "completar")
- "checkout": fechar/pagar ("fechar pedido", "quero pagar", "finalizar", "comprar")
- "greeting": saudacao pura sem necessidade ("oi", "ola" sozinhos)
- "other": conversacional ("voltei", "obrigado", "tudo bem", etc.)

categories: nomes EXATOS das categorias acima. Considere sinonimos setoriais.
name_keywords: como o produto apareceria no catalogo (max 5).
min_price/max_price: APENAS para produto INDIVIDUAL. Para BUILD/CONJUNTO COMPLETO → ambos null.
wants_cheapest: "mais barato", "em conta", "economico"
wants_premium: "o melhor", "top de linha", "sem limite"`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4.1-nano",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0,
        max_tokens: 250,
      }),
    });
    if (!res.ok) throw new Error(`intent status ${res.status}`);
    const data = await res.json();
    const raw = JSON.parse(data.choices[0].message.content);
    const validCatSet = new Set(allCategories);
    const intent: SearchIntent = {
      intent:        raw.intent        ?? "search",
      categories:    (raw.categories   ?? []).filter((c: string) => validCatSet.has(c)),
      name_keywords: (raw.name_keywords ?? []).filter((k: string) => typeof k === "string" && k.length >= 2),
      min_price:     typeof raw.min_price  === "number" ? raw.min_price  : null,
      max_price:     typeof raw.max_price  === "number" ? raw.max_price  : null,
      wants_cheapest: !!raw.wants_cheapest,
      wants_premium:  !!raw.wants_premium,
    };
    console.log(`[intent] ${JSON.stringify(intent)}`);
    return intent;
  } catch (err) {
    console.error("[intent] failed:", err);
    return { intent: "search", categories: [], name_keywords: [], min_price: null, max_price: null, wants_cheapest: false, wants_premium: false };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP 2 — RESPONSE PLANNING (gpt-4.1-nano, JSON, fast)
// This is the core architectural innovation: a deliberate "thinking" step
// before the final response. Separates WHAT to do from HOW to say it.
// ═══════════════════════════════════════════════════════════════════════════════

async function buildResponsePlan(
  openaiKey: string,
  customerMessage: string,
  history: Array<{ role: string; content: string }>,
  state: ConversationState,
  contextBlock: string,
  catalogText: string,
  catalogOverview: string,
  allCategories: string[]
): Promise<ResponsePlan> {

  // Last 6 turns for the planner (3 customer + 3 bot)
  const recentTurns = history
    .slice(-6)
    .map(m => `${m.role === "customer" ? "Cliente" : "Atendente"}: ${m.content}`)
    .join("\n");

  // Last 2 bot messages to detect repetition risk
  const lastBotMessages = history
    .filter(m => m.role === "assistant")
    .slice(-2)
    .map((m, i) => `[${i === 0 ? "penultima" : "ultima"} resposta]: ${m.content}`)
    .join("\n") || "(nenhuma resposta anterior)";

  // Derive business type from categories for context
  const businessContext = allCategories.length > 0
    ? `Categorias/servicos: ${allCategories.join(", ")}`
    : "Negocio generico";

  const prompt = `Voce e um planejador de respostas para um agente de atendimento via WhatsApp.
Analise a situacao e produza um PLANO JSON estrategico para a proxima resposta.
NAO gere a resposta em si — apenas o plano de acao.

━━━ NEGOCIO ━━━
${businessContext}

━━━ ESTADO DO CLIENTE ━━━
${contextBlock}

━━━ HISTORICO RECENTE ━━━
${recentTurns || "(inicio da conversa)"}

━━━ ULTIMAS RESPOSTAS DO ATENDENTE ━━━
${lastBotMessages}

━━━ MENSAGEM ATUAL DO CLIENTE ━━━
"${customerMessage}"

━━━ INFORMACOES DISPONIVEIS ━━━
${catalogText || (catalogOverview ? `Nenhum item especifico encontrado. Visao geral:\n${catalogOverview}` : "Nenhuma informacao encontrada para esta consulta.")}

Produza APENAS este JSON (sem markdown, sem texto extra):
{
  "detected_intent": "product_purchase|service_inquiry|scheduling|comparison|support|complaint|post_sale|pricing|general_info|objection|return_customer|other",
  "detected_subintent": "descricao especifica do que o cliente quer neste turno",
  "conversation_stage": "greeting|discovery|qualification|recommendation|comparison|closing|scheduling|support|complaint|handoff",
  "tone_needed": "warm_casual|direct|empathetic|professional|concise",
  "missing_information": [],
  "response_objective": "UM objetivo claro e especifico para esta resposta",
  "response_strategy": "ask_qualifying_question|recommend|compare_options|reassure|collect_data|show_options|acknowledge_and_redirect|close|summarize_cart|escalate_to_human|acknowledge_complaint|provide_info",
  "key_points_to_address": [],
  "catalog_items_to_feature": [],
  "avoid_repeating": "o que nao repetir baseado nas ultimas respostas",
  "response_length": "short|medium|long",
  "should_use_list": false,
  "next_best_action": "o que deve acontecer depois desta resposta",
  "should_recommend_handoff": false,
  "handoff_reason": "",
  "response_ends_with_question": true,
  "question_to_ask": "",
  "lead_quality": "low|medium|high",
  "detected_objection": ""
}

REGRAS CRITICAS:
- catalog_items_to_feature: SOMENTE nomes que aparecem LITERALMENTE no catalogo acima. Deixe [] se vazio.
- avoid_repeating: analise as ultimas 2 respostas. Identifique frases ou padroes que NAO devem se repetir.
- question_to_ask: especifica e util. NUNCA: "Como posso ajudar?", "Ficou alguma duvida?", "Posso ajudar com mais alguma coisa?". SIM: "Esse servico e pra uso pessoal ou empresarial?", "Voce prefere manha ou tarde para agendamento?", "Qual faixa de orcamento voce imagina?", "Prefere Intel ou AMD?"
- response_length: short=1-2 frases, medium=3-5 frases, long=somente para explicacoes complexas
- should_use_list: true SOMENTE ao comparar 3+ opcoes ou listar passos sequenciais necessarios
- should_recommend_handoff: true se: pediu desconto especial, reclamacao grave, produto/servico totalmente ausente com alta intencao, duvida tecnica/juridica complexa
- lead_quality: high=tem orcamento+necessidade+intencao clara, medium=tem necessidade mas falta detalhe, low=explorando ainda
- Se detectar "teste", "test", "123", "oi teste" — trate como greeting normal, nunca como teste de sistema`;

  const fallback: ResponsePlan = {
    detected_intent: "general_info",
    detected_subintent: "unclear",
    conversation_stage: state.stage,
    tone_needed: "warm_casual",
    missing_information: [],
    response_objective: "Entender melhor a necessidade do cliente",
    response_strategy: "ask_qualifying_question",
    key_points_to_address: [],
    catalog_items_to_feature: [],
    avoid_repeating: "",
    response_length: "short",
    should_use_list: false,
    next_best_action: "qualify_further",
    should_recommend_handoff: false,
    handoff_reason: "",
    response_ends_with_question: true,
    question_to_ask: "O que voce esta buscando?",
    lead_quality: "low",
    detected_objection: "",
  };

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4.1-nano",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0,
        max_tokens: 500,
      }),
    });
    if (!res.ok) throw new Error(`plan status ${res.status}`);
    const data = await res.json();
    const raw = JSON.parse(data.choices[0].message.content);
    const plan: ResponsePlan = {
      detected_intent:         raw.detected_intent       ?? fallback.detected_intent,
      detected_subintent:      raw.detected_subintent    ?? fallback.detected_subintent,
      conversation_stage:      raw.conversation_stage    ?? fallback.conversation_stage,
      tone_needed:             raw.tone_needed            ?? fallback.tone_needed,
      missing_information:     raw.missing_information   ?? [],
      response_objective:      raw.response_objective    ?? fallback.response_objective,
      response_strategy:       raw.response_strategy     ?? fallback.response_strategy,
      key_points_to_address:   raw.key_points_to_address ?? [],
      catalog_items_to_feature: (raw.catalog_items_to_feature ?? []).filter((s: any) => typeof s === "string"),
      avoid_repeating:         raw.avoid_repeating       ?? "",
      response_length:         raw.response_length       ?? "medium",
      should_use_list:         !!raw.should_use_list,
      next_best_action:        raw.next_best_action      ?? "",
      should_recommend_handoff: !!raw.should_recommend_handoff,
      handoff_reason:          raw.handoff_reason        ?? "",
      response_ends_with_question: raw.response_ends_with_question !== false,
      question_to_ask:         raw.question_to_ask       ?? "",
      lead_quality:            raw.lead_quality          ?? "low",
      detected_objection:      raw.detected_objection    ?? "",
    };
    console.log(`[plan] intent=${plan.detected_intent} stage=${plan.conversation_stage} strategy=${plan.response_strategy} handoff=${plan.should_recommend_handoff}`);
    return plan;
  } catch (err) {
    console.error("[plan] failed:", err);
    return fallback;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CATALOG OVERVIEW (fallback when no products match)
// ═══════════════════════════════════════════════════════════════════════════════

async function loadCatalogOverview(supabase: any, tenantId: string | null): Promise<string> {
  const { data: cats } = await supabase.from("product_categories").select("id, name");
  if (!cats?.length) return "";
  const lines: string[] = [];
  for (const cat of (cats as any[]).slice(0, 20)) {
    let pq = supabase.from("products").select("price", { count: "exact" })
      .eq("active", true).gt("stock", 0).eq("category_id", cat.id);
    if (tenantId) pq = pq.or(`tenant_id.eq.${tenantId},tenant_id.is.null`);
    const { data: prods, count } = await pq;
    if (!count || count === 0) continue;
    const prices = (prods ?? []).map((p: any) => Number(p.price));
    lines.push(`${cat.name} (${count} itens, R$${Math.min(...prices).toFixed(0)}–R$${Math.max(...prices).toFixed(0)})`);
  }
  return lines.join("\n");
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRODUCT / SERVICE FINDER
// Receives pre-computed intent — no extra LLM call here
// ═══════════════════════════════════════════════════════════════════════════════

async function findRelevantProducts(
  supabase: any,
  intent: SearchIntent,
  allCategories: string[],
  tenantId: string | null,
  lastShownProducts: any[],
  pendingSuggestions: any[]
): Promise<any[]> {
  const seen = new Set<string>();
  const results: any[] = [];
  const add = (data: any[] | null) =>
    (data ?? []).forEach(p => { if (!seen.has(p.name)) { seen.add(p.name); results.push(p); } });

  const baseQuery = () => {
    let q = supabase.from("products")
      .select("name, brand, price, stock, product_categories(name)")
      .eq("active", true).gt("stock", 0);
    if (tenantId) q = q.or(`tenant_id.eq.${tenantId},tenant_id.is.null`);
    if (intent.max_price !== null) q = q.lte("price", intent.max_price);
    if (intent.min_price !== null) q = q.gte("price", intent.min_price);
    return q;
  };
  const order     = intent.wants_cheapest ? "price" : "name";
  const ascending = !intent.wants_premium;

  if (intent.intent === "cart_view" || intent.intent === "checkout") return [];
  if (intent.intent === "other") return [];

  if (intent.intent === "greeting") {
    const rows = await Promise.all(
      allCategories.slice(0, 6).map(catName => {
        let q = supabase.from("products")
          .select("name, brand, price, stock, product_categories!inner(name)")
          .eq("active", true).gt("stock", 0)
          .eq("product_categories.name", catName).order("name").limit(2);
        if (tenantId) q = q.or(`tenant_id.eq.${tenantId},tenant_id.is.null`);
        return q;
      })
    );
    rows.forEach(r => add(r.data));
    return results.slice(0, 12);
  }

  if (intent.intent === "confirm") {
    if (pendingSuggestions.length > 0) return pendingSuggestions;
    if (lastShownProducts.length > 0) return lastShownProducts;
    return [];
  }

  if (intent.intent === "order_complete") {
    const rows = await Promise.all(
      allCategories.slice(0, 12).map(catName => {
        let q = supabase.from("products")
          .select("name, brand, price, stock, product_categories!inner(name)")
          .eq("active", true).gt("stock", 0)
          .eq("product_categories.name", catName)
          .order("price", { ascending: true }).limit(2);
        if (tenantId) q = q.or(`tenant_id.eq.${tenantId},tenant_id.is.null`);
        return q;
      })
    );
    rows.forEach(r => add(r.data));
    if (results.length > 0) return results.slice(0, 30);
  }

  if (intent.categories.length > 0) {
    const rows = await Promise.all(
      intent.categories.slice(0, 4).map(catName => {
        let q = supabase.from("products")
          .select("name, brand, price, stock, product_categories!inner(name)")
          .eq("active", true).gt("stock", 0)
          .eq("product_categories.name", catName)
          .order(order, { ascending }).limit(20);
        if (tenantId) q = q.or(`tenant_id.eq.${tenantId},tenant_id.is.null`);
        if (intent.max_price !== null) q = q.lte("price", intent.max_price);
        if (intent.min_price !== null) q = q.gte("price", intent.min_price);
        return q;
      })
    );
    rows.forEach(r => add(r.data));
  }

  if (results.length < 15 && intent.name_keywords.length > 0) {
    const res = await Promise.all(
      intent.name_keywords.slice(0, 6).map(kw =>
        baseQuery().ilike("name", `%${kw}%`).order(order, { ascending }).limit(12)
      )
    );
    res.forEach(r => add(r.data));
  }

  if (results.length < 8 && intent.name_keywords.length > 0) {
    const res = await Promise.all(
      intent.name_keywords.slice(0, 4).map(kw =>
        baseQuery().ilike("brand", `%${kw}%`).order(order, { ascending }).limit(8)
      )
    );
    res.forEach(r => add(r.data));
  }

  if (results.length === 0) {
    const rows = await Promise.all(
      allCategories.slice(0, 12).map(catName => {
        let q = supabase.from("products")
          .select("name, brand, price, stock, product_categories!inner(name)")
          .eq("active", true).gt("stock", 0)
          .eq("product_categories.name", catName)
          .order(order, { ascending }).limit(3);
        if (tenantId) q = q.or(`tenant_id.eq.${tenantId},tenant_id.is.null`);
        if (intent.max_price !== null) q = q.lte("price", intent.max_price);
        if (intent.min_price !== null) q = q.gte("price", intent.min_price);
        return q;
      })
    );
    rows.forEach(r => add(r.data));
    if (results.length === 0) {
      const { data } = await supabase.from("products")
        .select("name, brand, price, stock, product_categories(name)")
        .eq("active", true).gt("stock", 0).order("name").limit(20);
      add(data);
    }
  }
  return results.slice(0, 25);
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP 3 — RESPONSE GENERATION
// Builds the focused system prompt using the plan produced in step 2.
// The generator has ONE job: write a natural, human-sounding response
// that executes the plan exactly.
// ═══════════════════════════════════════════════════════════════════════════════

function buildSystemPrompt(
  plan: ResponsePlan,
  contextBlock: string,
  catalogText: string,
  catalogOverview: string,
  cartText: string,
  validatedPlanItems: string[],
  tenantSystemPrompt: string | null
): string {

  // Stage-specific behavior guide (brief, focused)
  const stageGuides: Partial<Record<ConversationStage, string>> = {
    greeting:       `Seja receptivo e direto. Ja identifique o que o cliente precisa em 1-2 frases. Ex: "Oi! Voce esta procurando algo especifico ou quer uma indicacao?"`,
    discovery:      `Entenda a necessidade. Pergunte sobre objetivo, uso, orcamento ou situacao atual. Uma pergunta por mensagem.`,
    qualification:  `Refine os detalhes. Pergunte sobre preferencias especificas (marca, faixa, requisito). Evite o que ja foi respondido.`,
    recommendation: `Recomende 2-3 opcoes numeradas com justificativa curta. Destaque UMA como principal. Proponha proximo passo claro.`,
    comparison:     `Compare opcoes de forma objetiva. Mostre diferenca pratica. Ajude a decidir sem sobrecarregar.`,
    closing:        `Conduza para o fechamento. Verifique o que falta. Proponha proximo passo concreto.`,
    scheduling:     `Colete informacoes necessarias para o agendamento (data, horario, servico, dados do cliente). Confirme antes de registrar.`,
    support:        `Identifique o problema com precisao. Demonstre empatia. Oferca solucao concreta ou escalamento.`,
    complaint:      `Reconheca o problema sem defensividade. Demonstre comprometimento com a resolucao. Encaminhe se necessario.`,
    handoff:        `Informe que vai passar para um especialista. Registre a necessidade. Use [HANDOFF] na mensagem.`,
  };

  const stageGuide = stageGuides[plan.conversation_stage] || stageGuides["discovery"]!;

  // Build the plan block that drives the generator
  const planBlock = [
    `Objetivo desta resposta: ${plan.response_objective}`,
    `Estrategia: ${plan.response_strategy}`,
    plan.key_points_to_address.length > 0 ? `Pontos obrigatorios: ${plan.key_points_to_address.join(" | ")}` : "",
    validatedPlanItems.length > 0 ? `Itens a destacar: ${validatedPlanItems.join(", ")}` : "",
    plan.avoid_repeating ? `NAO REPITA: ${plan.avoid_repeating}` : "",
    `Tamanho: ${plan.response_length} (short=1-2 frases, medium=3-5, long=so se necessario)`,
    `Formato: ${plan.should_use_list ? "lista aqui ajuda" : "texto corrido, sem bullet points"}`,
    `Tom: ${plan.tone_needed}`,
    plan.response_ends_with_question && plan.question_to_ask
      ? `Termine com: "${plan.question_to_ask}"`
      : "Proponha proximo passo sem terminar em pergunta",
    plan.should_recommend_handoff ? `ACIONAR HANDOFF — motivo: ${plan.handoff_reason}` : "",
  ].filter(Boolean).join("\n");

  const defaultPrompt = `VOCE E UM ATENDENTE REAL
Voce e um consultor de vendas e atendimento desta empresa, conversando pelo WhatsApp.
Nao e um bot. Nao e um FAQ. Nao e um assistente generativo.
E um atendente experiente que conhece o negocio, entende o cliente e quer resolver.

━━━ PLANO DESTA RESPOSTA ━━━
${planBlock}

━━━ ESTAGIO: ${plan.conversation_stage.toUpperCase()} ━━━
${stageGuide}

━━━ CONTEXTO DO CLIENTE ━━━
${contextBlock}

━━━ PRODUTOS / SERVICOS DISPONIVEIS ━━━
${catalogText || (catalogOverview ? `Nenhum item especifico encontrado. O que temos:\n${catalogOverview}` : "Nenhum item encontrado para esta consulta.")}

━━━ CARRINHO ━━━
${cartText}

━━━ TOM E FORMATO ━━━
• Conversa de WhatsApp — natural, direto, sem script
• Sem saudacao repetida a cada mensagem
• Sem frases enlatadas: "estou a disposicao", "posso ajudar", "ficou alguma duvida?"
• Sem entusiasmo artificial ou exagerado
• Maximo 1 emoji por mensagem (opcional, so se cair bem)
• Resposta curta a media por padrao — nunca parede de texto
• Voce pode usar: "deixa eu ver", "olha so", "exatamente", "faz sentido", "bacana"

━━━ REGRAS ABSOLUTAS ━━━
1. PRODUTOS/SERVICOS: Mencione SOMENTE itens que aparecem LITERALMENTE na lista acima. Nome e preco exatos. Nao invente.
2. CARRINHO: Use [ADD:NomeProduto:Preco] para adicionar. Sistema funciona 100%. Nunca diga que nao consegue.
3. COMPATIBILIDADE (quando aplicavel): Valide antes de recomendar combinacoes. Seja honesto se nao tiver certeza.
4. PRECOS: Exatamente como na lista. Sem arredondamento.
5. INCERTEZA: Se nao souber, diga com honestidade em vez de inventar. Ex: "Vou confirmar isso pra voce."
6. TESTES: Nunca diga "teste recebido", "estou funcionando", "teste concluido". Responda normalmente.

━━━ MARCADORES (invisiveis ao cliente) ━━━
• [ADD:NomeProduto:Preco] — ao adicionar ao carrinho
• [SHOWN:Nome1:Preco1|Nome2:Preco2] — ao sugerir produtos (final da mensagem)
• [HANDOFF] — ao acionar atendente humano

━━━ CONFIRMACAO DE CARRINHO ━━━
• "sim", "quero", "pode", "adicione", "os dois", "o primeiro", "esse", "ambos" → adicione IMEDIATAMENTE
• "o primeiro" → 1a opcao | "o segundo" → 2a | "os dois" → ambas com dois [ADD:...]
• Nunca peca confirmacao de novo se o cliente ja confirmou

━━━ QUANDO NAO TEM O ITEM ━━━
Nunca repita a mesma negativa. Se ja disse que nao tem (ver contexto), nao mencione de novo.
Faca: reconheca brevemente → proponha alternativa ou pergunta util → avance.

━━━ BUILD/CONJUNTO COMPLETO ━━━
Some os precos antes de escrever. Se passar do orcamento, substitua por mais baratos.
Distribua: CPU~20%, GPU~35-40%, RAM~9%, SSD~7%, Placa-mae~11%, Fonte~7%, Gabinete~6%.
Apresente em linha: "Nome (R$X) + Nome2 (R$Y) + ..."

━━━ CHECKLIST FINAL (mental, antes de enviar) ━━━
□ Responde ao que o cliente acabou de pedir?
□ Segue o plano desta resposta?
□ Usa contexto do cliente?
□ Evita repetir o que ja foi dito?
□ Coerente com os itens disponiveis?
□ Parece escrito por um atendente humano?
□ Move a conversa para frente?`;

  // If tenant has custom prompt, inject the plan block into it
  if (tenantSystemPrompt) {
    return `${tenantSystemPrompt}

━━━ PLANO DESTA RESPOSTA ━━━
${planBlock}

━━━ CONTEXTO DO CLIENTE ━━━
${contextBlock}

━━━ PRODUTOS / SERVICOS DISPONIVEIS ━━━
${catalogText || (catalogOverview ? `Visao geral:\n${catalogOverview}` : "Nenhum item encontrado.")}

━━━ CARRINHO ━━━
${cartText}`;
  }

  return defaultPrompt;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN WEBHOOK HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

serve(async (req) => {
  const SUPABASE_URL              = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const OPENAI_API_KEY            = Deno.env.get("OPENAI_API_KEY");
  const META_ACCESS_TOKEN         = Deno.env.get("META_ACCESS_TOKEN");
  const META_PHONE_NUMBER_ID      = Deno.env.get("META_PHONE_NUMBER_ID");
  const META_VERIFY_TOKEN         = Deno.env.get("META_VERIFY_TOKEN") ?? "pcbuilder_verify";

  // GET: webhook verification
  if (req.method === "GET") {
    const url       = new URL(req.url);
    const mode      = url.searchParams.get("hub.mode");
    const token     = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token === META_VERIFY_TOKEN) {
      return new Response(challenge, { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!OPENAI_API_KEY)       return new Response("OPENAI_API_KEY not set",       { status: 500 });
  if (!META_ACCESS_TOKEN)    return new Response("META_ACCESS_TOKEN not set",    { status: 500 });
  if (!META_PHONE_NUMBER_ID) return new Response("META_PHONE_NUMBER_ID not set", { status: 500 });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const payload  = await req.json();
    const messages = payload?.entry?.[0]?.changes?.[0]?.value?.messages;
    if (!messages?.length) return new Response("OK", { status: 200 });

    const msg = messages[0];
    if (msg.type !== "text") return new Response("OK", { status: 200 });

    const value  = payload.entry[0].changes[0].value;
    const from   = msg.from as string;
    const body   = msg.text?.body as string ?? "";
    const incomingPhoneNumberId = value?.metadata?.phone_number_id as string | undefined;
    if (!from || !body) return new Response("OK", { status: 200 });
    console.log(`[msg] from=${from} body="${body.slice(0, 80)}"`);

    // ── Resolve tenant ─────────────────────────────────────────────────────

    let tenantId: string | null = null;
    let aiSystemPrompt: string | null = null;

    if (incomingPhoneNumberId) {
      const { data: ch } = await supabase
        .from("channels").select("tenant_id, tenants(ai_system_prompt)")
        .eq("type", "whatsapp_meta").eq("is_active", true)
        .filter("config->>phone_number_id", "eq", incomingPhoneNumberId)
        .maybeSingle();
      if (ch) { tenantId = ch.tenant_id; aiSystemPrompt = (ch as any).tenants?.ai_system_prompt ?? null; }
    }
    if (!tenantId && incomingPhoneNumberId === META_PHONE_NUMBER_ID) {
      const { data: ch } = await supabase
        .from("channels").select("tenant_id, tenants(ai_system_prompt)")
        .eq("type", "whatsapp_meta").eq("is_active", true)
        .limit(1).maybeSingle();
      if (ch) { tenantId = ch.tenant_id; aiSystemPrompt = (ch as any).tenants?.ai_system_prompt ?? null; }
    }

    // ── Rate limiting ──────────────────────────────────────────────────────

    const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
    const { data: existingConv } = await supabase
      .from("conversations").select("id").eq("whatsapp_number", from).maybeSingle();
    if (existingConv) {
      const { count: msgCount } = await supabase
        .from("messages").select("id", { count: "exact", head: true })
        .eq("conversation_id", existingConv.id)
        .eq("role", "customer").gte("created_at", oneMinuteAgo);
      if ((msgCount ?? 0) >= 10) {
        console.warn(`[rate-limit] ${from}`);
        return new Response("OK", { status: 200 });
      }
    }

    // ── Find or create conversation ────────────────────────────────────────

    const { data: convRows } = await supabase
      .from("conversations").select("id")
      .eq("whatsapp_number", from)
      .in("status", ["active", "open"])
      .order("created_at", { ascending: false }).limit(1);

    let conversationId: string;
    if (convRows?.length) {
      conversationId = convRows[0].id;
    } else {
      const newId = crypto.randomUUID();
      const { error } = await supabase.from("conversations").insert({
        id: newId, whatsapp_number: from, status: "active", tenant_id: tenantId,
      });
      if (error) throw error;
      conversationId = newId;
    }

    await supabase.from("conversations").update({
      updated_at: new Date().toISOString(),
      last_message_at: new Date().toISOString(),
      ...(tenantId ? { tenant_id: tenantId } : {}),
    }).eq("id", conversationId);

    // ── Save customer message ──────────────────────────────────────────────

    await supabase.from("messages").insert({
      conversation_id: conversationId, role: "customer",
      content: body, tenant_id: tenantId,
    });

    // ── Load history + state ───────────────────────────────────────────────

    const [{ data: history }, { data: convMeta }] = await Promise.all([
      supabase.from("messages").select("role, content")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true }).limit(20),
      supabase.from("conversations").select("metadata")
        .eq("id", conversationId).single(),
    ]);

    const saved = convMeta?.metadata ?? {};

    const state: ConversationState = {
      cart:                  saved.cart                 ?? [],
      last_shown_products:   saved.last_shown_products  ?? [],
      pending_suggestions:   saved.pending_suggestions  ?? [],
      stage:                 saved.stage                ?? "greeting",
      desired_budget:        saved.desired_budget       ?? null,
      desired_use_case:      saved.desired_use_case     ?? null,
      desired_brand:         saved.desired_brand        ?? null,
      current_category:      saved.current_category     ?? null,
      unavailable_mentioned: saved.unavailable_mentioned ?? [],
      last_question:         saved.last_question        ?? null,
      objections:            saved.objections           ?? [],
      lead_quality:          saved.lead_quality         ?? "low",
      handoff_recommended:   saved.handoff_recommended  ?? false,
      turn_count:            saved.turn_count           ?? 0,
    };

    // ── STEP 1: Load categories + extract intent (parallel) ────────────────

    const { data: catRows } = await supabase.from("product_categories").select("id, name");
    const allCategories: string[] = (catRows ?? []).map((c: any) => c.name);

    const intent = await extractSearchIntent(OPENAI_API_KEY!, body, history ?? [], allCategories);

    // ── Update state from heuristics ───────────────────────────────────────

    const detectedBudget = extractBudgetFromHistory(history ?? []);
    if (detectedBudget !== null) state.desired_budget = detectedBudget;
    if (!state.desired_use_case) state.desired_use_case = extractUseCaseFromHistory(history ?? []);
    if (!state.desired_brand)    state.desired_brand    = extractBrandFromHistory(history ?? []);
    if (intent.categories.length > 0) state.current_category = intent.categories[0];

    // Update objections from history
    const newObjections = extractObjectionsFromHistory(history ?? []);
    if (newObjections.length > 0) {
      state.objections = [...new Set([...state.objections, ...newObjections])].slice(-5);
    }

    state.turn_count += 1;
    state.lead_quality = detectLeadQuality(state, intent);

    // ── Find relevant products ─────────────────────────────────────────────

    const products = await findRelevantProducts(
      supabase, intent, allCategories, tenantId,
      state.last_shown_products, state.pending_suggestions
    );
    console.log(`[catalog] products=${products.length}`);

    // Track unavailable items
    if (products.length === 0 && intent.intent === "search" && intent.categories.length > 0) {
      const newUnavailable = intent.categories.filter(c => !state.unavailable_mentioned.includes(c));
      if (newUnavailable.length > 0)
        state.unavailable_mentioned = [...state.unavailable_mentioned, ...newUnavailable].slice(-10);
    }

    const catalogText = products
      .map((p: any) => {
        const cat = p.product_categories?.name ?? "Geral";
        return `- ${p.name}${p.brand ? ` (${p.brand})` : ""} | ${cat} | R$${p.price}`;
      }).join("\n");

    const cartText = state.cart.length > 0
      ? state.cart.map(i => `- ${i.name} x${i.qty} — R$${(i.price * i.qty).toFixed(2)}`).join("\n")
        + `\nTotal: R$${state.cart.reduce((s, i) => s + i.price * i.qty, 0).toFixed(2)}`
      : "Vazio.";

    let catalogOverview = "";
    if (products.length === 0) catalogOverview = await loadCatalogOverview(supabase, tenantId);

    const contextBlock = buildContextBlock(state);

    // ── STEP 2: Build response plan ────────────────────────────────────────

    const plan = await buildResponsePlan(
      OPENAI_API_KEY!, body, history ?? [], state,
      contextBlock, catalogText, catalogOverview, allCategories
    );

    // Update stage from plan (planner has better context than heuristic)
    state.stage = plan.conversation_stage;
    if (plan.should_recommend_handoff) state.handoff_recommended = true;
    if (plan.lead_quality) state.lead_quality = plan.lead_quality;
    if (plan.detected_objection && !state.objections.includes(plan.detected_objection)) {
      state.objections = [...state.objections, plan.detected_objection].slice(-5);
    }

    // Validate catalog_items_to_feature against real catalog
    const validCatalogNames = new Set(products.map((p: any) => p.name));
    const validatedPlanItems = plan.catalog_items_to_feature.filter(name => validCatalogNames.has(name));

    // ── STEP 3: Generate response ──────────────────────────────────────────

    const systemPrompt = buildSystemPrompt(
      plan, contextBlock, catalogText, catalogOverview,
      cartText, validatedPlanItems, aiSystemPrompt
    );

    const aiMessages = [
      { role: "system", content: systemPrompt },
      ...(history ?? []).map((m: any) => ({
        role:    m.role === "customer" ? "user" : "assistant",
        content: m.content,
      })),
    ];

    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-4o-mini", messages: aiMessages }),
    });
    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("OpenAI error:", aiResponse.status, errText);
      throw new Error(`OpenAI error ${aiResponse.status}`);
    }

    const aiData   = await aiResponse.json();
    const rawReply = aiData.choices?.[0]?.message?.content ?? "Desculpe, tive um problema tecnico. Pode repetir?";
    const usage    = aiData.usage;

    // ── Parse [ADD:...] tags ───────────────────────────────────────────────

    const addPattern = /\[ADD:([^:]+):(\d+(?:\.\d+)?)\]/g;
    let match: RegExpExecArray | null;
    const updatedCart = [...state.cart];
    while ((match = addPattern.exec(rawReply)) !== null) {
      const name = match[1].trim(); const price = parseFloat(match[2]);
      const existing = updatedCart.find(i => i.name === name);
      if (existing) { existing.qty += 1; } else { updatedCart.push({ name, price, qty: 1 }); }
    }

    // ── Parse [SHOWN:...] tags ─────────────────────────────────────────────

    const shownPattern = /\[SHOWN:([^\]]+)\]/g;
    const newPendingSuggestions: any[] = [];
    let shownMatch: RegExpExecArray | null;
    while ((shownMatch = shownPattern.exec(rawReply)) !== null) {
      for (const part of shownMatch[1].split("|")) {
        const colonIdx = part.lastIndexOf(":");
        if (colonIdx > 0) {
          const name  = part.slice(0, colonIdx).trim();
          const price = parseFloat(part.slice(colonIdx + 1).trim());
          if (name && !isNaN(price)) newPendingSuggestions.push({ name, price, stock: 1 });
        }
      }
    }

    // ── Parse [HANDOFF] ────────────────────────────────────────────────────

    if (rawReply.includes("[HANDOFF]")) state.handoff_recommended = true;

    // ── Update final state ─────────────────────────────────────────────────

    const cartChanged      = JSON.stringify(updatedCart) !== JSON.stringify(state.cart);
    const hasSuggestions   = newPendingSuggestions.length > 0;
    const effectivePending = hasSuggestions ? newPendingSuggestions
      : (cartChanged ? [] : state.pending_suggestions);
    const newLastShown     = products.length > 0 ? products : state.last_shown_products;
    const lastQuestionFromReply = extractLastQuestion(rawReply);

    const newState = {
      cart:                  updatedCart,
      last_shown_products:   newLastShown,
      pending_suggestions:   effectivePending,
      stage:                 state.stage,
      desired_budget:        state.desired_budget,
      desired_use_case:      state.desired_use_case,
      desired_brand:         state.desired_brand,
      current_category:      state.current_category,
      unavailable_mentioned: state.unavailable_mentioned,
      last_question:         lastQuestionFromReply ?? state.last_question,
      objections:            state.objections,
      lead_quality:          state.lead_quality,
      handoff_recommended:   state.handoff_recommended,
      turn_count:            state.turn_count,
    };

    await supabase.from("conversations").update({ metadata: newState }).eq("id", conversationId);

    // ── Clean reply ────────────────────────────────────────────────────────

    const reply = rawReply
      .replace(/\[ADD:[^\]]+\]/g, "")
      .replace(/\[SHOWN:[^\]]+\]/g, "")
      .replace(/\[HANDOFF\]/g, "")
      .trim();

    // ── Log tokens ────────────────────────────────────────────────────────

    if (usage) {
      const cost = (usage.prompt_tokens / 1_000_000) * 0.15 + (usage.completion_tokens / 1_000_000) * 0.60;
      console.log(`[tokens] prompt=${usage.prompt_tokens} completion=${usage.completion_tokens} cost=~$${cost.toFixed(6)}`);
      if (tenantId) {
        await supabase.from("ai_runs").insert({
          tenant_id: tenantId, conversation_id: conversationId,
          run_type: "chat_reply", model: "gpt-4o-mini",
          input_tokens: usage.prompt_tokens, output_tokens: usage.completion_tokens, cost_usd: cost,
        });
      }
    }

    // ── Save assistant reply ───────────────────────────────────────────────

    await supabase.from("messages").insert({
      conversation_id: conversationId, role: "assistant",
      content: reply, tenant_id: tenantId,
    });

    // ── Send via Meta API ──────────────────────────────────────────────────

    const metaRes = await fetch(
      `https://graph.facebook.com/v19.0/${META_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${META_ACCESS_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          messaging_product: "whatsapp", recipient_type: "individual",
          to: from, type: "text", text: { body: reply },
        }),
      }
    );
    const metaBody = await metaRes.text();
    if (!metaRes.ok) { console.error("Meta API error:", metaRes.status, metaBody); }
    else { console.log(`[sent] to=${from}`); }

    return new Response("OK", { status: 200 });

  } catch (e) {
    console.error("Webhook error:", e);
    return new Response("OK", { status: 200 });
  }
});
