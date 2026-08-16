#!/usr/bin/env python3
from pathlib import Path

root = Path("astrix-app/pages/guardian-workspace-v2")
workspace = root / "guardian-workspace-v2.mjs"
index = root / "index.html"
css = root / "guardian-workspace-v2-beta.css"

js = workspace.read_text(encoding="utf-8")
helper = 'function renderArmourFunctionalSlots(armour=[]){\n  const cards=[\n    ...document.querySelectorAll(".arm-grid .arm")\n  ];\n\n  cards.forEach((card,index)=>{\n    const item=armour[index]??null;\n\n    card.querySelector(".pf-mod-grid")?.remove();\n    card.querySelector(".pf-exotic-trait")?.remove();\n    card.classList.remove("pf-exotic-armour");\n\n    const previousPrimary=\n      card.querySelector(".pf-primary-armour-image");\n\n    if(previousPrimary){\n      previousPrimary.classList.remove(\n        "pf-primary-armour-image"\n      );\n    }\n\n    if(!item)return;\n\n    const trait=item?.intrinsicTrait??null;\n    const isExotic=Boolean(trait);\n    const slotCount=isExotic?5:6;\n\n    const primaryImage=card.querySelector("img");\n\n    if(primaryImage){\n      primaryImage.classList.add(\n        "pf-primary-armour-image"\n      );\n    }\n\n    if(isExotic){\n      card.classList.add("pf-exotic-armour");\n\n      const name=\n        trait.name\n        ??"Exotic intrinsic trait";\n\n      const description=\n        trait.description\n        ??"";\n\n      const hash=\n        trait.bungieHash\n        ??trait.hash\n        ??"";\n\n      const traitButton=\n        document.createElement("button");\n\n      traitButton.type="button";\n      traitButton.className="pf-exotic-trait";\n      traitButton.title=[\n        name,\n        description,\n        hash?`Bungie hash: ${hash}`:""\n      ].filter(Boolean).join(" — ");\n\n      traitButton.setAttribute(\n        "aria-label",\n        description\n          ?`${name}. ${description}`\n          :name\n      );\n\n      if(trait.icon){\n        const img=\n          document.createElement("img");\n\n        img.src=trait.icon;\n        img.alt=name;\n        img.onerror=()=>{\n          img.style.display="none";\n        };\n\n        traitButton.appendChild(img);\n      }else{\n        traitButton.textContent="✦";\n      }\n\n      card.appendChild(traitButton);\n    }\n\n    const grid=\n      document.createElement("div");\n\n    grid.className=\n      `pf-mod-grid ${\n        isExotic\n          ?"pf-mod-grid-exotic"\n          :"pf-mod-grid-legendary"\n      }`;\n\n    grid.setAttribute(\n      "aria-label",\n      `${slotCount} armour mod slots`\n    );\n\n    for(let i=0;i<slotCount;i+=1){\n      const slot=\n        document.createElement("div");\n\n      slot.className="pf-mod-slot";\n      slot.title=`Armour mod slot ${i+1}`;\n      slot.innerHTML=\n        \'<span aria-hidden="true">◇</span>\';\n\n      grid.appendChild(slot);\n    }\n\n    card.appendChild(grid);\n  });\n}\n\n'
anchor = "function bindArmourSlots(armour=[]){"

if "function renderArmourFunctionalSlots" not in js:
    if anchor not in js:
        raise SystemExit("bindArmourSlots() anchor not found.")
    js = js.replace(anchor, helper + anchor, 1)

old = '''function bindArmourSlots(armour=[]){
  const slots=[...document.querySelectorAll(".arm-grid .arm")];'''

new = '''function bindArmourSlots(armour=[]){
  renderArmourFunctionalSlots(armour);
  const slots=[...document.querySelectorAll(".arm-grid .arm")];'''

if old in js:
    js = js.replace(old, new, 1)
elif "renderArmourFunctionalSlots(armour);" not in js:
    raise SystemExit("bindArmourSlots() body not found.")

workspace.write_text(js, encoding="utf-8")

html = index.read_text(encoding="utf-8")
html = html.replace(
    '\n<script type="module" src="./guardian-beta-armour-layout.mjs"></script>',
    ''
)
html = html.replace(
    '<script type="module" src="./guardian-beta-armour-layout.mjs"></script>\n',
    ''
)
index.write_text(html, encoding="utf-8")

existing = css.read_text(encoding="utf-8") if css.exists() else ""
marker = "/* Paradox Forge armour functional layout - rendered by guardian-workspace-v2.mjs */"

if marker in existing:
    existing = existing[:existing.index(marker)].rstrip()

css.write_text(
    existing + "\n\n" + '/* Paradox Forge armour functional layout - rendered by guardian-workspace-v2.mjs */\n.arm-grid .arm {\n  position: relative !important;\n  overflow: visible !important;\n}\n\n.arm-grid .arm.pf-exotic-armour .pf-primary-armour-image {\n  transform: translateX(-25px) !important;\n}\n\n.pf-exotic-trait {\n  position: absolute !important;\n  top: 18px !important;\n  left: calc(50% + 20px) !important;\n  width: 48px !important;\n  height: 48px !important;\n  display: grid !important;\n  place-items: center !important;\n  padding: 4px !important;\n  border: 1px solid rgba(238,198,79,.78) !important;\n  border-radius: 7px !important;\n  background: rgba(18,13,7,.94) !important;\n  box-shadow: 0 0 16px rgba(238,198,79,.13) !important;\n  cursor: help !important;\n  z-index: 30 !important;\n}\n\n.pf-exotic-trait img {\n  width: 100% !important;\n  height: 100% !important;\n  object-fit: contain !important;\n  transform: none !important;\n}\n\n.pf-exotic-trait:hover,\n.pf-exotic-trait:focus-visible {\n  border-color: rgba(255,224,119,1) !important;\n  box-shadow: 0 0 20px rgba(255,224,119,.28) !important;\n  outline: none !important;\n}\n\n.pf-mod-grid {\n  width: 100% !important;\n  display: grid !important;\n  grid-template-columns: repeat(3,minmax(0,1fr)) !important;\n  gap: 4px !important;\n  margin-top: 7px !important;\n}\n\n.pf-mod-slot {\n  display: grid !important;\n  place-items: center !important;\n  aspect-ratio: 1 / 1 !important;\n  min-width: 0 !important;\n  border: 1px solid rgba(151,107,255,.34) !important;\n  border-radius: 5px !important;\n  background:\n    linear-gradient(\n      145deg,\n      rgba(87,52,142,.18),\n      rgba(15,11,27,.58)\n    ) !important;\n}\n\n.pf-mod-slot span {\n  font-size: 12px !important;\n  opacity: .42 !important;\n}\n'.strip() + "\n",
    encoding="utf-8"
)

print("Integrated armour functional UI into guardian-workspace-v2.mjs.")
print("Removed separate guardian-beta-armour-layout.mjs script dependency.")
print("Exotic armour: Bungie trait beside armour icon + 5 functional mod slots.")
print("Legendary armour: 6 functional mod slots.")
