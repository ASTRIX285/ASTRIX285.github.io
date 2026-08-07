const FIXTURE_URL="../../data/paradox-forge/beta/ASTRIX_Paradox_Forge_Beta_Fixtures_v1.json";
const IDENTITY_URL="../../data/paradox-forge/beta/beta-component-identities.json";
const MANIFEST_URL="../../data/paradox-forge/beta/beta-bungie-manifest-cache.json";
const DEFAULT_FIXTURE_ID="PF-BETA-03";
const BUNGIE_ROOT="https://www.bungie.net";

let fixtures=null;
let identities=null;
let manifest=null;
let byHash=new Map();
let manifestByHash=new Map();

const absIcon=v=>{
  const s=String(v??"").trim();
  return !s?"":s.startsWith("http")?s:`${BUNGIE_ROOT}${s}`;
};

function inferSourceKind(row){
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
    equipmentSlotTypeHash:row.equippingBlock?.equipmentSlotTypeHash??null,
    ammoTypeCode:row.equippingBlock?.ammoType??null,
    uniqueLabelHash:row.equippingBlock?.uniqueLabelHash??null,
    intrinsicPlugHashes:row.intrinsicPlugHashes||[],
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
      sourceKind:legacy.sourceKind??official.sourceKind
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
};

async function ensureData(){
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
    Object.entries(manifest.inventoryItems??{}).map(([hash,row])=>[String(hash),row])
  );
}

function subclassParts(fixture){
  const subclassItem=(fixture.rawDim?.equipped??[])
    .find(x=>Number(x.hash)===Number(fixture.subclassHash));

  const socketHashes=Object.values(subclassItem?.socketOverrides??{});
  const parts=socketHashes.map(resolve);

  const out={
    super:null,
    classAbility:null,
    movement:null,
    melee:null,
    grenade:null,
    aspects:[],
    fragments:[]
  };

  for(const item of parts){
    switch(item.componentType){
      case "super": out.super=item; break;
      case "classAbility": out.classAbility=item; break;
      case "movementAbility": out.movement=item; break;
      case "melee": out.melee=item; break;
      case "grenade": out.grenade=item; break;
      case "aspect": out.aspects.push(item); break;
      case "fragment": out.fragments.push(item); break;
    }
  }

  return out;
}

function bucketName(hash){
  return manifest?.support?.buckets?.[String(hash)]?.display?.name??"";
}

function enrichArmourItem(item,fixture){
  const official=manifestByHash.get(String(item.hash))??null;

  const bucketHash=
    official?.equippingBlock?.equipmentSlotTypeHash
    ??item.equipmentSlotTypeHash
    ??null;

  /* DIM fixture appearance plugs are kept separate from functional mod slots. */
  const appearanceByBucket=fixture.rawDim?.parameters?.modsByBucket??{};
  const appearanceHashes=
    bucketHash!=null
      ?(appearanceByBucket[String(bucketHash)]??[])
      :[];

  const rarityText=String(item.rarity??item.tier??"").toLowerCase();
  const isExotic=
    item.isExotic===true
    ||rarityText.includes("exotic")
    ||Boolean(official?.equippingBlock?.uniqueLabelHash);

  const intrinsicHashes=isExotic
    ?(official?.intrinsicPlugHashes??[])
    :[];

  const intrinsicTraits=intrinsicHashes.map(resolve).filter(Boolean);

  return {
    ...item,
    equipmentSlotTypeHash:bucketHash,
    armorSlot:bucketName(bucketHash)||item.armorSlot||"",
    appearancePlugs:appearanceHashes.map(resolve),
    mods:[],
    isExotic,
    intrinsicTraits,
    intrinsicTrait:isExotic?(intrinsicTraits[0]??null):null,
    rarity:item.rarity??(isExotic?"Exotic":null)
  };
}

function normalizeFixture(fixture){
  const equipped=(fixture.rawDim?.equipped??[])
    .map(item=>({
      ...resolve(item.hash),
      socketOverrides:item.socketOverrides??null
    }));

  const subclass=subclassParts(fixture);

  const weapons=equipped.filter(x=>x.sourceKind==="weapon");

  const armour=equipped
    .filter(x=>x.sourceKind==="armor")
    .map(item=>enrichArmourItem(item,fixture));

  const artifactUnlocks=fixture.rawDim?.parameters?.artifactUnlocks??null;

  const artifact=artifactUnlocks?{
    seasonNumber:artifactUnlocks.seasonNumber??fixture.artifactSeason??null,
    perks:(artifactUnlocks.unlockedItemHashes??[]).map(resolve)
  }:null;

  const unresolvedHashes=(fixture.allDestinyHashes??[])
    .filter(h=>!manifestByHash.has(String(h))&&!byHash.has(String(h)));

  return {
    source:"paradox-beta-fixture",
    fixtureId:fixture.fixtureId,
    dimId:fixture.dimId,
    characterId:fixture.fixtureId,
    displayName:fixture.displayName,
    classType:fixture.classType,
    className:fixture.className,
    characterClass:String(fixture.className??"").toLowerCase(),
    subclass:String(fixture.element??"").toLowerCase(),
    subclassName:fixture.subclassName,
    subclassHash:fixture.subclassHash,
    subclassIdentity:resolve(fixture.subclassHash),
    subclassIcon:resolve(fixture.subclassHash)?.icon??"",
    super:subclass.super,
    classAbility:subclass.classAbility,
    movement:subclass.movement,
    melee:subclass.melee,
    grenade:subclass.grenade,
    abilities:[
      subclass.classAbility,
      subclass.movement,
      subclass.melee,
      subclass.grenade
    ].filter(Boolean),
    aspects:subclass.aspects,
    fragments:subclass.fragments,
    artifact,
    weapons,
    armour,
    armourModPool:(fixture.rawDim?.parameters?.mods??[]).map(resolve),
    beta:{
      evidenceStatus:fixture.evidenceStatus,
      resolved:(fixture.allDestinyHashes?.length??0)-unresolvedHashes.length,
      unresolved:unresolvedHashes.length,
      unresolvedHashes
    }
  };
}

export async function loadBetaFixture(id=DEFAULT_FIXTURE_ID){
  await ensureData();

  const fixture=(fixtures.fixtures??[]).find(
    f=>f.fixtureId===id||f.displayName===id
  );

  if(!fixture)throw new Error(`Unknown beta fixture: ${id}`);

  const detail=normalizeFixture(fixture);

  document.dispatchEvent(
    new CustomEvent("astrix:guardian-selection-changed",{detail})
  );

  document.dispatchEvent(
    new CustomEvent("astrix:beta-fixture-loaded",{detail})
  );

  return detail;
}

export async function listBetaFixtures(){
  await ensureData();

  return (fixtures.fixtures??[]).map(f=>({
    fixtureId:f.fixtureId,
    displayName:f.displayName,
    className:f.className,
    subclassName:f.subclassName,
    element:f.element
  }));
}

async function start(){
  try{
    await loadBetaFixture(DEFAULT_FIXTURE_ID);
  }catch(error){
    console.error("[Paradox beta fixture loader]",error);
  }
}

let started=false;

function startOnce(){
  if(started)return;
  started=true;
  start();
}

document.addEventListener(
  "astrix:guardian-workspace-ready",
  startOnce,
  {once:true}
);

if(document.readyState==="loading"){
  document.addEventListener(
    "DOMContentLoaded",
    ()=>setTimeout(startOnce,0),
    {once:true}
  );
}else{
  setTimeout(startOnce,0);
}

globalThis.ASTRIXBetaFixtures={
  load:loadBetaFixture,
  list:listBetaFixtures
};
