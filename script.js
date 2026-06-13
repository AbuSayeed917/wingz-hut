/* ============================================================
   WINGZ HUT — APP LOGIC
   - Editorial menu rows + signature bento, rendered from menu.js
   - Add buttons morph into inline quantity steppers
   - Persists basket in localStorage (no checkout — call to order)
   - Sticky category nav with scroll-spy
   ============================================================ */

(function () {
  "use strict";

  // mark that JS is active — CSS uses this to enable reveal animations.
  // If JS ever fails, content stays visible instead of stuck at opacity:0.
  document.documentElement.classList.add("js");

  const $  = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const money = (n) => "£" + n.toFixed(2);
  const esc = (s) => String(s).replace(/"/g, "&quot;");

  /* signature feature tiles (reference real menu items) */
  const SIGNATURES = [
    { name: "Smash Burger",   price: 10.00, tag: "Chef's Signature", icon: "sandwich", big: true,
      desc: "Double smashed patty · with fries & drink",
      img: "assets/img/burger_gourmet.jpg",
      grad: "linear-gradient(150deg,#7a3b06 0%,#e3771b 52%,#f9b03c 100%)" },
    { name: "Family Platter", price: 33.00, tag: "Feeds the crew", icon: "drumstick",
      desc: "8 pcs chicken, 15 hot wings, 4 fries & 1.5L drink",
      img: "assets/img/fried_chicken.jpg",
      grad: "linear-gradient(150deg,#5c2a04 0%,#c2590e 55%,#e89a2a 100%)" },
    { name: "5 Naga Wings",   price: 6.79, tag: "Bring the heat", icon: "flame",
      desc: "with fries & drink",
      img: "assets/img/wings.jpg",
      grad: "linear-gradient(150deg,#7a2f06 0%,#d4660f 55%,#f0a528 100%)" },
  ];

  /* bestseller list (edit freely) + keyword-derived spice & veg tags */
  const BESTSELLERS = new Set([
    "5 Hot Wings", "Smash Burger", "Chicken Fillet Burger", "Grill Chicken Wrap",
    "Chicken Shawarma Wrap", "Chicken Doner Meal", "Family Platter", "6 Chicken Nuggets",
    "½ Pounder Burger", "Gourmet Burger",
  ]);
  function heatLevel(it) {
    const t = (it.name + " " + (it.desc || "")).toLowerCase();
    if (t.includes("naga")) return 3;
    if (/\bhot\b/.test(t) || t.includes("spicy") || t.includes("satkora") || t.includes("chilli") || t.includes("chili")) return 2;
    if (t.includes("bbq") || t.includes("sticky") || t.includes("saucy") || t.includes("shawarma")) return 1;
    return 0;
  }
  function isVeg(it) {
    const t = it.name.toLowerCase();
    return t.includes("veggi") || t.includes("salad") || t.includes("mozzarella") || t.includes("cheese & fries") || t.includes("chilli pepper & cheese");
  }
  function getAllergens(it) {
    const t = (it.name + " " + (it.desc || "")).toLowerCase();
    const allergens = [];
    if (t.includes("chicken") || t.includes("wing") || t.includes("popcorn") || t.includes("nugget")) allergens.push("Poultry");
    if (t.includes("fish")) allergens.push("Fish");
    if (t.includes("cheese") || t.includes("mozzarella")) allergens.push("Dairy");
    if (t.includes("burger") || t.includes("pitta") || t.includes("nan") || t.includes("bread")) allergens.push("Gluten");
    if (t.includes("doner") || t.includes("lamb") || t.includes("beef")) allergens.push("Beef/Lamb");
    return allergens.length > 0 ? allergens : null;
  }
  function heatHTML(n) {
    if (!n) return "";
    return `<span class="heat" title="Spice ${n}/3" aria-label="Spice level ${n} of 3">${svgIcon("flame").repeat(n)}</span>`;
  }

  const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- basket state ---------- */
  const STORAGE_KEY = "wingzhut_basket_v1";
  let basket = load();

  function load() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
    catch { return {}; }
  }
  function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(basket)); }

  const keyFor = (name, variant) => (variant ? `${name} (${variant})` : name);

  function addItem(name, price, variant) {
    const k = keyFor(name, variant);
    if (!basket[k]) basket[k] = { name, variant: variant || "", price, qty: 0 };
    basket[k].qty++;
    commit(); bumpFab();
    toast(`Added ${name}${variant ? " · " + variant : ""}`);
  }
  function changeQty(k, delta) {
    if (!basket[k]) return;
    basket[k].qty += delta;
    if (basket[k].qty <= 0) delete basket[k];
    commit();
  }
  function clearBasket() { basket = {}; commit(); }

  /* persist + refresh every view that reflects basket state */
  function commit() { save(); syncControls(); renderBasket(); }

  function totals() {
    let count = 0, sum = 0;
    for (const k in basket) { count += basket[k].qty; sum += basket[k].qty * basket[k].price; }
    return { count, sum };
  }

  /* ---------- shared add/stepper control ---------- */
  /* every control is wrapped in a .ctrl carrying its identity so syncControls
     can rebuild just the inner add-button-or-stepper without re-rendering rows */
  function ctrlWrap(name, price, variant, small) {
    return `<span class="ctrl" data-name="${esc(name)}" data-price="${price}" data-variant="${esc(variant || "")}" data-sm="${small ? "1" : ""}">${controlHTML(name, price, variant, small)}</span>`;
  }
  function controlHTML(name, price, variant, small) {
    const qty = basket[keyFor(name, variant)]?.qty || 0;
    const k = esc(keyFor(name, variant));
    const sm = small ? " sm" : "";
    if (qty > 0) {
      return `<span class="stepper${sm}">
        <button data-dec="${k}" aria-label="Remove one ${esc(name)}">${svgIcon("minus")}</button>
        <span>${qty}</span>
        <button data-inc="${k}" aria-label="Add one ${esc(name)}">${svgIcon("plus")}</button>
      </span>`;
    }
    return `<button class="add-dot${sm}" data-add data-name="${esc(name)}" data-price="${price}" data-variant="${esc(variant || "")}" aria-label="Add ${esc(name)}">${svgIcon("plus")}</button>`;
  }
  function syncControls() {
    $$(".ctrl").forEach((w) => {
      w.innerHTML = controlHTML(w.dataset.name, parseFloat(w.dataset.price), w.dataset.variant, !!w.dataset.sm);
    });
  }

  /* ---------- render signatures ---------- */
  function renderSignatures() {
    const host = $("#signatures");
    if (!host) return;
    host.innerHTML = SIGNATURES.map((s) => `
      <article class="sig${s.big ? " big" : ""}">
        <div class="sig-bg" style="${s.img ? `background-image:url('${s.img}')` : `background:${s.grad}`}"></div>
        ${s.img ? "" : `<div class="sig-emoji">${svgIcon(s.icon)}</div>`}
        <span class="sig-tag">${svgIcon("sparkles")}${s.tag}</span>
        <h3 class="sig-name">${s.name}</h3>
        <p class="sig-desc">${s.desc}</p>
        <div class="sig-foot">
          <span class="sig-price">${money(s.price)}</span>
          ${ctrlWrap(s.name, s.price, "", false)}
        </div>
      </article>`).join("");
  }

  /* ---------- render menu ---------- */
  function renderMenu() {
    const nav = $("#catnav");
    const wrap = $("#menu-sections");
    nav.innerHTML = "";
    wrap.innerHTML = "";

    MENU.forEach((cat) => {
      const chip = document.createElement("button");
      chip.innerHTML = `${svgIcon(cat.icon)}<span>${cat.title}</span>`;
      chip.dataset.target = cat.id;
      chip.addEventListener("click", () => {
        document.getElementById(cat.id).scrollIntoView({ behavior: "smooth", block: "start" });
      });
      nav.appendChild(chip);

      const sec = document.createElement("section");
      sec.className = "cat";
      sec.id = cat.id;
      sec.innerHTML = `
        <div class="cat-head">
          <span class="cat-ico">${svgIcon(cat.icon)}</span>
          <h3 class="cat-title">${cat.title}</h3>
          <span class="cat-rule"></span>
          <span class="cat-count">${cat.items.length} ${cat.items.length === 1 ? "item" : "items"}</span>
        </div>
        ${cat.note ? `<p class="cat-note">${svgIcon("info")} ${cat.note}</p>` : ""}
        <div class="items">${cat.items.map((it) => itemCardHTML(it, cat)).join("")}</div>`;
      wrap.appendChild(sec);
    });
  }

  function itemCardHTML(it, cat) {
    const img = it.img || cat.image;            // category photo (per-item override allowed)
    const heat = heatHTML(heatLevel(it));
    const best = BESTSELLERS.has(it.name) ? `<span class="tag-best">${svgIcon("star")}Bestseller</span>` : "";
    const veg = isVeg(it) ? `<span class="tag-veg">${svgIcon("leaf")}Veg</span>` : "";
    const allergens = getAllergens(it);
    const allergenTitle = allergens ? `Contains: ${allergens.join(", ")}` : "";
    const nameWithTooltip = allergenTitle ? `<h4 class="item-name" title="${allergenTitle}">${it.name}</h4>` : `<h4 class="item-name">${it.name}</h4>`;
    const noChip = it.no ? `<span class="item-no">${it.no}</span>` : "";
    const desc = it.desc ? `<p class="item-desc">${it.desc}</p>` : "";
    const meta = veg ? `<div class="card-meta">${veg}</div>` : "";
    const hay = esc(`${it.no || ""} ${it.name} ${it.desc || ""} ${cat.title || ""}`.toLowerCase());

    const foot = it.variants
      ? `<div class="variant-lines">${it.variants.map((v) => `
          <div class="variant-line">
            <span class="vlabel">${v.label}</span>
            <span class="price-coin sm">${money(v.price)}</span>
            ${ctrlWrap(it.name, v.price, v.label, true)}
          </div>`).join("")}</div>`
      : `<div class="item-foot">
            <span class="price-coin">${money(it.price)}</span>
            ${ctrlWrap(it.name, it.price, "", false)}
          </div>`;

    if (img) {
      return `<article class="item-card has-img" data-search="${hay}">
        <div class="card-img">
          <img src="${img}" alt="${esc(it.name)}" loading="lazy" decoding="async" />
          ${noChip ? `<span class="item-no over">${it.no}</span>` : ""}
          ${best}
        </div>
        <div class="card-body">
          <div class="item-top">${nameWithTooltip}${heat}</div>
          ${meta}
          ${desc}
          ${foot}
        </div>
      </article>`;
    }

    // no photo — keep the warm gradient card with a ghost category icon
    return `<article class="item-card" data-search="${hay}">
      <div class="ghost">${svgIcon(cat.icon)}</div>
      <div class="item-top">${noChip}<h4 class="item-name">${it.name}</h4>${heat}${best}</div>
      ${meta}
      ${desc}
      ${foot}
    </article>`;
  }

  /* ---------- render basket drawer ---------- */
  function renderBasket() {
    const { count, sum } = totals();
    const drawer = $("#drawer");
    drawer.classList.toggle("empty", count === 0);

    $("#drawerBody").innerHTML = Object.keys(basket).map((k) => {
      const it = basket[k];
      return `
        <div class="line-item">
          <span class="stepper sm">
            <button data-dec="${esc(k)}" aria-label="remove one">${svgIcon("minus")}</button>
            <span>${it.qty}</span>
            <button data-inc="${esc(k)}" aria-label="add one">${svgIcon("plus")}</button>
          </span>
          <div class="li-info">
            <div class="li-name">${it.name}</div>
            ${it.variant ? `<div class="li-meta">${it.variant}</div>` : ""}
          </div>
          <div class="li-price">${money(it.qty * it.price)}</div>
        </div>`;
    }).join("");

    $("#drawerTotal").textContent = money(sum);
    $("#fabTotal").textContent = money(sum);
    $("#fabCount").textContent = count;
    $("#basketFab").classList.toggle("show", count > 0);
  }

  /* ---------- single delegated click handler for add / +/- everywhere ---------- */
  document.addEventListener("click", (e) => {
    const add = e.target.closest("[data-add]");
    const inc = e.target.closest("[data-inc]");
    const dec = e.target.closest("[data-dec]");
    if (add) {
      const r = add.getBoundingClientRect();
      burst(r.left + r.width / 2, r.top + r.height / 2);
      addItem(add.dataset.name, parseFloat(add.dataset.price), add.dataset.variant || "");
    }
    else if (inc) changeQty(inc.dataset.inc, +1);
    else if (dec) changeQty(dec.dataset.dec, -1);
  });

  /* ---------- drawer open/close ---------- */
  const openDrawer  = () => { $("#drawer").classList.add("show"); $("#overlay").classList.add("show"); document.body.style.overflow = "hidden"; };
  const closeDrawer = () => { $("#drawer").classList.remove("show"); $("#overlay").classList.remove("show"); document.body.style.overflow = ""; };
  $("#basketFab").addEventListener("click", openDrawer);
  $("#drawerClose").addEventListener("click", closeDrawer);
  $("#overlay").addEventListener("click", closeDrawer);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeDrawer(); });

  /* ---------- clear + copy ---------- */
  $("#clearBtn").addEventListener("click", () => { if (confirm("Clear your whole basket?")) clearBasket(); });

  $("#copyOrderBtn").addEventListener("click", () => {
    const { sum } = totals();
    if (sum === 0) return;
    let text = "🔥 Wingz Hut order:\n";
    for (const k in basket) {
      const it = basket[k];
      text += `• ${it.qty} × ${it.name}${it.variant ? " (" + it.variant + ")" : ""} — ${money(it.qty * it.price)}\n`;
    }
    text += `Total: ${money(sum)}\n(Call 020 8981 2455 to order)`;
    navigator.clipboard?.writeText(text).then(
      () => toast("Order copied — paste it anywhere 📋"),
      () => toast("Couldn't copy automatically")
    );
  });

  /* ---------- toast + fab bump ---------- */
  let toastTimer;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg; t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 1800);
  }
  function bumpFab() {
    const fab = $("#basketFab");
    fab.classList.remove("bump"); void fab.offsetWidth; fab.classList.add("bump");
  }

  /* little flame burst when adding to basket */
  function burst(x, y) {
    if (reduced()) return;
    const c = document.createElement("div");
    c.className = "burst"; c.style.left = x + "px"; c.style.top = y + "px";
    const N = 11;
    for (let i = 0; i < N; i++) {
      const p = document.createElement("span");
      const ang = (Math.PI * 2 * i) / N + i * 0.6;
      const dist = 20 + (i % 4) * 9;
      p.style.setProperty("--dx", (Math.cos(ang) * dist).toFixed(1) + "px");
      p.style.setProperty("--dy", (Math.sin(ang) * dist).toFixed(1) + "px");
      c.appendChild(p);
    }
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 650);
  }

  /* ---------- live menu search ---------- */
  function setupSearch() {
    const input = $("#menuSearch");
    if (!input) return;
    const clear = $("#searchClear");
    const emptyMsg = $("#searchEmpty");
    const term = $("#searchTerm");
    const cards = () => $$(".item-card");
    const sections = () => $$(".cat");

    function apply() {
      const q = input.value.toLowerCase().trim();
      clear.hidden = !q;
      document.body.classList.toggle("searching", !!q);

      if (!q) {
        cards().forEach((c) => c.classList.remove("hidden"));
        sections().forEach((s) => s.classList.remove("hidden"));
        emptyMsg.hidden = true;
        return;
      }

      let total = 0;
      sections().forEach((sec) => {
        let shown = 0;
        sec.querySelectorAll(".item-card").forEach((card) => {
          const match = (card.dataset.search || "").includes(q);
          card.classList.toggle("hidden", !match);
          if (match) shown++;
        });
        sec.classList.toggle("hidden", shown === 0);
        total += shown;
      });

      emptyMsg.hidden = total > 0;
      if (total === 0) term.textContent = input.value.trim();
    }

    input.addEventListener("input", apply);
    clear.addEventListener("click", () => { input.value = ""; apply(); input.focus(); });
    input.addEventListener("keydown", (e) => { if (e.key === "Escape") { input.value = ""; apply(); } });
  }

  /* ---------- scroll-spy + topbar shadow ---------- */
  function setupScroll() {
    const topbar = $("#topbar");
    window.addEventListener("scroll", () => {
      topbar.classList.toggle("scrolled", window.scrollY > 20);
    }, { passive: true });

    const nav = $("#catnav");
    const chips = $$("#catnav button");
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          chips.forEach((c) => c.classList.toggle("active", c.dataset.target === en.target.id));
          const active = nav.querySelector("button.active");
          if (active) {
            // center the active chip WITHIN the nav only — never scroll the page
            // (scrollIntoView would fight the user's vertical scroll → stutter)
            const left = active.offsetLeft - (nav.clientWidth - active.offsetWidth) / 2;
            nav.scrollTo({ left, behavior: "smooth" });
          }
        }
      });
    }, { rootMargin: "-45% 0px -50% 0px", threshold: 0 });

    MENU.forEach((cat) => { const el = document.getElementById(cat.id); if (el) spy.observe(el); });
  }

  /* ---------- reveal-on-scroll ---------- */
  function setupReveal() {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
    }, { threshold: 0.15 });
    $$(".reveal").forEach((el) => io.observe(el));
  }

  /* ---------- lottie animations (lazy, fail-safe) ---------- */
  function initLotties() {
    if (typeof lottie === "undefined") return; // player not loaded — site still works
    const load = (id, file, loop = true) => {
      const el = document.getElementById(id);
      if (el) try { lottie.loadAnimation({ container: el, renderer: "svg", loop, autoplay: true, path: "assets/" + file }); } catch (e) {}
    };
    load("emptyLottie", "fries.json");

    const splash = $("#splash");
    if (!splash) return;
    if (sessionStorage.getItem("wh_splash")) { splash.remove(); return; } // already seen this session
    sessionStorage.setItem("wh_splash", "1");
    load("splashLottie", "burger.json");
    splash.classList.add("show");
    document.body.style.overflow = "hidden";
    const dismiss = () => {
      splash.classList.remove("show");
      document.body.style.overflow = "";
      setTimeout(() => splash.remove(), 700);
    };
    setTimeout(dismiss, 2400);
    splash.addEventListener("click", dismiss);
  }

  /* ---------- floating embers ---------- */
  function setupEmbers() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const host = $("#embers");
    const N = window.innerWidth < 700 ? 14 : 26;
    for (let i = 0; i < N; i++) {
      const e = document.createElement("span");
      e.className = "ember";
      const size = 2 + Math.random() * 4;
      e.style.left = (Math.random() * 100) + "vw";
      e.style.width = e.style.height = size + "px";
      e.style.animationDuration = (6 + Math.random() * 9) + "s";
      e.style.animationDelay = "-" + (Math.random() * 12) + "s";
      host.appendChild(e);
    }
  }

  /* ---------- init ---------- */
  hydrateIcons();        // swap static [data-icon] placeholders in the HTML
  renderSignatures();
  renderMenu();
  renderBasket();
  setupSearch();
  setupScroll();
  setupReveal();
  setupEmbers();
  initLotties();
})();
