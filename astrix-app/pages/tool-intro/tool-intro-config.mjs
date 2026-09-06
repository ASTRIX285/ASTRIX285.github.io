const TOOL_INTROS=Object.freeze({
  'destiny-2':Object.freeze({
    id:'destiny-2',
    gameName:'Destiny 2',
    developerName:'Bungie',
    eyebrow:'DESTINY 2 TOOL BRIEFING',
    title:'Forge Loader',
    purpose:'Forge Loader joins your verified Guardian inventory to the prepared Destiny 2 armour catalogue, then ranks legal combinations against the choices you make.',
    limitations:'Results depend on the inventory and definitions Bungie returns for your account. Recommendations stay in review until you explicitly choose a next action.',
    ctaLabel:'PREPARE FORGE LOADER',
    loadingLabel:'Preparing your verified data for a faster load.',
    keyArt:'/img/games/D2_JB.jpg',
    keyArtAlt:'Destiny 2 key art featuring the Traveler',
    developerLogo:'/img/brands/bungie-logo.svg',
    developerLogoAlt:'Bungie',
    disclaimer:'ASTRIX PARADOX is not officially affiliated with Bungie.'
  })
});

function toolIntroConfig(gameId){return TOOL_INTROS[gameId]||null;}

export {TOOL_INTROS,toolIntroConfig};
