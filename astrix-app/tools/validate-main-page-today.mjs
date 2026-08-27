import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const ROOT=new URL('../pages/guardian-workspace-v2/',import.meta.url);
const read=path=>readFile(new URL(path,ROOT),'utf8');
const [workspace,workspaceHtml,loader,profile,auth,sessionCache,formationModule,formationCss,superSync,sharedRailCss,gearModule,gearCss,characterModule,characterCss,artifact,loadoutsModule,loadoutsCss,handoff,buildHtml,buildModule,buildCss,tokenPreview,portalCss,portalController]=await Promise.all([
  read('guardian-workspace-v2.mjs'),read('index.html'),read('guardian-portal-progress.mjs'),read('guardian-bungie-profile.mjs'),
  read('guardian-bungie-auth.mjs'),read('guardian-session-cache.mjs'),
  read('guardian-super-formation.mjs'),read('guardian-super-formation.css'),read('guardian-super-feature-sync.mjs'),read('guardian-left-rail-shared.css'),read('guardian-gear-layout.mjs'),
  read('guardian-gear-layout.css'),read('guardian-character-cards.mjs'),read('guardian-character-cards.css'),
  read('guardian-artifact.mjs'),read('guardian-loadouts.mjs'),read('guardian-layout-final.css'),read('paradox-build-space-handoff.mjs'),
  read('paradox-build-space/index.html'),read('paradox-build-space/paradox-build-space.mjs'),read('paradox-build-space/paradox-build-space.css'),
  read('astrix-token-branch-preview.css'),read('../../shared/astrix-portal-loader.css'),read('../../shared/astrix-portal-loader.js')
]);
const interceptor=await read('guardian-semantic-interceptor.mjs');

assert.match(workspace,/astrix:guardian-render-complete/,'Main must publish render completion');
assert.match(workspace,/Promise\.all\(images\.map\(settleImage\)\)/,'Main render completion must wait for visible images');
assert.match(loader,/astrix:guardian-render-complete/,'Loader must finish from the render event');
assert.doesNotMatch(loader,/window\.addEventListener\('load'[\s\S]*?finish/,'Loader must not finish on window load');
assert.doesNotMatch(loader,/setTimeout\(finish/,'Loader must not finish from an arbitrary timeout');
assert.match(loader,/requestAnimationFrame\(\(\)=>requestAnimationFrame\(\(\)=>loader\?\.done\(\)\)\)/,'Main portal must clear only after the render-complete paint');
assert.match(loader,/else set\(8,'Bungie authentication required'\)/,'An unauthenticated local session must remain behind the Bungie authentication gate');
assert.match(loader,/currentSession=window\.ASTRIX_BUNGIE_SESSION[\s\S]*?guardianRenderComplete/,'Main portal must reconcile Guardian state if startup completed before listener registration');
assert.ok(workspaceHtml.indexOf('guardian-portal-progress.mjs')<workspaceHtml.indexOf('guardian-workspace-v2.mjs'),'Main portal progress must start listening before Guardian modules run');
assert.match(portalCss,/body\.apx-loading\{overflow:hidden!important\}/,'Shared portal must preserve page scroll locking above page-specific layout rules');
assert.match(portalCss,/@media\(prefers-reduced-motion:reduce\)/,'Shared portal must honour reduced motion');
assert.match(portalController,/role="status" aria-live="polite"/,'Shared portal must retain its accessible live status');
assert.match(portalController,/APX_SKIP_PORTAL===true/,'Shared portal must support the explicit cached Guardian fast-return path');
assert.match(portalController,/authRequired:authRequired/,'Shared portal must expose its full-screen Bungie authentication state');
assert.match(portalController,/function done\(\)\{if\(pendingAuthUrl\)return/,'The application must not appear before Bungie authentication completes');
assert.match(portalCss,/\.apx-auth-panel/,'The shared portal must visibly own the Bungie authentication gate');

assert.match(auth,/readCachedBungieSession/,'Bungie authentication must reuse the current tab session');
assert.match(auth,/if\(session\?\.authenticated\)\{[\s\S]*?cacheBungieSession\(session\)[\s\S]*?authResolved[\s\S]*?else\{[\s\S]*?authRequired\?\.\(authStartUrl\(\)\)/,'Bungie authentication must silently reuse a valid connection and gate only a genuinely disconnected user');
assert.match(profile,/readCachedBungieProfile/,'Guardian profile must reuse the current authenticated session snapshot');
assert.match(profile,/readCachedBungieLoadoutDetail/,'Selected Bungie loadout detail must survive Main and Build navigation');
assert.match(sessionCache,/indexedDB\.open\(DB_NAME,DB_VERSION\)/,'Guardian session data must use browser storage capable of holding the full Bungie profile');
assert.match(sessionCache,/PROFILE_TTL_MS=12\*60\*60\*1000/,'Cached Guardian evidence must survive the complete browser work session');
assert.match(profile,/PROFILE_REQUEST_TIMEOUT_MS=60_000/,'Authenticated Bungie profile resolution must allow manifest enrichment to finish');
assert.match(profile,/return ensureLiveProfile\(session,\{background:false,silent:false\}\)/,'Authenticated profile recovery must issue one visible request rather than duplicate retries');
assert.doesNotMatch(profile,/ensureLiveProfile\(globalThis\.ASTRIX_BUNGIE_SESSION\|\|null/,'Profile bootstrap must not make an unauthenticated profile request before session resolution');

assert.match(profile,/resolveArtifactByProvenance/,'Artifact provenance resolver must be wired into the live profile');
assert.match(profile,/SELECTED_LOADOUT_KEY/,'Selected Bungie loadout must be persisted as the page default');
assert.match(profile,/rememberLoadoutSelection\(characterId,index\)/,'Loadout selection must update the persisted default');
assert.match(profile,/Selected \$\{expected\} card resolved \$\{detail\.characterClass\}/,'Character class mismatch must fail loudly');
assert.match(profile,/character selection cannot fall back to last played/,'Missing roster must not silently fall back');
assert.match(profile,/transcendenceSlots=transcendenceOptions\.slice\(0,2\)/,'Prismatic Transcendence must retain its exact equipped socket mapping');
assert.match(profile,/itemType==="utility ability"\|\|itemType==="prismatic grenade"/,'Prismatic Transcendence must capture both the utility ability and equipped Prismatic grenade');
assert.match(workspaceHtml,/id="mainTranscendence"[\s\S]*?hidden/,'Main must contain a deterministic Prismatic-only Transcendence field');
assert.match(superSync,/if\(!isPrismatic\)[\s\S]*?block\.hidden=true/,'Main Transcendence must be hidden for non-Prismatic subclasses');
assert.match(superSync,/Array\.from\(\{length:2\}/,'Prismatic Main must preserve both verified Transcendence sockets');

assert.match(formationModule,/\['equipped','alternate-5','alternate-4','alternate-3','alternate-2','alternate-1'\]/,'Partial Supers must fill bottom, right, left, then up');
assert.match(formationModule,/slot\.hidden=false/,'All six PSD Super frames must remain visible');
assert.match(formationModule,/is-empty-super/,'Unresolved Super slots must be explicit transparent frames');
assert.match(formationModule,/dataset\.superCount='6'/,'The exact six-slot PSD geometry must remain stable');
assert.match(formationModule,/dataset\.resolvedSuperCount/,'Resolved Super count must remain separately observable');
assert.match(formationModule,/document\.documentElement\.dataset\.subclass=key/,'Equipped subclass must theme both Main and Build');
assert.match(formationCss,/--super-equipped-bevel:3px/,'Equipped Super needs the softened bevel');
assert.match(formationCss,/--super-alternate-bevel:1px/,'Alternate Supers need the softened bevel');
assert.match(formationCss,/\.super-feature\{[\s\S]*?--super-accent:var\(--gold,#E0A94E\)/,'Unresolved Super borders must match the chassis gold');
assert.match(formationCss,/border:var\(--super-bevel-size\) solid/,'Super bevel thickness must use the shared size token');
assert.doesNotMatch(formationCss,/data-super-count="[1-5]"/,'Partial-count geometry must not collapse the six-slot PSD frame');
assert.match(formationModule,/image\.dataset\.bungieArtworkSource='DestinyInventoryItemDefinition'/,'Every resolved Super must retain Bungie artwork provenance');
assert.match(formationModule,/image\.src=src/,'Resolved Supers must load Bungie artwork directly instead of a copied local asset');
assert.match(profile,/subclassCatalog=subclassItems\.map/,'Guardian profile must expose the account-unlocked subclass catalogue');
assert.match(profile,/super:superItem\|\|null/,'Equipped Super must come only from the exact resolved Bungie socket');
assert.doesNotMatch(profile,/super:superItem\|\|superOptions\[0\]/,'An available Super must never be guessed as equipped');
assert.match(superSync,/subclassOptions:catalog,onSelect:/,'Character subclass picker must repaint the verified Super formation');
assert.match(buildModule,/subclassOptions:resolvedSubclassOptions\(build\),selectKind:'subclass'/,'Build subclass picker must stage the selected verified subclass');
assert.match(formationCss,/\.super-diamond>span>img[\s\S]*?object-fit:cover!important/,'Bungie Super art must fill each diamond through its inner bevel');
assert.match(formationCss,/\.super-diamond--equipped>span\{[\s\S]*?inset:-20\.7107%!important;[\s\S]*?width:141\.4214%!important;[\s\S]*?height:141\.4214%!important/,'Equipped Super artwork must reach the rotated diamond edge');

assert.match(gearModule,/armour-set-bonus-icon/,'Resolved armour set icon must sit with the armour image');
assert.match(gearModule,/armour-archetype-icon/,'The shared Main armour-type icon overlay is missing');
assert.match(gearModule,/function armourModSequence\(item, armourTier, archetype\)/,'Main and Build must share one exact armour slot contract');
assert.match(gearModule,/return \[masterwork, \.\.\.clean\(generalSource\)\.slice\(0, 2\), \.\.\.clean\(slotSource\)\.slice\(0, 3\)\]/,'Armour slots must remain one masterwork, two general mods and three armour-type mods');
assert.match(gearModule,/!isArmourTypeSymbol\(plug\) && !isIgnoredArmourPlug\(plug\)/,'Archetype, Infuse and exotic perk symbols must never enter the mod grid');
assert.match(gearModule,/classifyArmourPlug\(plug\) === role/,'Cached Bungie socket definitions must recover their semantic mod roles');
assert.match(gearModule,/rawMatches\.length \? rawMatches : socketPlugs\.filter/,'Cached raw mods must take priority without duplicating fallback socket plugs');
assert.match(interceptor,/cachedGeneralMods[\s\S]*?generalMods\.length>=cachedGeneralMods\.length[\s\S]*?slotMods\.length>=cachedSlotMods\.length/,'Semantic enrichment must retain the more complete Bungie mod evidence');
assert.match(interceptor,/resolvedFunctionalMods\.length[\s\S]*?: cachedMods/,'Semantic enrichment must never erase the cached Bungie mod list');
assert.match(gearModule,/manifestExoticPerk = item\?\.armourSemantics\?\.exoticPerk \?\? item\?\.exoticPerk \?\? item\?\.intrinsicTrait/,'Manifest exotic perk must stay on the armour piece even without a cached rarity flag');
assert.match(gearModule,/armour-season-icon/,'The shared Main season/source emblem is missing');
assert.match(gearModule,/armourTier \?\? item\?\.armourSemantics\?\.tier \?\? item\?\.gearTier/,'Armour tier must retain the Bungie instance fallback');
assert.match(gearModule,/https:\/\/www\.bungie\.net/,'Relative Bungie armour artwork paths must resolve against Bungie');
assert.match(gearModule,/is-set-2-active/,'2-piece active state must reach the card');
assert.match(gearModule,/is-set-4-active/,'4-piece active state must reach the card');
assert.match(gearCss,/\.gear-slot\.is-set-2-active/,'2-piece card highlight is missing');
assert.match(gearCss,/\.gear-slot\.is-set-4-active/,'4-piece card highlight is missing');
assert.match(gearCss,/height:108px!important/,'Armour and weapon portrait rows must be taller');
assert.match(gearCss,/\.gear-mod\.is-masterwork-gold\{[^}]*border:1px solid rgba\(142,34,48,\.94\)[^}]*outline:2px solid #f0d55e!important/,'Level-five masterwork must retain the 2px outer crimson/gold stroke');
assert.match(gearCss,/weapon-perk-strip\{[^}]*border:0[^}]*background:transparent/,'Selected perks must not sit inside a blue container');
assert.match(gearCss,/weapon-support-icon\{width:var\(--pf-mod-size,36px\);height:var\(--pf-mod-size,36px\)/,'Weapon mod/masterwork icons must match armour mod size');

assert.match(characterModule,/emblemBackground = character\.emblem\?\.background/,'Hero card must use the Bungie emblem background');
assert.match(characterCss,/var\(--character-emblem\) left center\/cover no-repeat/,'The Bungie emblem banner must fill the complete rounded card without distorting or cropping its left-side icon');
assert.match(characterCss,/\.guardian-character-cards\{[\s\S]*?gap:5px;/,'Desktop character-card spacing must be reduced by 50 percent');
assert.match(characterCss,/\.guardian-character-card__identity\{[\s\S]*?left:34px;[\s\S]*?right:50px;/,'Character identity text must move another 10px right');
assert.match(characterCss,/\.guardian-character-card__stats\{[\s\S]*?left:39px;[\s\S]*?right:4px;/,'Character stat overlay must preserve the emblem with the requested additional 15px inset');
assert.match(characterCss,/\.guardian-character-card\.is-selected::after\{[^}]*opacity:\.1/,'Selected character overlay must remain 90 percent transparent');
assert.match(characterCss,/\.guardian-character-card\.is-selected::before\{opacity:\.48;filter:saturate\(\.48\) brightness\(\.68\)\}/,'Selected card artwork must use the approved passive treatment');
assert.match(characterCss,/0 18px 34px -14px rgba\(104,190,255,\.72\)/,'Selected card must use a restrained glow behind the card');
assert.match(profile,/\["Weapons",2996146975[\s\S]*?\["Health",392767087[\s\S]*?\["Class",1943323491[\s\S]*?\["Grenade",1735777505[\s\S]*?\["Super",144602215[\s\S]*?\["Melee",4244567218/,'The six current Destiny stat definitions must retain Bungie order');
assert.doesNotMatch(characterCss,/guardian-stat-icons\.png/,'Guardian cards must not use the removed reference-image sprite');
assert.match(characterModule,/class="guardian-stat-icon" src="\$\{escapeHtml\(icon\)\}"/,'Guardian cards must render the Bungie-provided stat icon URL');
assert.match(profile,/DestinyStatDefinition identities from Bungie/,'Guardian stat identities must document their Bungie manifest provenance');
assert.match(profile,/bc69675acdae9e6b9a68a02fb4d62e07/,'Weapons must use Bungie DestinyStatDefinition artwork');
assert.doesNotMatch(characterModule,/guardian-character-card__head[^\n]*<small>/,'Guardian cards must not render a title subtitle');
assert.match(characterCss,/grid-template-columns:repeat\(3,minmax\(0,300px\)\)/,'Main and Build must share the contained character-card ribbon');
assert.match(buildHtml,/id="backToGuardian"/,'Build Design must retain the Back button');
assert.match(buildCss,/\.build-back-btn\{min-height:28px;padding:5px 10px/,'Build Design Back button styling must remain independent of armour layout');
assert.doesNotMatch(workspaceHtml,/guardian-resolution-adaptive\.css/,'Main must not load the rejected broad resize override');
assert.doesNotMatch(buildHtml,/guardian-resolution-adaptive\.css/,'Build must not load the rejected broad resize override');
assert.match(artifact,/NO ACTIVE PERKS REPORTED BY BUNGIE/,'A resolved zero-perk Artifact must show an explicit Bungie state');
assert.match(artifact,/ARTIFACT STATE UNAVAILABLE/,'An unresolved Artifact must remain explicit');
assert.match(loadoutsCss,/background-image:var\(--loadout-color-image/,'Saved loadout must retain its Bungie colour image');
assert.match(loadoutsCss,/guardian-loadout-icon\{width:var\(--pf-mod-size,36px\)/,'Loadout icon must match armour mod size');
assert.match(loadoutsModule,/data-bungie-icon-hash/,'Rendered loadouts must retain Bungie iconHash provenance');
assert.match(loadoutsModule,/data-bungie-color-hash/,'Rendered loadouts must retain Bungie colorHash provenance');
assert.match(handoff,/latestGuardian&&Number\.isInteger\(latestGuardian\.selectedLoadoutIndex\)/,'Improve My Guardian must prefer the active selected loadout');
assert.match(handoff,/loadoutsAvailable:detail\.loadoutsAvailable===true/,'Build handoff must carry the exact Bungie in-game loadout catalogue');
assert.match(handoff,/super:detail\.super\|\|null/,'Build handoff must preserve fixture and legacy subclass fields without an empty subclassBuild');
assert.match(handoff,/subclassCatalog:clone\(detail\.subclassCatalog\|\|\[\]\)/,'Build handoff must preserve verified subclass choices');
assert.match(handoff,/markGuardianFastReturn\(\);location\.href='\.\/paradox-build-space\/'/,'Main to Build must reuse the authenticated cached navigation path');

assert.match(buildHtml,/data-guardian-profile-mode="roster-only"/,'Build Tool must load the roster without replacing its protected snapshot');
assert.match(buildHtml,/id="guardianCharacterCards"/,'Build Tool character cards are missing');
assert.match(buildHtml,/class="panel build-rail guardian-left-rail"/,'Build Tool must mount the shared Main left rail');
assert.match(buildHtml,/id="guardianLoadouts"/,'Build Tool in-game loadout selector is missing');
assert.match(workspaceHtml,/<section class="eq guardian-loadouts-container"[\s\S]*?id="guardianLoadouts"[\s\S]*?<\/section>\s*<section class="eq gear-combined">/,'Main in-game loadouts must be a separate container directly above Armour & Mods');
assert.doesNotMatch(workspaceHtml,/<section class="eq gear-combined">[\s\S]*?id="guardianLoadouts"/,'Main Armour & Mods must not contain the in-game loadout tray');
assert.match(buildHtml,/<section class="design-section loadouts-design-section"[\s\S]*?id="guardianLoadouts"[\s\S]*?<\/section>\s*<section class="design-section armour-design-section">/,'Build in-game loadouts must be a separate container directly above Armour & Mods');
assert.doesNotMatch(buildHtml,/<section class="design-section armour-design-section">[\s\S]*?id="guardianLoadouts"/,'Build Armour & Mods must not contain the in-game loadout tray');
assert.match(buildHtml,/id="artifactPickerPanel"[\s\S]*?hidden/,'Build Artifact catalogue must stay collapsed behind the equipped summary');
assert.match(buildModule,/import '\.\.\/guardian-character-cards\.mjs(?:\?[^']+)?'/,'Build Tool must reuse the Main character-card renderer');
assert.match(buildModule,/import '\.\.\/guardian-loadouts\.mjs'/,'Build Tool must reuse the Main in-game loadout renderer');
assert.match(buildModule,/import '\.\.\/guardian-bungie-profile\.mjs(?:\?[^']+)?'/,'Build Tool must reuse strict Main character selection');
assert.match(buildModule,/createBuildState\(detail\)/,'Selected Build Tool character must create a new protected build snapshot');
assert.match(buildModule,/import \{armourCard\} from '\.\.\/guardian-gear-layout\.mjs(?:\?[^']+)?'/,'Build Armour must import the shared Main card renderer');
assert.match(buildModule,/function renderBuildGear\(build=\{\}\)[\s\S]*?renderWeapons/,'Build Weapons must route through the shared Main renderer');
assert.match(buildModule,/astrix:guardian-loadout-context/,'Build must bind its protected snapshot to the shared loadout selector');
assert.match(buildModule,/resolvedOptions\(build,'artifact'\)\.slice\(0,6\)/,'Build Artifact catalogue must use the specified 2-2-2 six-card field');
assert.match(buildModule,/astrix:build-render-complete/,'Build Tool must publish render completion');
assert.match(buildModule,/window\.AstrixLoader\?\.set\(percent\)/,'Build milestones must drive the shared portal');
assert.doesNotMatch(buildModule,/buildLoadingGate|data\.litEdges|data-lit-edges/,'Build must not retain the legacy loader controller');
assert.match(loadoutsModule,/pendingIndex=index;[\s\S]*?astrix:loadout-selected/,'A selected Bungie loadout must show pending state before it loads');
assert.doesNotMatch(loadoutsModule,/activeIndex=index;[\s\S]*?astrix:loadout-selected/,'A loadout must not become active before Bungie returns the exact slot');
assert.match(loadoutsModule,/astrix:loadout-error[\s\S]*?pendingIndex=null/,'A failed loadout request must restore the previous committed selection');
assert.match(gearModule,/const MAIN_MOD_TILE_SIZE = "var\(--pf-slot,52px\)"/,'Main and Build must inherit the exact shared socket size');
assert.doesNotMatch(buildCss,/\.design-canvas \.gear-combined \.gear-columns/,'Build must not override the Main armour-card grid');
assert.doesNotMatch(buildCss,/\.design-canvas \.gear-combined \.gear-slot\{/,'Build must not override Main armour-card dimensions or padding');
assert.match(sharedRailCss,/--guardian-square:clamp\(40px,3\.2vw,64px\);[\s\S]*?--guardian-square-gap:6px;[\s\S]*?--guardian-square-radius:6px;/,'Guardian square dimensions must have one shared responsive token source');
assert.match(gearCss,/\.gear-mods\{display:grid;grid-template-columns:repeat\(3,var\(--guardian-square\)\);grid-template-rows:repeat\(2,var\(--guardian-square\)\);grid-auto-flow:row;gap:var\(--guardian-square-gap\)/,'Character and Build armour mods must share one 2-row by 3-column grid');
assert.doesNotMatch(buildCss,/--pf-mod-size|\.gear-slot \.gear-mods\{|grid-auto-flow:column!important/,'Build must not override the shared armour mod size or flow');
assert.match(sharedRailCss,/guardian-left-rail \.build-fragment-slots[\s\S]*?grid-template-columns:repeat\(auto-fit,var\(--guardian-square\)\)/,'Shared rail sockets must wrap before leaving their container');
assert.match(sharedRailCss,/guardian-left-rail \.artifact-row/,'Artifact summary must be owned by the shared Main and Build rail');
assert.match(sharedRailCss,/artifact-item-selector[\s\S]*?grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/,'Expanded Artifact catalogue must form 2-2-2 rows');
assert.match(sharedRailCss,/guardian-loadouts-strip \.guardian-loadouts-grid\{[\s\S]*?grid-template-columns:repeat\(20,minmax\(32px,1fr\)\)/,'The shared Main and Build loadout tray must remain one 1–20 row');
assert.match(sharedRailCss,/guardian-loadouts-strip \.guardian-loadout-slot\.is-saved\{[\s\S]*?background-image:var\(--loadout-color-image/,'The horizontal tray must display Bungie-selected loadout colour artwork');
assert.match(sharedRailCss,/body\.guardian-main-page\{[\s\S]*?overflow-y:auto!important/,'The Character page must own vertical document scrolling');
assert.match(sharedRailCss,/\.equip\.gear-layout-active>\.guardian-loadouts-container\{[\s\S]*?grid-row:1!important/,'The Main loadout container must occupy its own row above Armour');
assert.match(sharedRailCss,/\.equip\.gear-layout-active>\.gear-combined\{[\s\S]*?grid-row:2!important[\s\S]*?height:auto!important/,'Armour & Mods must retain its natural height below loadouts');
assert.match(buildCss,/\.design-canvas \.loadouts-design-section,[\s\S]*?\.design-canvas \.armour-design-section\{/,'Build loadouts and Armour must be independent visual containers');
assert.match(buildModule,/markGuardianFastReturn\(\);location\.href='\.\.\/'/,'Build Back must mark the authenticated cached return before opening Main');

for(const [label,html] of [['Main',workspaceHtml],['Build',buildHtml]]){
  assert.match(html,/astrix-tokens\.css/,`${label} must load the supplied token sheet on this branch`);
  assert.match(html,/class="scene immersive"/,`${label} token preview scene is missing`);
  assert.match(html,/class="grain"/,`${label} token preview grain is missing`);
  assert.match(html,/guardian-left-rail-shared\.css/,`${label} must load the shared Main and Build left rail`);
  assert.match(html,/astrix-portal-loader\.css/,`${label} must load the shared portal stylesheet`);
  assert.match(html,/astrix-portal-loader\.js/,`${label} must load the shared portal controller`);
  assert.doesNotMatch(html,/(guardian|build)-loading-gate/,`${label} must not retain legacy loader markup`);
}
assert.match(tokenPreview,/D2_JB\.jpg/,'Main and Build must use the unbranded D2 background');
assert.match(tokenPreview,/developer-provided artwork/,'Developer artwork provenance must remain explicit');
assert.match(tokenPreview,/var\(--d2-position\)\/cover no-repeat/,'D2 background must scale to the viewport');
assert.match(tokenPreview,/\.scene\.immersive\{[\s\S]*?z-index:0!important/,'D2 scene must render above the opaque root canvas');
assert.match(tokenPreview,/\.workspace,\.build-character-selector,\.build-space\)[\s\S]*?z-index:2/,'Main and Build content must render above the D2 scene');
assert.match(tokenPreview,/max-aspect-ratio:4\/3/,'D2 background must adapt to narrower screens');
assert.match(tokenPreview,/\.workspace>\.stage/,'Main Hero stage atmosphere is missing');
assert.match(tokenPreview,/\.build-space>\.design-canvas/,'Build Design atmosphere is missing');
assert.doesNotMatch(tokenPreview,/\.guardian-loading-gate,\.build-loading-gate/,'Legacy loading-gate presentation must be removed');

console.log('MAIN_RENDER_GATE=PASS');
console.log('SUBCLASS_SUPER_DATA_PATH=PASS');
console.log('STRICT_CHARACTER_AND_ARTIFACT_PROVENANCE=PASS');
console.log('ARMOUR_WEAPON_HERO_PRESENTATION=PASS');
console.log('BUILD_TOOL_PARITY=PASS');
