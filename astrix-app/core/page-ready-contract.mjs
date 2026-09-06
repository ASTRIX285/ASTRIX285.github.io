const PAGE_VIEWS=Object.freeze({
  character:Object.freeze(['characters','equipped','inventory','saved-loadouts','subclasses','artifact']),
  'build-forge':Object.freeze(['characters','equipped','inventory','saved-loadouts','subclasses','artifact','manual-editor']),
  journey:Object.freeze(['destinations','titles','badges','triumphs','records','quests','dungeons-raids','guardian-rank','patterns-catalysts','stat-trackers']),
  vault:Object.freeze(['characters','inventory','postmaster','armour','weapons','optimiser']),
  loadout:Object.freeze(['characters','inventory','postmaster','armour','exotics','set-bonuses','saved-loadouts'])
});
const PAGE_PROFILE_DATA=Object.freeze({
  character:Object.freeze(['characters.data','profileInventory.data','profileProgression.data','characterInventories.data','characterProgressions.data','characterEquipment.data','characterLoadouts.data','itemComponents.instances.data','itemComponents.stats.data','itemComponents.sockets.data','itemComponents.reusablePlugs.data']),
  'build-forge':Object.freeze(['characters.data','profileInventory.data','profileProgression.data','characterInventories.data','characterProgressions.data','characterEquipment.data','characterLoadouts.data','itemComponents.instances.data','itemComponents.perks.data','itemComponents.stats.data','itemComponents.sockets.data','itemComponents.plugObjectives.data','itemComponents.reusablePlugs.data']),
  journey:Object.freeze(['characters.data','profileInventory.data','profileProgression.data','characterInventories.data','characterProgressions.data','characterActivities.data','characterEquipment.data','profilePresentationNodes.data','characterPresentationNodes.data','profileCollectibles.data','characterCollectibles.data','profileRecords.data','characterRecords.data','metrics.data','characterCraftables.data']),
  vault:Object.freeze(['characters.data','profileInventory.data','characterInventories.data','characterEquipment.data','itemComponents.instances.data','itemComponents.stats.data','itemComponents.sockets.data','itemComponents.reusablePlugs.data']),
  loadout:Object.freeze(['characters.data','profileInventory.data','characterInventories.data','characterEquipment.data','characterLoadouts.data','itemComponents.instances.data','itemComponents.stats.data','itemComponents.sockets.data','itemComponents.reusablePlugs.data'])
});
const GUARDIAN_STAT_HASHES=Object.freeze([2996146975,392767087,1943323491,1735777505,144602215,4244567218]);

const hasPath=(value,path)=>path.split('.').reduce((row,key)=>row?.[key],value)!==undefined;

function pagePayloadCoverage(payload,page){
  const expected=PAGE_VIEWS[page]||[];
  const actual=new Set(Array.isArray(payload?.pageReady?.views)?payload.pageReady.views:[]);
  const missingViews=expected.filter(view=>!actual.has(view));
  const missing=[...(Array.isArray(payload?.pageReady?.coverage?.missing)?payload.pageReady.coverage.missing:[]),...missingViews.map(view=>`view:${view}`)];
  if(payload?.pageReady?.page!==page)missing.unshift(`page:${page}`);
  if(payload?.pageReady?.coverage?.complete!==true)missing.unshift('coverage');
  if(!payload?.pageReady?.manifestVersion)missing.push('manifest-version');
  if(payload?.definitionCoverage?.complete!==true)missing.push('owned-item-definitions');
  if(GUARDIAN_STAT_HASHES.some(hash=>!payload?.statDefinitions?.[String(hash)]))missing.push('guardian-stat-definitions');
  for(const path of PAGE_PROFILE_DATA[page]||[])if(!hasPath(payload?.profile,path))missing.push(`profile:${path}`);
  if(page==='journey'){
    if(payload?.journeyCoverage?.complete!==true)missing.push('journey-public-catalogue');
    if(payload?.journeyAccountDefinitionCoverage?.complete!==true)missing.push('journey-account-definitions');
    if(payload?.preparedAccountData?.coverage?.complete!==true)missing.push('journey-account-history');
  }
  if((page==='character'||page==='build-forge')&&(!Array.isArray(payload?.artifactCatalog)||!payload.artifactCatalog.length))missing.push('artifact-catalogue');
  if(page==='build-forge'&&!Number.isInteger(Number(payload?.currentSeasonNumber)))missing.push('current-season');
  if(page==='loadout'){
    if(!payload?.forgeArmourIndex)missing.push('forge-armour-index');
    if(payload?.loadoutCoverage?.complete!==true)missing.push('loadout-acquisition-sources');
  }
  return {page,views:expected,missing:[...new Set(missing)],complete:missing.length===0};
}

function assertPreparedPagePayload(payload,page){
  const coverage=pagePayloadCoverage(payload,page);
  if(!coverage.complete)throw new Error(`Prepared ${page} data is incomplete: ${coverage.missing.join(', ')}`);
  return payload;
}

function renderablePagePayloadCoverage(payload,page){
  const missing=[];
  if(payload?.pageReady?.page!==page)missing.push(`page:${page}`);
  if(!payload?.pageReady?.manifestVersion)missing.push('manifest-version');
  if(payload?.pageReady?.definitionSource!=='prepared-bulk-manifest')missing.push('prepared-definition-source');
  if(!payload?.profile||typeof payload.profile!=='object')missing.push('profile');
  if(!payload?.profile?.characters?.data||typeof payload.profile.characters.data!=='object')missing.push('profile:characters.data');
  return {page,missing,complete:missing.length===0};
}

function assertRenderablePagePayload(payload,page){
  const coverage=renderablePagePayloadCoverage(payload,page);
  if(!coverage.complete)throw new Error(`Prepared ${page} data cannot render: ${coverage.missing.join(', ')}`);
  return payload;
}

export {GUARDIAN_STAT_HASHES,PAGE_PROFILE_DATA,PAGE_VIEWS,assertPreparedPagePayload,assertRenderablePagePayload,pagePayloadCoverage,renderablePagePayloadCoverage};
