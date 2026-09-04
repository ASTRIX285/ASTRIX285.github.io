// Lossless transport expansion. Legacy schema 4 remains readable.
export function expandForgeArmourIndex(index){
  if(Number(index?.schemaVersion)!==5)return index;
  if(index.transportEncoding!=='shared-definitions-v1')throw new Error('Unknown Forge index transport');
  const templates=(index.definitionTemplates||[]).map(row=>{
    const {qualityId,...template}=row;
    if(qualityId===undefined)return template;
    const quality=index.qualityDefinitions?.[qualityId];
    if(!Number.isInteger(qualityId)||!quality)throw new Error(`Missing Forge quality definition ${qualityId}`);
    return {...template,quality};
  }),entries=index.socketEntryDefinitions||[];
  const definitions=rows=>Object.fromEntries(Object.entries(rows||{}).map(([hash,row])=>{
    const {templateId,...identity}=row,template=templates[templateId];
    if(!Number.isInteger(templateId)||!template)throw new Error(`Missing Forge definition template ${templateId}`);
    return [hash,{...template,...identity}];
  }));
  const socketLayouts=Object.fromEntries(Object.entries(index.socketLayouts||{}).map(([key,row])=>{
    const {socketEntryIds,...layout}=row;
    if(!Array.isArray(socketEntryIds))throw new Error(`Missing Forge socket layout ${key}`);
    return [key,{...layout,socketEntries:socketEntryIds.map(id=>{
      if(!Number.isInteger(id)||!entries[id])throw new Error(`Missing Forge socket entry ${id}`);
      return entries[id];
    })}];
  }));
  const {transportEncoding,definitionTemplates,socketEntryDefinitions,qualityDefinitions,...metadata}=index;
  return {...metadata,schemaVersion:4,transportSchemaVersion:5,definitions:definitions(index.definitions),plugDefinitions:definitions(index.plugDefinitions),socketLayouts};
}
