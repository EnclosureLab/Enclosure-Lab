// Supabase Edge Function: enclosure-assistant
// Required server-side secret: OPENAI_API_KEY
// Deploy with JWT verification disabled because the public GitHub Pages chat
// is anonymous. The function validates payloads and calls OpenAI server-side.

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://enclosurelab.github.io",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

const SYSTEM_PROMPT = `
You are the Enclosure Lab customer assistant. Help customers understand custom
subwoofer enclosure planning, sealed vs ported designs, materials, subwoofer fitment,
dimensions, port tuning, and the ordering process.

Be clear, practical, and friendly. Ask for missing details instead of guessing.
Do not claim a design is guaranteed, professionally certified, or acoustically
validated. Explain that enclosure volume, port area/length, tuning, driver
displacement, bracing, and available vehicle space must all be checked together.
Never invent manufacturer specifications. Encourage customers to verify the exact
subwoofer model's current manufacturer documentation and confirm final measurements,
clearances, and tuning before cutting material or ordering. For complex or uncertain
designs, recommend a manual review by Enclosure Lab before construction.

Do not provide misleading certainty about fitment, power handling, or performance.
When discussing prices, shipping, availability, or order status, do not invent values;
direct the customer to the website's quote/order process if the information is not
provided in the conversation.
`.trim();

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (origin && origin !== "https://enclosurelab.github.io") {
    return jsonResponse(403, { error: "Origin not allowed." });
  }

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed." });
  }

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    return jsonResponse(503, { error: "The assistant service is not configured yet." });
  }

  let payload: unknown;
  try {
    const raw = await req.text();
    if (raw.length > 16_000) {
      return jsonResponse(413, { error: "Message is too large." });
    }
    payload = JSON.parse(raw);
  } catch {
    return jsonResponse(400, { error: "Invalid JSON request." });
  }

  const input = payload as { messages?: unknown };
  if (!Array.isArray(input.messages) || input.messages.length < 1 || input.messages.length > 10) {
    return jsonResponse(400, { error: "Send between 1 and 10 messages." });
  }

  const messages: Array<{ role: "user" | "assistant"; content: string }> = [];
  for (const item of input.messages) {
    if (
      !item ||
      typeof item !== "object" ||
      !("role" in item) ||
      !("content" in item) ||
      (item.role !== "user" && item.role !== "assistant") ||
      typeof item.content !== "string" ||
      item.content.trim().length < 1 ||
      item.content.length > 1200
    ) {
      return jsonResponse(400, { error: "A message was invalid." });
    }
    messages.push({ role: item.role, content: item.content.trim() });
  }

  if (messages[messages.length - 1].role !== "user") {
    return jsonResponse(400, { error: "The last message must be from the customer." });
  }

  try {
    const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        temperature: 0.4,
        max_tokens: 700,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages,
        ],
      }),
    });

    if (!upstream.ok) {
      // Avoid returning upstream details or secrets to the public browser.
      console.error("OpenAI request failed with status:", upstream.status);
      return jsonResponse(502, { error: "The assistant could not generate a reply." });
    }

    const result = await upstream.json();
    const reply = result?.choices?.[0]?.message?.content;
    if (typeof reply !== "string" || !reply.trim()) {
      return jsonResponse(502, { error: "The assistant returned an empty reply." });
    }

    return jsonResponse(200, { reply: reply.trim() });
  } catch (error) {
    console.error("Enclosure assistant request failed:", error instanceof Error ? error.message : "Unknown error");
    return jsonResponse(502, { error: "The assistant is temporarily unavailable." });
  }
});
