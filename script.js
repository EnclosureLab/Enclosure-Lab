document.addEventListener("DOMContentLoaded", () => {
  const c = window.SITE_CONFIG || {};
  document.querySelectorAll("[data-brand]").forEach(el => el.textContent = c.businessName || "Enclosure Lab");
  document.querySelectorAll("[data-tagline]").forEach(el => el.textContent = c.tagline || "");
  const email = c.quoteEmail || "quotes@example.com";
  const phone = c.phone || "";
  document.querySelectorAll("[data-email]").forEach(el => el.textContent = email);
  document.querySelectorAll("[data-email-link]").forEach(el => el.href = phone ? `tel:${phone.replace(/\D/g, "")}` : `mailto:${email}`);
  document.querySelectorAll("[data-email]").forEach(el => { if (phone) el.textContent = phone; });
  document.getElementById("year").textContent = new Date().getFullYear();

  const form = document.getElementById("quoteForm");
  const status = document.getElementById("formStatus");

  form.addEventListener("submit", e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    const required = ["name","email","brand","model","size","quantity","type","goal"];
    if (required.some(k => !data[k])) {
      status.className = "form-status error";
      status.textContent = "Please complete the required fields before submitting.";
      return;
    }

    const subject = `Custom Box Quote Request — ${data.name}`;
    const body = [
      `CUSTOM SUBWOOFER BOX QUOTE REQUEST`,
      ``,
      `CUSTOMER`,
      `Name: ${data.name}`,
      `Email: ${data.email}`,
      `Phone: ${data.phone || "Not provided"}`,
      ``,
      `SUBWOOFER`,
      `Brand: ${data.brand}`,
      `Model: ${data.model}`,
      `Size: ${data.size}`,
      `Quantity: ${data.quantity}`,
      `RMS: ${data.rms || "Not provided"}`,
      `Specs: ${data.specLink || "Not provided"}`,
      ``,
      `VEHICLE / SPACE`,
      `Year: ${data.year || "Not provided"}`,
      `Make: ${data.make || "Not provided"}`,
      `Model: ${data.vehicle || "Not provided"}`,
      `Max width: ${data.maxWidth || "Not provided"}`,
      `Max height: ${data.maxHeight || "Not provided"}`,
      `Max depth: ${data.maxDepth || "Not provided"}`,
      ``,
      `DESIGN`,
      `Type: ${data.type}`,
      `Goal: ${data.goal}`,
      `Finish: ${data.finish || "Not provided"}`,
      `Port: ${data.port || "Not provided"}`,
      `Notes: ${data.notes || "None"}`
    ].join("\n");

    if (c.useSms !== false && phone) {
      const smsBody = `${subject}\n\n${body}`;
      window.location.href = `sms:${phone.replace(/\D/g, "")}?body=${encodeURIComponent(smsBody)}`;
      status.className = "form-status success";
      status.textContent = `Your quote request is ready to text ${phone}.`;
    } else if (c.useMailto !== false) {
      window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      status.className = "form-status success";
      status.textContent = "Your quote request is ready. Your email app should open with the completed request.";
    }
    form.reset();
  });
});
