#!/usr/bin/env python3
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LOADER = ROOT / "astrix-app/pages/guardian-workspace-v2/guardian-fixture-loader.mjs"
WORKSPACE = ROOT / "astrix-app/pages/guardian-workspace-v2/guardian-workspace-v2.mjs"

loader = LOADER.read_text(encoding="utf-8")

if 'beta-bungie-manifest-cache.json' not in loader:
    loader = loader.replace(
        'const IDENTITY_URL="../../data/paradox-forge/beta/beta-component-identities.json";',
        'const IDENTITY_URL="../../data/paradox-forge/beta/beta-component-identities.json";\n'
        'const MANIFEST_URL="../../data/paradox-forge/beta/beta-bungie-manifest-cache.json";'
    )

loader = loader.replace(
    'let fixtures=null;\nlet identities=null;\nlet byHash=new Map();',
    'let fixtures=null;\n'
    'let identities=null;\n'
    'let manifest=null;\n'
    'let byHash=new Map();\n'
    'let manifestByHash=new Map();'
)

resolve_pattern = re.compile(
    r'const resolve=hash=>\{.*?\n\};',
    re.S,
)

resolve_replacement = r'''function inferSourceKind(row){
  const itemType=Number(row?.itemType);
  if(itemType===3)return "weapon";
  if(itemType===2)return "armor";
  return "gameComponent";
}

function manifestIdentity(hash){
  const h=Number(hash);
  const row=manifestByHash.get(String(h));
  if(!row)return null;

  return {
    hash:h,
    bungieHash:h,
    name:row.display?.name||`Destiny item ${h}`,
    description:row.display?.description||"",
    icon:absIcon(row.display?.icon),
    itemType:row.itemType,
    itemSubType:row.itemSubType,
    itemTypeDisplayName:row.itemTypeDisplayName||"",
    classType:row.classType,
    itemCategoryHashes:row.itemCategoryHashes||[],
    traitIds:row.traitIds||[],
    equipmentSlotTypeHash:
      row.equippingBlock?.equipmentSlotTypeHash??null,
    ammoTypeCode:
      row.equippingBlock?.ammoType??null,
    intrinsicPlugHashes:
      row.intrinsicPlugHashes||[],
    sourceKind:inferSourceKind(row),
    identitySource:"bungie-current-manifest"
  };
}

const resolve=hash=>{
  const h=Number(hash);
  const legacy=byHash.get(String(h))??null;
  const official=manifestIdentity(h);

  if(legacy&&official){
    return {
      ...legacy,
      ...official,
      sourceKind:
        legacy.sourceKind
        ??official.sourceKind
    };
  }

  if(official)return official;
  if(legacy)return legacy;

  return {
    bungieHash:h,
    hash:h,
    name:`Unresolved Destiny item ${h}`,
    icon:"",
    unresolved:true
  };
};'''

loader, count = resolve_pattern.subn(resolve_replacement, loader, count=1)
if count != 1:
    raise SystemExit("Could not replace resolve() in guardian-fixture-loader.mjs")

ensure_pattern = re.compile(
    r'async function ensureData\(\)\{.*?\n\}',
    re.S,
)

ensure_replacement = r'''async function ensureData(){
  if(fixtures&&identities&&manifest)return;

  const [fr,ir,mr]=await Promise.all([
    fetch(FIXTURE_URL,{cache:"no-store"}),
    fetch(IDENTITY_URL,{cache:"no-store"}),
    fetch(MANIFEST_URL,{cache:"no-store"})
  ]);

  if(!fr.ok)throw new Error(`Fixture load failed: ${fr.status}`);
  if(!ir.ok)throw new Error(`Identity load failed: ${ir.status}`);
  if(!mr.ok)throw new Error(`Manifest cache load failed: ${mr.status}`);

  fixtures=await fr.json();
  identities=await ir.json();
  manifest=await mr.json();

  byHash=new Map(
    (identities.identities??[]).map(row=>{
      const h=Number(row.bungieHash);
      return [String(h),{
        ...row,
        hash:h,
        bungieHash:h,
        name:row.name??row.displayName??`Destiny item ${h}`,
        icon:absIcon(row.icon)
      }];
    })
  );

  manifestByHash=new Map(
    Object.entries(
      manifest.inventoryItems??{}
    ).map(([hash,row])=>[
      String(hash),
      row
    ])
  );
}'''

loader, count = ensure_pattern.subn(ensure_replacement, loader, count=1)
if count != 1:
    raise SystemExit("Could not replace ensureData() in guardian-fixture-loader.mjs")

marker = 'function normalizeFixture(fixture){'
helpers = r'''function bucketName(hash){
  return (
    manifest?.support?.buckets?.[String(hash)]?.display?.name
    ??""
  );
}

function enrichArmourItem(item,fixture){
  const official=manifestByHash.get(
    String(item.hash)
  )??null;

  const bucketHash=
    official?.equippingBlock?.equipmentSlotTypeHash
    ??item.equipmentSlotTypeHash
    ??null;

  const modsByBucket=
    fixture.rawDim?.parameters?.modsByBucket
    ??{};

  const modHashes=
    bucketHash!=null
      ?(modsByBucket[String(bucketHash)]??[])
      :[];

  const intrinsicHashes=
    official?.intrinsicPlugHashes
    ??[];

  const intrinsicTraits=
    intrinsicHashes
      .map(resolve)
      .filter(Boolean);

  return {
    ...item,
    equipmentSlotTypeHash:bucketHash,
    armorSlot:
      bucketName(bucketHash)
      ||item.armorSlot
      ||"",
    mods:modHashes.map(resolve),
    intrinsicTraits,
    intrinsicTrait:
      intrinsicTraits[0]
      ??null,
    rarity:
      item.rarity
      ??(
        intrinsicTraits.length
          ?"Exotic"
          :null
      )
  };
}

'''

if helpers not in loader:
    loader = loader.replace(marker, helpers + marker, 1)

old_armour = '''  const armour=equipped.filter(
    x=>x.sourceKind==="armor"
  );'''

new_armour = '''  const armour=equipped
    .filter(
      x=>x.sourceKind==="armor"
    )
    .map(
      item=>enrichArmourItem(
        item,
        fixture
      )
    );'''

if old_armour not in loader:
    raise SystemExit("Expected armour filter not found in guardian-fixture-loader.mjs")
loader = loader.replace(old_armour, new_armour, 1)

LOADER.write_text(loader, encoding="utf-8")

workspace = WORKSPACE.read_text(encoding="utf-8")

if 'field("Exotic trait"' not in workspace:
    target = 'resolved.mods.map(mod=>field("Armour mod",mod.name||mod)).join("")'
    replacement = (
        '(resolved.intrinsicTrait?field("Exotic trait",'
        'resolved.intrinsicTrait.name||"Intrinsic trait"): "")+'
        + target
    )

    if target in workspace:
        workspace = workspace.replace(target, replacement, 1)
    else:
        print("Warning: armour drawer mod renderer not found; loader data was still patched.")

WORKSPACE.write_text(workspace, encoding="utf-8")

print("Patched Guardian Workspace beta Bungie data integration.")
