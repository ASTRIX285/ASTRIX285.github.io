/* ==========================================================================
   ASTRIX PARADOX - BETA READINESS, ACTIONBAR & ACCESS CONTROLLER
   Manages tester access authentication, actionbar modal triggers (Loadouts,
   Comparison, Recommendations, Share, Save), and interactive notifications.
   ========================================================================== */

const BETA_ACCESS_CODE = "PARADOX285";
const STORAGE_KEY = "astrix-paradox-beta-access";
const SAVED_KEY = "astrix-paradox-saved-loadouts";

const qs = (s, r = document) => r.querySelector(s);
const qsa = (s, r = document) => [...r.querySelectorAll(s)];

const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      })[c]
  );

function toast(message) {
  let el = qs("#astrixBetaToast");
  if (!el) {
    el = document.createElement("div");
    el.id = "astrixBetaToast";
    el.setAttribute("role", "status");
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("show"), 2600);
}

function modal(title, body, actions = "") {
  qs("#astrixBetaModal")?.remove();
  const wrap = document.createElement("div");
  wrap.id = "astrixBetaModal";
  wrap.className = "beta-modal-backdrop";
  wrap.innerHTML = `
    <section class="beta-modal" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <header>
        <div>
          <small>PARADOX FORGE BETA</small>
          <h2>${esc(title)}</h2>
        </div>
        <button type="button" data-beta-close aria-label="Close">✕</button>
      </header>
      <div class="beta-modal-body">${body}</div>
      ${actions ? `<footer>${actions}</footer>` : ""}
    </section>`;

  document.body.appendChild(wrap);

  wrap.addEventListener("click", (e) => {
    if (e.target === wrap || e.target.closest("[data-beta-close]")) wrap.remove();
  });

  document.addEventListener("keydown", function escHandler(e) {
    if (e.key === "Escape") {
      wrap.remove();
      document.removeEventListener("keydown", escHandler);
    }
  });

  return wrap;
}

function equaliseBottomPanels() {
  const armour = qs(".gear-combined");
  if (!armour) return;
  requestAnimationFrame(() => {
    const h = Math.ceil(armour.getBoundingClientRect().height);
    if (h > 0) {
      document.documentElement.style.setProperty("--pf-bottom-panel-height", `${h}px`);
    }
  });
}

function currentFixture() {
  return globalThis.ASTRIXBetaFixtures?.current?.() || "PF-BETA-03";
}

async function openLoadouts() {
  const api = globalThis.ASTRIXBetaFixtures;
  if (!api?.list) return toast("Loadout data is still initialising.");
  const fixtures = await api.list();

  const body = `
    <div class="beta-loadout-list">
      ${fixtures
        .map(
          (f) => `
        <button type="button" data-fixture="${esc(f.fixtureId)}" class="beta-loadout-row ${
            f.fixtureId === currentFixture() ? "active" : ""
          }">
          <b>${esc(f.displayName)}</b>
          <span>${esc(f.className)} · ${esc(f.subclassName)} · ${esc(f.element)}</span>
          <small>${esc(f.fixtureId)}</small>
        </button>`
        )
        .join("")}
    </div>`;

  const m = modal("Beta Loadouts", body);
  qsa("[data-fixture]", m).forEach((btn) =>
    btn.addEventListener("click", async () => {
      await api.load(btn.dataset.fixture);
      m.remove();
      toast(`${btn.querySelector("b")?.textContent || "Loadout"} loaded`);
    })
  );
}

async function openCompare() {
  const api = globalThis.ASTRIXBetaFixtures;
  if (!api?.list) return toast("Loadout data is still initialising.");
  const fixtures = await api.list();

  const options = fixtures
    .map(
      (f) =>
        `<option value="${esc(f.fixtureId)}">${esc(f.displayName)} · ${esc(f.className)} · ${esc(
          f.subclassName
        )}</option>`
    )
    .join("");

  const body = `
    <p class="beta-note">Beta comparison switches between verified fixture identities without inventing performance scores.</p>
    <div class="beta-compare-grid">
      <label>Current
        <select id="betaCompareA">${options}</select>
      </label>
      <label>Compare with
        <select id="betaCompareB">${options}</select>
      </label>
    </div>
    <div id="betaCompareResult" class="beta-compare-result"></div>`;

  const actions = `<button type="button" class="beta-primary" id="betaCompareRun">COMPARE</button>`;
  const m = modal("Compare Loadouts", body, actions);

  const selectA = qs("#betaCompareA", m);
  const selectB = qs("#betaCompareB", m);
  if (selectA) selectA.value = currentFixture();
  if (selectB) selectB.selectedIndex = Math.min(1, fixtures.length - 1);

  qs("#betaCompareRun", m)?.addEventListener("click", () => {
    const a = fixtures.find((f) => f.fixtureId === selectA.value);
    const b = fixtures.find((f) => f.fixtureId === selectB.value);
    if (!a || !b) return;

    qs("#betaCompareResult", m).innerHTML = `
      <div>
        <b>${esc(a.displayName)}</b>
        <span>${esc(a.className)} · ${esc(a.subclassName)} · ${esc(a.element)}</span>
      </div>
      <strong>VS</strong>
      <div>
        <b>${esc(b.displayName)}</b>
        <span>${esc(b.className)} · ${esc(b.subclassName)} · ${esc(b.element)}</span>
      </div>`;
  });
}

function openRecommendations() {
  const strengths = qsa(".sw-card.str li").map((x) => x.textContent.trim());
  const weaknesses = qsa(".sw-card.weak li").map((x) => x.textContent.trim());
  const improvement =
    qs(".improve p")?.textContent?.trim() || "No recommendation loaded.";

  const body = `
    <p class="beta-note">This beta view surfaces only the recommendation data already loaded into Paradox Analysis.</p>
    <div class="beta-rec-grid">
      <section>
        <h3>STRENGTHS</h3>
        ${strengths.map((x) => `<p>✓ ${esc(x)}</p>`).join("")}
      </section>
      <section>
        <h3>WEAK LINKS</h3>
        ${weaknesses.map((x) => `<p>• ${esc(x)}</p>`).join("")}
      </section>
    </div>
    <div class="beta-improvement">
      <small>TODAY'S IMPROVEMENT</small>
      <p>${esc(improvement)}</p>
    </div>`;

  modal("Build Recommendations", body);
}

function improveGuardian() {
  openRecommendations();
}

function saveLoadout() {
  const id = currentFixture();
  const saved = new Set(JSON.parse(localStorage.getItem(SAVED_KEY) || "[]"));
  saved.add(id);
  localStorage.setItem(SAVED_KEY, JSON.stringify([...saved]));
  toast(`${id} saved to this browser`);
}

async function shareLoadout() {
  const url = new URL(location.href);
  url.searchParams.set("fixture", currentFixture());
  try {
    await navigator.clipboard.writeText(url.toString());
    toast("Share link copied");
  } catch {
    modal(
      "Share Loadout",
      `<p>Copy this beta link:</p><input class="beta-share-input" value="${esc(
        url.toString()
      )}" readonly>`
    );
  }
}

function changeActivity() {
  const choices = [
    "Grandmaster Nightfall",
    "Raid / Dungeon",
    "General PvE",
    "Onslaught / Horde",
    "PvP"
  ];

  const body = `
    <p class="beta-note">Activity selection is a beta UI control. Encounter-specific counter reasoning will replace the current preview analysis when that engine is connected.</p>
    <div class="beta-activity-list">
      ${choices
        .map(
          (x, i) => `
        <button type="button" data-activity="${esc(x)}" class="${i === 0 ? "active" : ""}">
          ${esc(x)}
        </button>`
        )
        .join("")}
    </div>`;

  const m = modal("Activity Profile", body);
  qsa("[data-activity]", m).forEach((btn) =>
    btn.addEventListener("click", () => {
      const label = qs(".activity .act-hero b");
      if (label) label.textContent = btn.dataset.activity;
      m.remove();
      toast(`${btn.dataset.activity} selected for beta preview`);
    })
  );
}

function betaUnavailable(feature) {
  modal(
    feature,
    `<p class="beta-note">This control is reserved for the authenticated Bungie beta path and is intentionally gated rather than pretending to work.</p><p>Fixture testing remains fully available.</p>`
  );
}

function wireControls() {
  qs(".btn-rec")?.addEventListener("click", openRecommendations);
  qs(".improve-cta")?.addEventListener("click", improveGuardian);
  qs(".btn-change")?.addEventListener("click", changeActivity);

  qsa(".actionbar .ab-btn").forEach((btn) => {
    const text = btn.textContent.trim().toUpperCase();
    if (text.includes("LOADOUTS")) btn.addEventListener("click", openLoadouts);
    else if (text.includes("COMPARE")) btn.addEventListener("click", openCompare);
    else if (text.includes("SAVE LOADOUT")) btn.addEventListener("click", saveLoadout);
    else if (text.includes("SHARE")) btn.addEventListener("click", shareLoadout);
    else {
      btn.addEventListener("click", () =>
        modal(
          "More",
          `<button type="button" class="beta-menu-item" id="betaSaved">VIEW SAVED BETA LOADOUTS</button>
           <button type="button" class="beta-menu-item" id="betaFeedback">BETA FEEDBACK INFO</button>`
        )
      );
    }
  });

  const view3d = qs(".view3d");
  if (view3d) {
    view3d.setAttribute("role", "button");
    view3d.setAttribute("tabindex", "0");
    view3d.addEventListener("click", () => betaUnavailable("View in 3D"));
  }

  const top = qsa(".top-icons .ib");
  top[0]?.addEventListener("click", () => toast("No new beta notifications"));
  top[1]?.addEventListener("click", () =>
    modal(
      "Beta Settings",
      "<p>Fixture mode is active. Live Bungie account settings will appear here after authentication is enabled.</p>"
    )
  );
  top[2]?.addEventListener("click", () =>
    modal(
      "Beta Help",
      "<p>Use CHARACTER or LOADOUTS to switch among the 23 beta fixtures. Hover sourced icons for Bungie details. Use SHARE to copy a fixture-specific link.</p>"
    )
  );

  qs(".gtag")?.addEventListener("click", () => betaUnavailable("Guardian Account"));

  document.addEventListener("astrix:guardian-selection-changed", () => {
    setTimeout(equaliseBottomPanels, 50);
  });
  window.addEventListener("resize", equaliseBottomPanels);
  setTimeout(equaliseBottomPanels, 250);
}

function installStyles() {
  if (qs("#astrixBetaReadinessStyle")) return;
  const style = document.createElement("style");
  style.id = "astrixBetaReadinessStyle";
  style.textContent = `
    .gear-weapons { align-self: stretch !important; }
    #astrixBetaToast {
      position: fixed;
      left: 50%;
      bottom: 78px;
      z-index: 300;
      transform: translate(-50%, 20px);
      opacity: 0;
      pointer-events: none;
      padding: 10px 16px;
      border: 1px solid rgba(158, 96, 255, 0.5);
      border-radius: 10px;
      background: #120d20;
      color: #fff;
      font: 600 13px Inter, sans-serif;
      box-shadow: 0 12px 40px #000;
      transition: 0.18s ease;
    }
    #astrixBetaToast.show {
      opacity: 1;
      transform: translate(-50%, 0);
    }
    .beta-modal-backdrop {
      position: fixed;
      inset: 0;
      z-index: 250;
      display: grid;
      place-items: center;
      padding: 24px;
      background: rgba(2, 2, 8, 0.78);
      backdrop-filter: blur(8px);
    }
    .beta-modal {
      width: min(760px, 94vw);
      max-height: 82vh;
      overflow: auto;
      border: 1px solid rgba(158, 96, 255, 0.34);
      border-radius: 16px;
      background: linear-gradient(180deg, #171022, #09070f);
      box-shadow: 0 30px 80px #000;
      color: #fff;
    }
    .beta-modal header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 18px 20px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }
    .beta-modal header small {
      font: 600 9px Orbitron, sans-serif;
      letter-spacing: 0.16em;
      color: #9e60ff;
    }
    .beta-modal h2 {
      margin: 4px 0 0;
      font: 700 18px Orbitron, sans-serif;
      letter-spacing: 0.08em;
    }
    .beta-modal header button {
      width: 36px;
      height: 36px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      color: #aaa;
      background: transparent;
      cursor: pointer;
    }
    .beta-modal-body { padding: 18px 20px; }
    .beta-modal footer {
      display: flex;
      justify-content: flex-end;
      padding: 0 20px 18px;
    }
    .beta-primary, .beta-menu-item {
      padding: 10px 14px;
      border: 1px solid rgba(158, 96, 255, 0.55);
      border-radius: 8px;
      background: rgba(158, 96, 255, 0.14);
      color: #fff;
      font: 700 11px Orbitron, sans-serif;
      letter-spacing: 0.08em;
      cursor: pointer;
    }
    .beta-note { color: #aaa; }
    .beta-loadout-list { display: grid; gap: 7px; }
    .beta-loadout-row {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 3px 16px;
      text-align: left;
      padding: 10px 12px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 9px;
      background: rgba(255, 255, 255, 0.02);
      color: #fff;
      cursor: pointer;
    }
    .beta-loadout-row span { color: #aaa; }
    .beta-loadout-row small {
      grid-column: 2;
      grid-row: 1 / 3;
      color: #7956b8;
      align-self: center;
    }
    .beta-loadout-row.active { border-color: #9e60ff; }
    .beta-compare-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .beta-compare-grid label {
      display: grid;
      gap: 5px;
      color: #aaa;
    }
    .beta-compare-grid select {
      padding: 9px;
      background: #0d0915;
      color: #fff;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 8px;
    }
    .beta-compare-result {
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: center;
      gap: 16px;
      margin-top: 18px;
    }
    .beta-compare-result div {
      display: grid;
      gap: 4px;
      padding: 12px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 9px;
    }
    .beta-compare-result span { color: #aaa; }
    .beta-rec-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .beta-rec-grid section, .beta-improvement {
      padding: 12px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.02);
    }
    .beta-rec-grid h3, .beta-improvement small {
      font: 700 10px Orbitron, sans-serif;
      letter-spacing: 0.1em;
      color: #a87aff;
    }
    .beta-activity-list {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
    }
    .beta-activity-list button {
      padding: 10px;
      border: 1px solid rgba(255, 255, 255, 0.09);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.025);
      color: #fff;
      cursor: pointer;
    }
    .beta-activity-list button.active { border-color: #9e60ff; }
    .beta-share-input {
      width: 100%;
      padding: 10px;
      background: #08060d;
      color: #fff;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 8px;
      box-sizing: border-box;
    }
    .beta-access-gate {
      position: fixed;
      inset: 0;
      z-index: 500;
      display: grid;
      place-items: center;
      background: radial-gradient(circle at 50% 30%, #1a1030, #05040a 68%);
    }
    .beta-access-card {
      width: min(430px, 90vw);
      padding: 28px;
      border: 1px solid rgba(158, 96, 255, 0.42);
      border-radius: 18px;
      background: rgba(14, 10, 24, 0.96);
      box-shadow: 0 30px 90px #000;
      text-align: center;
      color: #fff;
    }
    .beta-access-card h1 {
      font: 800 20px Orbitron, sans-serif;
      letter-spacing: 0.1em;
    }
    .beta-access-card p { color: #aaa; }
    .beta-access-card form { display: grid; gap: 10px; }
    .beta-access-card input {
      padding: 12px;
      border: 1px solid rgba(255, 255, 255, 0.13);
      border-radius: 9px;
      background: #08060d;
      color: #fff;
      text-align: center;
      letter-spacing: 0.15em;
    }
    .beta-access-card button {
      padding: 11px;
      border: 1px solid #9e60ff;
      border-radius: 9px;
      background: rgba(158, 96, 255, 0.18);
      color: #fff;
      font: 700 11px Orbitron, sans-serif;
      letter-spacing: 0.1em;
      cursor: pointer;
    }
    .beta-access-error {
      min-height: 18px;
      color: #ff7c8d;
    }
  `;
  document.head.appendChild(style);
}

function accessGate() {
  if (sessionStorage.getItem(STORAGE_KEY) === "granted") return Promise.resolve();
  return new Promise((resolve) => {
    const gate = document.createElement("div");
    gate.className = "beta-access-gate";
    gate.innerHTML = `
      <div class="beta-access-card">
        <small>ASTRIX PARADOX</small>
        <h1>GUARDIAN WORKSPACE BETA</h1>
        <p>Enter the tester access code.</p>
        <form>
          <input type="password" autocomplete="off" aria-label="Beta access code" placeholder="ACCESS CODE">
          <button type="submit">ENTER BETA</button>
          <div class="beta-access-error"></div>
        </form>
      </div>`;

    document.body.appendChild(gate);

    const form = qs("form", gate);
    const input = qs("input", gate);
    const error = qs(".beta-access-error", gate);

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (input.value.trim() === BETA_ACCESS_CODE) {
        sessionStorage.setItem(STORAGE_KEY, "granted");
        gate.remove();
        resolve();
      } else {
        error.textContent = "Access code not recognised.";
        input.select();
      }
    });

    setTimeout(() => input.focus(), 50);
  });
}

installStyles();
accessGate().then(wireControls);