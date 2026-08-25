// Deterministic Guardian semantic validation.
// This is the mechanical counterpart to Paradox Validator reasoning rules:
// unresolved/inactive evidence must never become a verified causal claim.

const failures=[];
const fail=message=>failures.push(message);

const listeners=new Map();
globalThis.document={
  addEventListener(type,fn){const rows=listeners.get(type)||[];rows.push(fn);listeners.set(type,rows);},
  dispatchEvent(){return true;},
  querySelector(){return null;},
  querySelectorAll(){return [];},
  getElementById(){return null;}
};
globalThis.CustomEvent=class{constructor(type,init={}){this.type=type;this.detail=init.detail;}};

const semantics=await import('../pages/guardian-workspace-v2/guardian-semantic-resolver.mjs');
const sets=await import('../pages/guardian-workspace-v2/guardian-armour-set-resolver.mjs');
const live=await import('../pages/guardian-workspace-v2/guardian-paradox-live-adapter.mjs');

// G1 — Armour semantic split and Infuse exclusion.
try{
  const plug=(hash,name,category,description='')=>({hash,name,description,definition:{plug:{plugCategoryIdentifier:category}}});
  const result=semantics.normaliseArmourSemantics({
    instance:{gearTier:5,energy:{energyType:1,energyTypeHash:2,energyCapacity:10,energyUsed:7}},
    plugs:[
      plug(1,'Infuse','armor.infusion'),
      plug(2,'Armour Masterwork Level 5','armor.masterworks'),
      plug(3,'General Mod','armor.mods.general'),
      plug(4,'General Mod 2','armor.mods.general'),
      plug(5,'Helmet Mod','armor.mods.helmet'),
      {...plug(5,'Helmet Mod','armor.mods.helmet'),socketIndex:5},
      {...plug(5,'Helmet Mod','armor.mods.helmet'),socketIndex:6},
      plug(6,'Bulwark','armor.masterworks.archetype'),
      plug(7,'Close Enough Exotic Armour Perk','armor.exotic.perk')
    ]
  });
  if(result.tier!==5)fail('G1: gear tier not normalized');
  if(result.energy?.capacity!==10||result.energy?.used!==7)fail('G1: energy budget not normalized');
  if(result.generalMods.length!==2||result.slotMods.length!==3)fail('G1: General/slot mods not separated or stacked socketed mods collapsed');
  if(!result.masterwork||!result.archetype||!result.exoticPerk)fail('G1: armour intrinsic families missing');
  if(result.discarded.length!==1||result.discarded[0].semanticRole!=='infuse')fail('G1: Infuse not excluded explicitly');
}catch(error){fail(`G1 threw: ${error.message}`);}

// G2 — Exact equipable set identity and activation thresholds.
try{
  const itemDefinition={equippingBlock:{equipableItemSetHash:500}};
  const payload={
    equipableItemSets:{
      '500':{hash:500,displayProperties:{name:'Luminopotent'},setPerks:[
        {requiredSetCount:2,sandboxPerkHash:2002},
        {requiredSetCount:4,sandboxPerkHash:2004}
      ]}
    },
    sandboxPerks:{
      '2002':{hash:2002,displayProperties:{name:'Ionic Overclock',description:'While Amplified, gain benefits.'}},
      '2004':{hash:2004,displayProperties:{name:'Shock and Clear',description:'Jolted final blows create an Ionic Trace.'}}
    }
  };
  const twoPieces=Array.from({length:2},(_,index)=>({hash:100+index,definition:itemDefinition}));
  const two=sets.resolveArmourSet(payload,twoPieces[0],twoPieces);
  if(two.identity?.name!=='Luminopotent'||two.equippedCount!==2)fail('G2: exact set identity/count failed');
  if(two.twoPiece?.active!==true||two.fourPiece?.active!==false)fail('G2: 2/4 piece activation threshold failed at two pieces');
  const fourPieces=Array.from({length:4},(_,index)=>({hash:100+index,definition:itemDefinition}));
  const four=sets.resolveArmourSet(payload,fourPieces[0],fourPieces);
  if(four.fourPiece?.active!==true)fail('G2: four-piece set bonus did not activate at four pieces');
}catch(error){fail(`G2 threw: ${error.message}`);}

// G3 — Catalyst completion and equipped activation are separate.
try{
  const catalyst={hash:22,name:'Catalyst',isEnabled:true,definition:{plug:{plugCategoryIdentifier:'weapon.catalyst'}}};
  const profile={itemComponents:{plugObjectives:{data:{abc:{objectivesPerPlug:{'22':[{complete:false,progress:3,completionValue:100}]}}}}}};
  const result=semantics.normaliseWeaponSemantics({profile,item:{itemInstanceId:'abc'},plugs:[catalyst]});
  if(result.catalyst?.progress?.completed!==false||result.catalyst?.progress?.active!==false)fail('G3: incomplete catalyst received active credit');
}catch(error){fail(`G3 threw: ${error.message}`);}

// G4 — Stat threshold is above 100, not merely at 100.
try{
  const stats=semantics.normaliseGuardianStats([['Grenade',110],['Weapons',105],['Health',100],['Class',95]]);
  if(!stats.Grenade.enhancedThresholdReached||!stats.Weapons.enhancedThresholdReached)fail('G4: >100 threshold missed');
  if(stats.Health.enhancedThresholdReached||stats.Class.enhancedThresholdReached)fail('G4: <=100 incorrectly marked enhanced');
}catch(error){fail(`G4 threw: ${error.message}`);}

// G5 — Artifact model keeps exactly the applied active perks presented to it.
try{
  const activePerks=Array.from({length:7},(_,index)=>({hash:3000+index,definition:{hash:3000+index}}));
  const result=semantics.validateArtifact({activePerks});
  if(result.activeCount!==7||result.uniqueActiveCount!==7||!result.noDuplicateActiveHashes)fail('G5: Artifact 7/7 integrity failed');
}catch(error){fail(`G5 threw: ${error.message}`);}

// G6 — Live adapter may use resolved perks, but cannot credit inactive catalysts.
try{
  const liveDetail={
    source:'bungie-live',characterId:'guardian-1',selectedLoadoutIndex:0,
    aspects:[],fragments:[],artifact:{activePerks:[{hash:31,name:'Applied Artifact',definition:{hash:31}}]},
    weapons:[{
      hash:40,name:'Weapon',description:'',
      weaponSemantics:{selectedPerks:[{hash:41,name:'Verified perk',description:'',definition:{hash:41}}]},
      catalyst:{hash:42,name:'Incomplete Catalyst',description:'grants jolt',definition:{hash:42},progress:{completed:false,active:false}}
    }],
    paradoxEvidence:{armour:[],artifact:[]},hashCoverage:{},statModel:{}
  };
  const adapted=live.adaptLiveGuardian(liveDetail);
  if(adapted.artifact?.perks?.length!==1)fail('G6: active Artifact perk not adapted');
  if(adapted.weapons?.[0]?.resolvedPerks?.some(row=>Number(row.perkHash)===42))fail('G6: inactive catalyst entered live engine evidence');
  if(!adapted.weapons?.[0]?.resolvedPerks?.some(row=>Number(row.perkHash)===41))fail('G6: resolved selected weapon perk missing');
  const analysis=live.analyzeLiveGuardian(liveDetail);
  if(analysis?.source!=='paradox-live-deterministic-engine'||analysis?.evidenceSource!=='bungie-live-resolved-only')fail('G6: live deterministic analysis contract failed');
}catch(error){fail(`G6 threw: ${error.message}`);}

// G7 — Unknown socket classifications remain unknown and incomplete.
try{
  const unknown={hash:999,name:'Mystery Socket',definition:{plug:{plugCategoryIdentifier:'future.unknown'}}};
  const result=semantics.normaliseArmourSemantics({plugs:[unknown]});
  if(result.complete||result.unknownPlugs.length!==1||result.generalMods.length||result.slotMods.length)fail('G7: unknown evidence was silently classified');
}catch(error){fail(`G7 threw: ${error.message}`);}

if(failures.length){
  console.error('GUARDIAN SEMANTIC VALIDATION FAILED:');
  failures.forEach(row=>console.error(`  ✗ ${row}`));
  process.exit(1);
}
console.log('GUARDIAN SEMANTIC VALIDATION PASSED.');
