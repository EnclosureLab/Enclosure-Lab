import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const SUPABASE_URL=Deno.env.get("SUPABASE_URL")??"https://lblrmljsjimrrighqbdo.supabase.co";
const SERVICE_ROLE_KEY=Deno.env.get("SERVICE_ROLE_KEY")!;
const STRIPE_SECRET_KEY=Deno.env.get("STRIPE_SECRET_KEY")!;
const cors={"Access-Control-Allow-Origin":"https://enclosurelab.github.io","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Vary":"Origin"};
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return new Response("Method not allowed",{status:405,headers:cors});
 try{
  if(!SERVICE_ROLE_KEY||!STRIPE_SECRET_KEY)throw new Error("Payment verification is not configured.");
  const origin=req.headers.get("origin");if(origin&&origin!=="https://enclosurelab.github.io")return Response.json({error:"Origin not allowed."},{status:403,headers:cors});
  const body=await req.json(),orderId=String(body.order_id||""),sessionId=String(body.session_id||"");
  if(!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(orderId)||!/^cs_(test_|live_)[A-Za-z0-9]+$/.test(sessionId))throw new Error("Invalid checkout reference.");
  const stripe=await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,{headers:{"Authorization":`Bearer ${STRIPE_SECRET_KEY}`}});
  const session=await stripe.json();if(!stripe.ok)throw new Error("Could not verify Stripe payment.");
  if(session.client_reference_id!==orderId||session.metadata?.order_id!==orderId)throw new Error("Checkout reference does not match this order.");
  if(session.payment_status!=="paid")return Response.json({paid:false},{headers:cors});
  const update=await fetch(`${SUPABASE_URL}/rest/v1/enclosure_orders?id=eq.${encodeURIComponent(orderId)}&stripe_checkout_session_id=eq.${encodeURIComponent(sessionId)}&payment_status=eq.unpaid`,{
   method:"PATCH",headers:{"apikey":SERVICE_ROLE_KEY,"Content-Type":"application/json","Prefer":"return=minimal"},
   body:JSON.stringify({payment_status:"paid",paid_at:new Date().toISOString(),stripe_payment_intent_id:typeof session.payment_intent==="string"?session.payment_intent:null,order_status:"new"})
  });
  if(!update.ok)throw new Error("Could not update verified order status.");
  return Response.json({paid:true},{headers:cors});
 }catch(e){console.error("verify-checkout-session:",e);return Response.json({error:e instanceof Error?e.message:"Payment verification failed."},{status:400,headers:cors});}
});
