/* CLUB JOIA 300 pre-registration page. */
(() => {
  const $ = (s, el = document) => el.querySelector(s);

  // Header turns solid once the hero has scrolled away.
  const nav = $("#nav");
  const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > window.innerHeight * 0.6);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  // Tagline: scale its text so it is exactly as wide as the logo above it (never wider).
  const brand = $(".brand"), tagline = $(".tagline");
  function fitTagline() {
    if (!brand || !tagline) return;
    tagline.style.fontSize = "10px";
    const ratio = brand.clientWidth / tagline.scrollWidth;
    tagline.style.fontSize = `${Math.floor(10 * ratio * 100) / 100}px`;
  }
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(fitTagline);
  window.addEventListener("resize", fitTagline);

  // Gentle reveal of sections (only when JavaScript runs, so content is never hidden without it).
  if ("IntersectionObserver" in window && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    }, { rootMargin: "0px 0px -10% 0px" });
    document.querySelectorAll(".register-intro, .form").forEach((el) => { el.classList.add("reveal"); io.observe(el); });
  }

  // ── Form ──────────────────────────────────────────────────────────────
  const form = $("#form");
  const formError = $("#form-error");
  const submit = $("#submit");
  $("#started").value = String(Date.now());

  const messages = {
    first_name: "Please enter your first name.",
    last_name: "Please enter your last name.",
    email: "Please enter a valid email address.",
    phone: "Please enter your mobile number, including the country code.",
    country: "Please enter your country of residence.",
    tier_interest: "Please choose a membership.",
    consent: "Please agree so we can contact you about your pre-registration.",
  };

  function wrapperOf(name) {
    const input = form.elements[name];
    const el = input instanceof RadioNodeList ? input[0] : input;
    return el.closest(".field, .check");
  }
  function setError(name, text) {
    const w = wrapperOf(name);
    w.classList.toggle("invalid", Boolean(text));
    let p = w.querySelector(".field-error");
    if (text) {
      if (!p) { p = document.createElement("p"); p.className = "field-error"; p.id = `${name}-error`; w.appendChild(p); }
      p.textContent = text;
    } else if (p) p.remove();
    const inputs = form.elements[name] instanceof RadioNodeList ? [...form.elements[name]] : [form.elements[name]];
    inputs.forEach((i) => { i.setAttribute("aria-invalid", text ? "true" : "false"); if (text) i.setAttribute("aria-describedby", `${name}-error`); else i.removeAttribute("aria-describedby"); });
  }
  function check(name) {
    const v = form.elements[name];
    let ok;
    if (name === "tier_interest") ok = Boolean(form.querySelector('input[name="tier_interest"]:checked'));
    else if (name === "consent") ok = v.checked;
    else if (name === "email") ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.value.trim());
    else if (name === "phone") ok = /^\+?[\d\s().-]{7,32}$/.test(v.value.trim()) && v.value.replace(/\D/g, "").length >= 7;
    else ok = v.value.trim() !== "";
    setError(name, ok ? "" : messages[name]);
    return ok;
  }

  // Validate a field once the visitor leaves it, and clear errors as they fix them.
  for (const name of Object.keys(messages)) {
    const els = form.elements[name] instanceof RadioNodeList ? [...form.elements[name]] : [form.elements[name]];
    els.forEach((el) => {
      el.addEventListener(el.type === "radio" || el.type === "checkbox" ? "change" : "blur", () => check(name));
      el.addEventListener("input", () => { if (wrapperOf(name).classList.contains("invalid")) check(name); });
    });
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    formError.hidden = true;
    const results = Object.keys(messages).map((n) => [n, check(n)]);
    const firstBad = results.find(([, ok]) => !ok);
    if (firstBad) {
      const el = form.elements[firstBad[0]];
      (el instanceof RadioNodeList ? el[0] : el).focus();
      return;
    }

    submit.disabled = true;
    submit.textContent = "Sending…";
    try {
      const res = await fetch(form.action, { method: "POST", body: new FormData(form), headers: { Accept: "application/json" } });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        $("#thanks-name").textContent = form.elements.first_name.value.trim() || "guest";
        form.hidden = true;
        const thanks = $("#thanks");
        thanks.hidden = false;
        thanks.focus();
        thanks.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      if (data.fields) for (const [n, t] of Object.entries(data.fields)) if (form.elements[n]) setError(n, t);
      showError(data.error || "Something went wrong. Please try again.");
    } catch {
      showError("We couldn't reach the server. Please check your connection and try again.");
    } finally {
      submit.disabled = false;
      submit.textContent = "Submit pre-registration";
    }
  });

  function showError(text) {
    formError.textContent = text;
    formError.hidden = false;
  }
})();
