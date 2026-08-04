const PLAYER_POWER_CAP = 550;
const STAT_CAP = 200;

const ART = {
  crest: "https://www.bungie.net/common/destiny2_content/icons/32b112a9460e6f0e2b9ee15dc53fe1c1.png",
  super: {
    name: "Shadowshot: Moebius Quiver",
    icon: "https://www.bungie.net/common/destiny2_content/icons/986e8f2dd0699371d605a331bb63742a.png"
  },
  aspects: [
    { name: "Stylish Executioner", icon: "https://www.bungie.net/common/destiny2_content/icons/ed7f8c49b77fa46f4eec87a3c167c4b1.jpg" },
    { name: "Trapper's Ambush", icon: "https://www.bungie.net/common/destiny2_content/icons/e91760df2b81d191da9e2c62cb3fcda7.jpg" }
  ],
  fragments: [
    { name: "Echo of Persistence", icon: "https://www.bungie.net/common/destiny2_content/icons/914309029085289921f77d8207765150.jpg" },
    { name: "Echo of Undermining", icon: "https://www.bungie.net/common/destiny2_content/icons/b114e9d97c42a68b19ab7876a221b354.jpg" },
    { name: "Echo of Starvation", icon: "https://www.bungie.net/common/destiny2_content/icons/19219ecd56fef82e9ead65aed8fea63a.jpg" },
    { name: "Echo of Obscurity", icon: "https://www.bungie.net/common/destiny2_content/icons/7d711ce4bcfb264da29c289ff70b9876.jpg" }
  ],
  artifact: {
    name: "Implement of Curiosity",
    icon: "https://www.bungie.net/common/destiny2_content/icons/9a2c53359db42bf87f48304efe7cae7b.png",
    perks: [
      { name: "Anti-Barrier Hand Cannon", icon: "https://www.bungie.net/common/destiny2_content/icons/9a2c53359db42bf87f48304efe7cae7b.png" },
      { name: "Dielectric", icon: "https://www.bungie.net/common/destiny2_content/icons/2ba8a6fb47d9a36d8e5651bad5a86752.png" },
      { name: "Elemental Orbs: Arc", icon: "https://www.bungie.net/common/destiny2_content/icons/57df71b415811ddee77e55f4b95519aa.png" }
    ]
  }
};

const abilities = [
  { label: "SUPER", name: ART.super.name, icon: ART.super.icon, super: true },
  { label: "CLASS ABILITY", name: "Marksman Dodge", icon: "" },
  { label: "MOVEMENT", name: "Triple Jump", icon: "" },
  { label: "MELEE", name: "Smoke Bomb", icon: "" },
  { label: "GRENADE", name: "Vortex Grenade", icon: "" }
];

const stats = [
  ["Mobility", 100],
  ["Resilience", 42],
  ["Recovery", 70],
  ["Discipline", 101],
  ["Intellect", 28],
  ["Strength", 38]
];

const byId = id => document.getElementById(id);
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
})[character]);

function iconMarkup(url, alt) {
  return url
    ? `<img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" onerror="this.style.display='none'">`
    : '<span class="ph-glyph">◆</span>';
}

function renderVerifiedPreview() {
  byId("scCrest").src = ART.crest;

  byId("abilityList").innerHTML = abilities.map(ability => `
    <div class="ability-row">
      <span class="ico-badge ${ability.super ? "super" : ""}">${iconMarkup(ability.icon, ability.name)}</span>
      <div class="meta"><small>${escapeHtml(ability.label)}</small><b>${escapeHtml(ability.name)}</b></div>
    </div>
  `).join("");

  byId("aspectList").innerHTML = ART.aspects.map(aspect => `
    <div class="slot">
      <span class="ico-badge">${iconMarkup(aspect.icon, aspect.name)}</span>
      <span class="nm">${escapeHtml(aspect.name)}</span>
      <span class="cfg">⚙</span>
    </div>
  `).join("");

  byId("fragList").innerHTML = ART.fragments.map(fragment => `
    <div class="slot">
      <span class="ico-badge">${iconMarkup(fragment.icon, fragment.name)}</span>
      <span class="nm">${escapeHtml(fragment.name)}</span>
    </div>
  `).join("");

  byId("artName").textContent = ART.artifact.name;
  byId("artIcon").src = ART.artifact.icon;
  byId("artPerks").innerHTML = ART.artifact.perks.map(perk => `
    <img src="${escapeHtml(perk.icon)}" alt="${escapeHtml(perk.name)}" title="${escapeHtml(perk.name)}" onerror="this.style.display='none'">
  `).join("");

  const total = stats.reduce((sum, [, value]) => sum + value, 0);
  byId("statsRow").innerHTML = stats.map(([name, value]) => {
    const width = Math.min(100, (value / STAT_CAP) * 100);
    return `
      <div class="st">
        <span class="nm">${escapeHtml(name)}</span>
        <span class="bar"><i style="width:${width}%"></i></span>
        <span class="v">${value}</span>
      </div>
    `;
  }).join("") + `
    <div class="st total">
      <span class="nm">Total</span><span></span><span class="v">${total}</span>
    </div>
  `;

  byId("modsGrid").innerHTML = Array.from({ length: 9 }, () => `
    <div class="mod ph" title="Awaiting verified armour-mod plug data"><span class="ph-glyph">◆</span></div>
  `).join("");

  document.querySelectorAll("[data-power-cap]").forEach(element => {
    element.textContent = PLAYER_POWER_CAP;
  });

  const guardianRender = byId("guardianRender");
  guardianRender.addEventListener("error", () => {
    guardianRender.style.display = "none";
    guardianRender.nextElementSibling.style.display = "block";
  }, { once: true });
}

renderVerifiedPreview();
