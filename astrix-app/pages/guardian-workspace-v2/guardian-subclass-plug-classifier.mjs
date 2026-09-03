const clean=value=>String(value||'').trim().toLowerCase();

const RULES=[
  ['super',['super','supers']],
  ['classAbility',['class_abilit','classabilit']],
  ['movementAbility',['movement','jump','lift','glide']],
  ['melee',['melee']],
  ['grenade',['grenade']],
  ['aspect',['aspect']],
  ['fragment',['fragment']]
];

function categoryOf(plug){
  return clean(plug?.definition?.plug?.plugCategoryIdentifier);
}

function categoryComponent(category){
  if(!category)return '';
  for(const [type,tokens] of RULES){
    if(tokens.some(token=>category===token||category.includes(token)))return type;
  }
  return '';
}

function explicitComponent(plug){
  const explicit=clean(plug?.componentType??plug?.definition?.componentType);
  const aliases={classability:'classAbility',class_ability:'classAbility',movement:'movementAbility',movementability:'movementAbility',movement_ability:'movementAbility'};
  if(aliases[explicit])return aliases[explicit];
  return RULES.some(([type])=>type.toLowerCase()===explicit)?RULES.find(([type])=>type.toLowerCase()===explicit)[0]:'';
}

function fallbackComponent(plug){
  const identity=[
    plug?.itemTypeDisplayName,
    plug?.definition?.itemTypeDisplayName,
    plug?.socketCategoryDefinition?.displayProperties?.name,
    plug?.name,
    plug?.definition?.displayProperties?.name,
    ...(plug?.definition?.traitIds||[])
  ].filter(Boolean).join(' ').toLowerCase();
  if(/\bclass[ _-]?abilit/.test(identity))return'classAbility';
  if(/\bmovement\b|\bjump\b|\blift\b|\bglide\b/.test(identity))return'movementAbility';
  if(/\bsupers?\b|super[ _-]?ability/.test(identity))return'super';
  if(/\bgrenades?\b/.test(identity))return'grenade';
  if(/\bmelee\b/.test(identity))return'melee';
  if(/\baspects?\b/.test(identity))return'aspect';
  if(/\bfragments?\b/.test(identity))return'fragment';
  return'';
}

function subclassPlugComponent(plug){
  return explicitComponent(plug)||categoryComponent(categoryOf(plug))||fallbackComponent(plug);
}

export {categoryOf,subclassPlugComponent};
