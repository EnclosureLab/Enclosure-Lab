document.addEventListener("DOMContentLoaded", () => {
  const c = window.SITE_CONFIG || {};
  document.querySelectorAll("[data-brand]").forEach(el => el.textContent = c.businessName || "Enclosure Lab");
  document.querySelectorAll("[data-tagline]").forEach(el => el.textContent = c.tagline || "");
  const email = c.quoteEmail || "lawsonhughes53@gmail.com";
  const phone = c.phone || "";
  document.querySelectorAll("[data-email]").forEach(el => el.textContent = email);
  document.querySelectorAll("[data-email-link]").forEach(el => el.href = phone ? `tel:${phone.replace(/\D/g, "")}` : `mailto:${email}`);
  document.querySelectorAll("[data-email]").forEach(el => { if (phone) el.textContent = phone; });
  document.getElementById("year").textContent = new Date().getFullYear();

  const form = document.getElementById("quoteForm");
  const status = document.getElementById("formStatus");

  form.addEventListener("submit", async e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    const required = ["name","email","brand","model","size","quantity","type","goal"];
    if (required.some(k => !data[k])) { status.className="form-status error"; status.textContent="Please complete the required fields before submitting."; return; }
    const payload = {name:data.name,email:data.email,phone:data.phone||null,brand:data.brand,model:data.model,size:data.size,quantity:data.quantity,rms:data.rms||null,spec_link:data.specLink||null,year:data.year||null,make:data.make||null,vehicle:data.vehicle||null,max_width:data.maxWidth||null,max_height:data.maxHeight||null,max_depth:data.maxDepth||null,type:data.type,goal:data.goal,finish:data.finish||null,port:data.port||null,notes:data.notes||null};
    status.className="form-status"; status.textContent="Submitting your quote request…";
    const {data:result,error}=await window.supabase.createClient("https://lblrmljsjimrrighqbdo.supabase.co","sb_publishable_s2YnH1DT5diDmM781NXxqw_gIJVxPRx").from("enclosure_quote_requests").insert(payload);
    if(error){status.className="form-status error";status.textContent="We couldn’t save your quote request yet. Please contact us directly.";console.error(error);return;}
    status.className="form-status success";status.textContent="Your quote request was submitted successfully. We’ll review your specifications and contact you.";form.reset();
  });
});
