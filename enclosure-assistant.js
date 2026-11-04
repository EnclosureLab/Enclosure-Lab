(() => {
  if (document.getElementById("elAssistantLauncher")) return;

  const css = `
    #elAssistantLauncher{position:fixed;right:24px;bottom:24px;z-index:9998;border:0;border-radius:999px;background:#17202b;color:#fff;padding:14px 19px;box-shadow:0 10px 32px #10182035;font:700 14px Inter,system-ui,sans-serif;cursor:pointer;display:flex;align-items:center;gap:10px}
    #elAssistantLauncher:hover{background:#293542;transform:translateY(-1px)}
    #elAssistantLauncher .el-ai-mark{width:27px;height:27px;border-radius:50%;display:grid;place-items:center;background:#ffffff20;font-size:15px}
    #elAssistantPanel{position:fixed;right:24px;bottom:86px;z-index:9999;width:min(390px,calc(100vw - 28px));height:min(570px,calc(100vh - 120px));background:#fff;border:1px solid #dfe5eb;border-radius:18px;box-shadow:0 22px 70px #10182035;display:none;overflow:hidden;flex-direction:column;font-family:Inter,system-ui,sans-serif;color:#17202b}
    #elAssistantPanel.el-open{display:flex}
    .el-ai-head{background:#17202b;color:#fff;padding:17px 18px;display:flex;align-items:center;justify-content:space-between}
    .el-ai-head strong{display:block;font-size:15px}.el-ai-head small{display:block;color:#c4ced8;font-size:11px;margin-top:3px}
    #elAssistantClose{border:0;background:#ffffff18;color:#fff;width:32px;height:32px;border-radius:50%;font-size:21px;cursor:pointer}
    #elAssistantMessages{flex:1;overflow:auto;padding:16px;background:#f7f9fb;display:flex;flex-direction:column;gap:11px}
    .el-ai-message{max-width:88%;padding:11px 13px;border-radius:13px;font-size:13px;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere}
    .el-ai-message.bot{background:#fff;border:1px solid #e3e8ee;align-self:flex-start;border-top-left-radius:4px}
    .el-ai-message.user{background:#17202b;color:#fff;align-self:flex-end;border-top-right-radius:4px}
    .el-ai-suggestions{display:flex;flex-wrap:wrap;gap:7px;padding:0 15px 12px;background:#fff}
    .el-ai-suggestions button{border:1px solid #dce3ea;background:#fff;color:#344252;border-radius:999px;padding:7px 10px;font:600 11px Inter,system-ui,sans-serif;cursor:pointer}
    .el-ai-form{display:flex;gap:8px;padding:12px;border-top:1px solid #e5e9ee;background:#fff}
    #elAssistantInput{min-width:0;flex:1;border:1px solid #d7dee6;border-radius:10px;padding:11px 12px;font:13px Inter,system-ui,sans-serif;outline:none}
    #elAssistantInput:focus{border-color:#758596;box-shadow:0 0 0 3px #75859620}
    #elAssistantSend{border:0;border-radius:10px;background:#17202b;color:#fff;padding:0 15px;font-weight:700;cursor:pointer}
    #elAssistantSend:disabled{opacity:.55;cursor:wait}
    .el-ai-note{padding:0 13px 10px;color:#7b8793;font-size:10px;background:#fff}
    @media(max-width:520px){#elAssistantLauncher{right:14px;bottom:14px;padding:12px 15px}#elAssistantPanel{right:10px;bottom:76px;width:calc(100vw - 20px);height:min(590px,calc(100vh - 96px))}}
  `;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.append(style);

  const launcher = document.createElement("button");
  launcher.id = "elAssistantLauncher";
  launcher.type = "button";
  launcher.setAttribute("aria-expanded", "false");
  launcher.setAttribute("aria-controls", "elAssistantPanel");
  launcher.innerHTML = '<span class="el-ai-mark">✦</span><span>Ask Enclosure Lab</span>';

  const panel = document.createElement("section");
  panel.id = "elAssistantPanel";
  panel.setAttribute("aria-label", "Enclosure Lab Assistant");
  panel.innerHTML = `
    <div class="el-ai-head"><div><strong>Enclosure Lab Assistant</strong><small>Help with your next enclosure</small></div><button id="elAssistantClose" type="button" aria-label="Close assistant">×</button></div>
    <div id="elAssistantMessages" aria-live="polite"><div class="el-ai-message bot">Hi! I can help with enclosure planning, ported vs. sealed designs, materials, subwoofer fitment, and quote questions. What are you working on?</div></div>
    <div class="el-ai-suggestions"><button type="button" data-question="Should I choose a ported or sealed box?">Ported vs. sealed</button><button type="button" data-question="What information do I need to design a box?">Design help</button><button type="button" data-question="What material should I use for my enclosure?">Box materials</button></div>
    <form class="el-ai-form" id="elAssistantForm"><input id="elAssistantInput" maxlength="1200" autocomplete="off" placeholder="Ask about your enclosure…" aria-label="Your question"><button id="elAssistantSend" type="submit">Send</button></form>
    <div class="el-ai-note">AI responses are informational. Confirm final dimensions and tuning before cutting.</div>
  `;
  document.body.append(launcher, panel);

  const messages = panel.querySelector("#elAssistantMessages");
  const form = panel.querySelector("#elAssistantForm");
  const input = panel.querySelector("#elAssistantInput");
  const send = panel.querySelector("#elAssistantSend");
  const close = panel.querySelector("#elAssistantClose");
  const supabaseUrl = "https://lblrmljsjimrrighqbdo.supabase.co";
  const publicKey = "sb_publishable_s2YnH1DT5diDmM781NXxqw_gIJVxPRx";
  const endpoint = supabaseUrl + "/functions/v1/enclosure-assistant";
  let history = [];

  function toggle(open) {
    panel.classList.toggle("el-open", open);
    launcher.setAttribute("aria-expanded", String(open));
    if (open) input.focus();
  }
  function addMessage(text, who) {
    const node = document.createElement("div");
    node.className = "el-ai-message " + who;
    node.textContent = text;
    messages.append(node);
    messages.scrollTop = messages.scrollHeight;
  }
  launcher.addEventListener("click", () => toggle(!panel.classList.contains("el-open")));
  close.addEventListener("click", () => toggle(false));
  panel.querySelectorAll("[data-question]").forEach(button => button.addEventListener("click", () => {
    input.value = button.dataset.question;
    form.requestSubmit();
  }));

  form.addEventListener("submit", async event => {
    event.preventDefault();
    const question = input.value.trim();
    if (!question || send.disabled) return;
    addMessage(question, "user");
    history.push({ role: "user", content: question });
    input.value = "";
    send.disabled = true;
    send.textContent = "…";
    const pending = document.createElement("div");
    pending.className = "el-ai-message bot";
    pending.textContent = "Thinking…";
    messages.append(pending);
    messages.scrollTop = messages.scrollHeight;
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": publicKey, "Authorization": "Bearer " + publicKey },
        body: JSON.stringify({ messages: history.slice(-10) })
      });
      const data = await response.json().catch(() => ({}));
      pending.remove();
      if (!response.ok) {
        const reason = data.error || data.message || "";
        if (response.status === 404 || response.status === 401 || response.status === 503) {
          addMessage("The chat window is installed, but its secure AI service still needs to be connected. Please use the Request a Quote form or contact Enclosure Lab while setup is completed.", "bot");
        } else {
          addMessage("I couldn't reach the assistant just now. Please try again in a moment.", "bot");
        }
        console.warn("Enclosure Lab assistant endpoint:", response.status, reason);
      } else {
        const answer = String(data.reply || data.answer || "").trim() || "I couldn't form an answer to that. Please try asking another way.";
        history.push({ role: "assistant", content: answer });
        addMessage(answer, "bot");
      }
    } catch (error) {
      pending.remove();
      addMessage("The secure AI service isn't connected yet. Please use the Request a Quote form or contact Enclosure Lab for now.", "bot");
      console.warn("Enclosure Lab assistant connection:", error);
    } finally {
      send.disabled = false;
      send.textContent = "Send";
      input.focus();
    }
  });
})();