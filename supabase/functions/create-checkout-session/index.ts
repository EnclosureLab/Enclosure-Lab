import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "https://lblrmljsjimrrighqbdo.supabase.co";
const SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY")!;
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const SITE = "https://enclosurelab.github.io/Enclosure-Lab";
const cors = {
  "Access-Control-Allow-Origin": "https://enclosurelab.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};
const catalog: Record<string, {name:string; cents:number; category:string}> = {
  "knob-signature": {name:"EL Signature Bass Knob", cents:2999, category:"knobs"},
  "knob-carbon": {name:"Carbon Series Bass Knob", cents:3499, category:"knobs"},
  "knob-color": {name:"Color Pop Custom Bass Knob", cents:3499, category:"knobs"},
  "kit-custom": {name:"DIY Subwoofer Box Kit", cents:16472, category:"kits"},
  "kicker-c8-prefab": {name:"Kicker Comp C8 Prefab Box", cents:14000, category:"prefab"},
  "skar-sdr10-prefab": {name:"Skar Audio SDR-10 D4 Prefab Subwoofer Box", cents:18000, category:"prefab"},
};
function json(data: unknown, status=200) {
  return new Response(JSON.stringify(data), {status, headers:{...cors,"Content-Type":"application/json"}});
}
function round(n:number) { return Math.round(n*100)/100; }
function priceEnclosure(q:any) {
  const w=Number(q?.width), h=Number(q?.height), d=Number(q?.depth);
  if (![w,h,d].every(Number.isFinite) || w<6 || h<6 || d<6 || w>60 || h>48 || d>36) throw new Error("Custom enclosure dimensions are invalid.");
  const sheets:Record<string,number>={"Birch":79.98,"MDF (Suggested)":49.98,"Plywood":54.98};
  const sheet=sheets[String(q.material)];
  if (!sheet) throw new Error("Choose a valid enclosure material.");
  const surface=2*(w*h+w*d+h*d)/144;
  const baseline=2*(36*18+36*16+18*16)/144;
  const factor=surface/baseline;
  const wood=surface*(sheet/32);
  const finish=String(q.finish);
  let finishCost=0;
  if (finish==="Paint") {
    finishCost=(surface*.22+5)*factor;
    const design=String(q.paintDesign||"");
    const add:Record<string,number>={"Splatter paint":12,"Two-tone paint":15,"Metallic / flake":18,"Color fade / gradient":15,"Custom graphics / lettering":20,"Other custom design":12};
    finishCost+=(add[design]||0)*factor;
  } else if (finish==="Wrap") {
    finishCost=(surface*(49.99/60)+9.97)*factor;
  } else if (finish!=="Raw") throw new Error("Choose a valid enclosure finish.");
  const labor=60*factor, waste=15*factor, consumables=12*factor;
  const direct=wood+finishCost+labor+waste+consumables;
  const retail=(direct+direct*.10)*1.25;
  return {priceCents:Math.round(retail*100), weightLb:Math.max(1,Number(q.weightLb)||1), area:round(surface)};
}
async function supabase(path:string, method="GET", body?:unknown) {
  const res=await fetch(`${SUPABASE_URL}/rest/v1/${path}`,{
    method, headers:{"apikey":SERVICE_ROLE_KEY,"Authorization":`Bearer ${SERVICE_ROLE_KEY}`,"Content-Type":"application/json","Prefer":"return=representation"},
    body:body===undefined?undefined:JSON.stringify(body)
  });
  const raw=await res.text();
  if(!res.ok) throw new Error(`Database request failed (${res.status}): ${raw.slice(0,300)}`);
  return raw?JSON.parse(raw):null;
}
async function creatorDiscount(code:string) {
  if (!code) return 0;
  if (code==="EL10") return 10;
  const data=await supabase("rpc/validate_creator_code","POST",{p_code:code});
  if (!data?.valid) throw new Error("That creator discount code is invalid or inactive.");
  const pct=Number(data.discount_percent);
  if (!Number.isFinite(pct)||pct<=0||pct>50) throw new Error("Creator discount is not valid.");
  return pct;
}
function shippingEstimate(items:any[], fulfillment:string, state:string) {
  if (fulfillment==="pickup") return 0;
  const local=["TN","AL","GA","NC","SC","KY","VA","MS"], near=["FL","WV","OH","IN","IL","MO","AR"];
  const zone=local.includes(state)?7:near.includes(state)?12:18;
  let total=0;
  for (const item of items) {
    const qty=Math.max(1,Number(item.quantity)||1);
    if (item.category==="enclosure") {
      const weight=Math.max(1,Number(item.estimated_weight_lb)||1);
      total+=18+Math.max(0,weight-10)*.85;
    } else {
      const cat=String(item.category||"").toLowerCase(), name=String(item.name||"").toLowerCase();
      let rate=18.5;
      if(cat==="sticker") rate=3.5;
      else if(cat==="headphones"||/airpods|headphones|earbuds|tune buds|live beam|tour pro/.test(name)) rate=8.5;
      else if(cat==="amplifier"||/amplifier|\bamp\b|md 1800|smart 3 bass|salt-2/.test(name)) rate=13.5;
      else if(cat==="speaker"||/coaxial speakers|ds18|midrange|jbl go|jbl clip|jbl flip|jbl charge|jbl xtreme|jbl boombox|jbl grip|jbl wind/.test(name)) rate=10.5;
      total+=rate+(qty-1)*Math.max(3,rate*.45);
    }
  }
  return round(total+zone);
}
Deno.serve(async (req) => {
  if (req.method==="OPTIONS") return new Response("ok",{headers:cors});
  if (req.method!=="POST") return json({error:"Method not allowed."},405);
  try {
    if (!SERVICE_ROLE_KEY||!STRIPE_SECRET_KEY) throw new Error("Payment service is not configured.");
    const origin=req.headers.get("origin");
    if (origin && origin!=="https://enclosurelab.github.io") return json({error:"Origin not allowed."},403);
    const p=await req.json();
    const required=["customer_name","customer_email","fulfillment","items"];
    for(const k of required) if(!p[k]) throw new Error(`Missing required field: ${k}`);
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(p.customer_email))) throw new Error("Enter a valid email address.");
    if(!Array.isArray(p.items)||p.items.length<1||p.items.length>30) throw new Error("Your cart is empty or contains too many items.");
    if(!["shipping","pickup"].includes(p.fulfillment)) throw new Error("Choose shipping or local pickup.");
    const state=String(p.shipping_address?.state||"").toUpperCase();
    if(p.fulfillment==="shipping" && (!p.shipping_address?.street||!p.shipping_address?.city||!/^[A-Z]{2}$/.test(state)||!/^\d{5}$/.test(String(p.shipping_address?.zip||"")))) throw new Error("Complete the shipping address.");
    let subtotal=0,weight=0;
    const normalized=[];
    for(const item of p.items) {
      const qty=Number(item.quantity);
      if(!Number.isInteger(qty)||qty<1||qty>20) throw new Error("Each cart quantity must be between 1 and 20.");
      if(item.category==="enclosure") {
        const calc=priceEnclosure(item.configuration);
        const line=calc.priceCents*qty; subtotal+=line; weight+=calc.weightLb*qty;
        normalized.push({name:"Custom Subwoofer Enclosure",category:"enclosure",quantity:qty,unit_price:calc.priceCents/100,line_total:line/100,estimated_weight_lb:calc.weightLb,configuration:item.configuration});
      } else {
        const product=catalog[String(item.productId||"")];
        if(!product) throw new Error("A cart product could not be verified. Remove it and add it again.");
        const line=product.cents*qty; subtotal+=line;
        normalized.push({product_id:item.productId,name:product.name,category:product.category,quantity:qty,unit_price:product.cents/100,line_total:line/100});
      }
    }
    if(!Number.isSafeInteger(subtotal)||subtotal<=0||subtotal>2000000) throw new Error("Order total is outside the allowed range.");
    const code=String(p.creator_code||p.discount_code||"").trim().toUpperCase();
    const pct=await creatorDiscount(code);
    const discount=Math.round(subtotal*pct/100);
    const shipping=shippingEstimate(normalized,p.fulfillment,state);
    // Tax remains zero until the business owner has reviewed tax obligations and configured a compliant tax calculation.
    const tax=0;
    const total=subtotal-discount+Math.round(shipping*100)+tax;
    const orderPayload={
      customer_name:String(p.customer_name).trim().slice(0,120),customer_email:String(p.customer_email).trim().slice(0,254),
      customer_phone:String(p.customer_phone||"").trim().slice(0,40)||null,fulfillment:p.fulfillment,
      shipping_address:p.fulfillment==="shipping"?p.shipping_address:null,payment_method:"stripe",
      items:normalized,subtotal:subtotal/100,discount_code:code||null,discount_amount:discount/100,creator_code:p.creator_code||null,
      estimated_tax:0,estimated_shipping:shipping,estimated_total:total/100,customer_notes:String(p.customer_notes||"").slice(0,2000)||null,
      payment_status:"unpaid",order_status:"awaiting_payment"
    };
    const inserted=await supabase("enclosure_orders","POST",orderPayload);
    const order=Array.isArray(inserted)?inserted[0]:inserted;
    if(!order?.id) throw new Error("Could not create the order record.");
    const form=new URLSearchParams();
    form.set("mode","payment");form.set("success_url",`${SITE}/checkout.html?payment=success&order_id=${order.id}&session_id={CHECKOUT_SESSION_ID}`);
    form.set("cancel_url",`${SITE}/checkout.html?payment=cancelled&order_id=${order.id}`);
    form.set("customer_email",String(p.customer_email).trim());
    form.set("client_reference_id",order.id);form.set("metadata[order_id]",order.id);
    let remainingDiscount=discount;
    normalized.forEach((it,i)=>{
      const original=Math.round(Number(it.line_total)*100);
      const allocation=i===normalized.length-1?remainingDiscount:Math.min(remainingDiscount,Math.round(original*pct/100));
      remainingDiscount-=allocation;
      const discounted=Math.max(50,original-allocation);
      const index=i;
      form.set(`line_items[${index}][price_data][currency]`,"usd");
      form.set(`line_items[${index}][price_data][unit_amount]`,String(discounted));
      form.set(`line_items[${index}][price_data][product_data][name]`,it.quantity>1?`${it.name} (quantity: ${it.quantity})`:it.name);
      form.set(`line_items[${index}][quantity]`,"1");
    });
    let next=normalized.length;
    if(shipping>0){form.set(`line_items[${next}][price_data][currency]`,"usd");form.set(`line_items[${next}][price_data][unit_amount]`,String(Math.round(shipping*100)));form.set(`line_items[${next}][price_data][product_data][name]`,"Estimated shipping");form.set(`line_items[${next}][quantity]`,"1");next++;}
    const sr=await fetch("https://api.stripe.com/v1/checkout/sessions",{method:"POST",headers:{"Authorization":`Bearer ${STRIPE_SECRET_KEY}`,"Content-Type":"application/x-www-form-urlencoded"},body:form});
    const session=await sr.json();
    if(!sr.ok) throw new Error(session.error?.message||"Stripe could not start checkout.");
    await supabase(`enclosure_orders?id=eq.${encodeURIComponent(order.id)}`,"PATCH",{stripe_checkout_session_id:session.id});
    return json({url:session.url,order_id:order.id});
  } catch(e) {
    console.error("create-checkout-session:",e);
    return json({error:e instanceof Error?e.message:"Checkout could not be started."},400);
  }
});
