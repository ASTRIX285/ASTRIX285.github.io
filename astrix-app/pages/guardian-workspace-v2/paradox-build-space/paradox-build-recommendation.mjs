const BUILD_ELEMENTS=Object.freeze(['arc','solar','strand','stasis','void','prismatic']);

function armourTierOf(item){
  const value=Number(item?.armourTier??item?.armourSemantics?.tier??item?.gearTier);
  return Number.isFinite(value)?value:null;
}

function verifiedMasterworkState(item){
  const semantics=item?.armourSemantics||{};
  const source=item?.masterwork??semantics.masterwork??null;
  const level=Number(item?.masterworkLevel??semantics.masterworkLevel);
  if(item?.isMasterworked===true||item?.masterworked===true)return 'MASTERWORK VERIFIED';
  if(source&&(/masterwork/i.test(String(source?.semanticRole||source?.name||source?.displayName||''))||Number.isFinite(level)))return 'MASTERWORK VERIFIED';
  return 'MASTERWORK NOT REPORTED';
}

function validateTierFiveArmour(build={}){
  const armour=Array.isArray(build.armour)?build.armour.filter(Boolean):[];
  const tiers=armour.map(armourTierOf);
  const complete=armour.length===5&&tiers.every(tier=>Number.isFinite(tier)&&tier>=5);
  const maximized=build?.forgeLoaderDecision?.ranking?.maximized===true;
  return {
    ready:complete&&maximized,
    complete,
    maximized,
    tiers,
    reason:armour.length!==5
      ?'Five exact armour instances are required.'
      :tiers.some(tier=>!Number.isFinite(tier))
        ?'A verified armour tier is missing.'
        :tiers.some(tier=>tier<5)
          ?'Generated builds require T5 armour in every slot.'
          :!maximized
            ?'Stage a Maximized Forge Loader result first.'
            :''
  };
}

export {BUILD_ELEMENTS,armourTierOf,verifiedMasterworkState,validateTierFiveArmour};
