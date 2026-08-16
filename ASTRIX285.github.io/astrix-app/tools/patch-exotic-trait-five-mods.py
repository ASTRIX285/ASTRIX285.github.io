#!/usr/bin/env python3
from pathlib import Path

root = Path("astrix-app/pages/guardian-workspace-v2")
module = root / "guardian-beta-armour-layout.mjs"
css = root / "guardian-workspace-v2-beta.css"

js = module.read_text(encoding="utf-8")
helper = 'function renderExoticTraitInline(card,item){\n  card.querySelector(".beta-exotic-trait-inline")?.remove();\n  card.classList.remove("has-beta-exotic-trait");\n\n  const trait=item?.intrinsicTrait;\n  if(!trait)return;\n\n  const name=trait.name??"Exotic intrinsic trait";\n  const description=trait.description??"";\n  const hash=trait.bungieHash??trait.hash??"";\n\n  card.classList.add("has-beta-exotic-trait");\n\n  const traitButton=document.createElement("button");\n  traitButton.type="button";\n  traitButton.className="beta-exotic-trait-inline";\n  traitButton.setAttribute(\n    "aria-label",\n    description ? `${name}. ${description}` : name\n  );\n  traitButton.dataset.traitHash=String(hash);\n\n  traitButton.title=[\n    name,\n    description,\n    hash ? `Bungie hash: ${hash}` : ""\n  ].filter(Boolean).join(" — ");\n\n  traitButton.innerHTML=iconMarkup(trait,name);\n\n  const mainImage=card.querySelector(\n    ":scope > img, :scope .armour-icon img, :scope .arm-icon img, :scope .item-icon img"\n  );\n\n  if(mainImage){\n    mainImage.insertAdjacentElement("afterend",traitButton);\n  }else{\n    card.prepend(traitButton);\n  }\n}\n\n'
marker = "function renderArmourDetails(armour=[]){"

if "function renderExoticTraitInline" not in js:
    if marker not in js:
        raise SystemExit("renderArmourDetails() not found.")
    js = js.replace(marker, helper + marker, 1)

old_blocks = [
'''    if(!item)return;

    const mods=[...(item.mods??[])];
    while(mods.length<6)mods.push(null);

    const functional=document.createElement("div");
    functional.className="beta-armour-functional";
    functional.innerHTML=`
      ${traitMarkup(item)}
      <div class="beta-armour-mod-heading">
        <span>ARMOUR MODS</span>
        <small>6 SLOTS</small>
      </div>
      <div class="beta-armour-mod-grid">
        ${mods.slice(0,6).map(modSlot).join("")}
      </div>
    `;''',
'''    if(!item)return;

    renderExoticTraitInline(card,item);

    const mods=[...(item.mods??[])];
    while(mods.length<6)mods.push(null);

    const functional=document.createElement("div");
    functional.className="beta-armour-functional";
    functional.innerHTML=`
      <div class="beta-armour-mod-heading">
        <span>ARMOUR MODS</span>
        <small>6 SLOTS</small>
      </div>
      <div class="beta-armour-mod-grid">
        ${mods.slice(0,6).map(modSlot).join("")}
      </div>
    `;'''
]

new_block = '''    if(!item)return;

    renderExoticTraitInline(card,item);

    const isExotic=Boolean(item?.intrinsicTrait);
    const slotCount=isExotic?5:6;

    const mods=[...(item.mods??[])];
    while(mods.length<slotCount)mods.push(null);

    const functional=document.createElement("div");
    functional.className="beta-armour-functional";
    functional.innerHTML=`
      <div class="beta-armour-mod-heading">
        <span>ARMOUR MODS</span>
        <small>${slotCount} SLOTS</small>
      </div>
      <div class="beta-armour-mod-grid ${isExotic?"is-exotic":""}">
        ${mods.slice(0,slotCount).map(modSlot).join("")}
      </div>
    `;'''

changed = False
for old in old_blocks:
    if old in js:
        js = js.replace(old, new_block, 1)
        changed = True
        break

if not changed and "slotCount=isExotic?5:6" not in js:
    raise SystemExit("Expected armour renderer block not found.")

module.write_text(js, encoding="utf-8")

block = '/* Exotic armour identity treatment: armour icon left, trait icon beside it */\n.arm-grid .arm {\n  position: relative;\n}\n\n.arm-grid .arm.has-beta-exotic-trait > img,\n.arm-grid .arm.has-beta-exotic-trait .armour-icon img,\n.arm-grid .arm.has-beta-exotic-trait .arm-icon img,\n.arm-grid .arm.has-beta-exotic-trait .item-icon img {\n  transform: translateX(-20px);\n}\n\n.beta-exotic-trait-inline {\n  position: absolute;\n  top: 18px;\n  left: calc(50% + 17px);\n  width: 42px;\n  height: 42px;\n  display: grid;\n  place-items: center;\n  padding: 3px;\n  margin: 0;\n  border: 1px solid rgba(232,194,91,.72);\n  border-radius: 7px;\n  background: rgba(18,13,7,.88);\n  box-shadow: 0 0 16px rgba(232,194,91,.12);\n  cursor: help;\n  z-index: 3;\n}\n\n.beta-exotic-trait-inline img {\n  width: 100%;\n  height: 100%;\n  object-fit: contain;\n  transform: none !important;\n}\n\n.beta-exotic-trait-inline:hover,\n.beta-exotic-trait-inline:focus-visible {\n  border-color: rgba(255,220,111,.95);\n  box-shadow: 0 0 18px rgba(255,220,111,.24);\n  outline: none;\n}\n\n/* Legendary armour = 6 mod slots. Exotic armour = 5 mod slots + intrinsic trait. */\n'
existing = css.read_text(encoding="utf-8") if css.exists() else ""

for prior_marker in (
    "/* Exotic armour identity treatment: trait sits beside armour icon */",
    "/* Exotic armour identity treatment: armour icon left, trait icon beside it */",
):
    if prior_marker in existing:
        existing = existing[:existing.index(prior_marker)].rstrip()

css.write_text(existing + "\n\n" + block.strip() + "\n", encoding="utf-8")

print("Updated Exotic armour presentation.")
print("Exotic armour: intrinsic trait beside icon + 5 mod slots.")
print("Legendary armour: 6 mod slots.")
