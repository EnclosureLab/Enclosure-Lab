import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const SUPABASE_URL=Deno.env.get("SUPABASE_URL")??"https://lblrmljsjimrrighqbdo.supabase.co";
const SERVICE_ROLE_KEY=Deno.env.get("SERVICE_ROLE_KEY")!;
const WEBHOOK_SECRET=Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
async function verifyStripe(raw:string, signature:string) {
  const parts=signature.split(",").map(x=>x.split("="));
  const timestamp=parts.find(x=>x[0]==="t")?.[1];
  const signatures=parts.filter(x=>x[0]==="v1").map(x=>x[1]);
  if(!timestamp||!signatures.length||Math.abs(Date.now()/1000-Number(timestamp))>300) return false;
  const enc=new TextEncoder();
  const key=await crypto.subtle.importKey("raw",enc.encode(WEBHOOK_SECRET),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const signed=new Uint8Array(await crypto.subtle.sign("HMAC",key,enc.encode(`${timestamp}.${raw}`)));
  const hex=Array.from(signed).map(b=>b.toString(16).padStart(2,"0")).join("");
  return signatures.some(s=>s.length===hex.length&&s.toLowerCase()===hex);
}
Deno.serve(async(req)=>{
  if(req.method!=="POST") return new Response("Method not allowed",{status:405});
  try {
    if(!SERVICE_ROLE_KEY||!WEBHOOK_SECRET) throw new Error("Webhook is not configured.");
    const raw=await req.text();
    const sig=req.headers.get("stripe-signature")||"";
    if(!await verifyStripe(raw,sig)) return new Response("Invalid signature",{status:400});
    const event=JSON.parse(raw);
    if(event.type==="checkout.session.completed"||event.type==="checkout.session.async_payment_succeeded") {
      const session=event.data?.object;
      if(session?.payment_status==="paid"&&session.id) {
        const patch={
          payment_status:"paid",paid_at:new Date().toISOString(),
          stripe_payment_intent_id:typeof session.payment_intent==="string"?session.payment_intent:null,
          order_status:"new"
        };
        const r=await fetch(`${SUPABASE_URL}/rest/v1/enclosure_orders?stripe_checkout_session_id=eq.${encodeURIComponent(session.id)}&payment_status=eq.unpaid`,{
          method:"PATCH",headers:{"apikey":SERVICE_ROLE_KEY,"Authorization":`Bearer ${SERVICE_ROLE_KEY}`,"Content-Type":"application/json","Prefer":"return=minimal"},body:JSON.stringify(patch)
        });
        if(!r.ok) throw new Error(`Order update failed: ${await r.text()}`);
      }
    }
    return new Response(JSON.stringify({received:true}),{headers:{"Content-Type":"application/json"}});
  } catch(e) {
    console.error("stripe-webhook:",e);
    return new Response("Webhook processing failed",{status:500});
  }
});
