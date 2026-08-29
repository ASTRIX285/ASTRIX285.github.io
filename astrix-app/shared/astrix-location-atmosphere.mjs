/* =====================================================================
   ASTRIX PARADOX — location-reactive atmosphere resolver (SHARED)

   Sets html[data-location] so astrix-location-atmosphere.css can tint the
   shared .astrix-atmosphere layer to the Guardian's destination.

   Resolution priority (per product direction):
     1. User's last SELECTED destination/section (explicit pick), if any.
     2. Else last visited LIVE location (excluding Tower + social spaces).
     3. Else default (blue) — NEVER invents a location.

   Tower and social spaces (Annex, Eververse, H.E.L.M. social, etc.) never
   drive the tint: when the live location resolves to one of those, we keep
   the last real destination instead. No data is fabricated — if nothing is
   known, the page stays on the default blue.
   ===================================================================== */

const KNOWN = new Set([
  "pale-heart","europa","dreaming-city","edz","cosmodrome",
  "moon","neomuna","nessus","throne-world"
]);
// Locations that must NOT drive the atmosphere.
const EXCLUDED = new Set(["tower","social","annex","helm-social","eventide-social"]);

const SELECTED_KEY = "astrix:selected-destination:v1";   // explicit user pick
const LIVE_KEY     = "astrix:last-live-location:v1";     // last real live location

/* Map a Bungie place/destination NAME to our location key. This is a
   deterministic name map only — it classifies known destinations, it does
   not invent one. Unknown names return "" (leaves the tint unchanged). */
export function locationKeyFromName(name){
  const t = String(name || "").toLowerCase();
  if(!t) return "";
  if(t.includes("pale heart")) return "pale-heart";
  if(t.includes("europa")) return "europa";
  if(t.includes("dreaming city")) return "dreaming-city";
  if(t.includes("european dead zone") || t === "edz") return "edz";
  if(t.includes("cosmodrome")) return "cosmodrome";
  if(t.includes("moon")) return "moon";
  if(t.includes("neomuna")) return "neomuna";
  if(t.includes("nessus")) return "nessus";
  if(t.includes("throne world") || t.includes("savathun")) return "throne-world";
  if(t.includes("tower")) return "tower";                       // excluded
  if(t.includes("h.e.l.m") || t.includes("helm")) return "helm-social"; // excluded
  if(t.includes("annex") || t.includes("eververse")) return "annex";    // excluded
  return "";
}

function read(key){ try{ return String(localStorage.getItem(key) || ""); }catch{ return ""; } }
function write(key,val){ try{ localStorage.setItem(key, String(val || "")); }catch{} }

/* Apply a resolved key to <html>. Excluded/unknown keys do NOT change the
   current tint. Valid keys are applied and, when live, remembered. */
function applyKey(key, {live=false} = {}){
  if(!key || EXCLUDED.has(key) || !KNOWN.has(key)) return false;
  document.documentElement.setAttribute("data-location", key);
  if(live) write(LIVE_KEY, key);
  return true;
}

/* Public: user explicitly selects a destination/section. Persists + applies. */
export function setSelectedDestination(key){
  const k = KNOWN.has(key) ? key : locationKeyFromName(key);
  if(!k || EXCLUDED.has(k) || !KNOWN.has(k)) return false;
  write(SELECTED_KEY, k);
  return applyKey(k);
}

/* Public: report the live location (name or key) from the Bungie profile.
   Tower/social are ignored (tint keeps the last real destination). */
export function reportLiveLocation(nameOrKey){
  const k = KNOWN.has(nameOrKey) ? nameOrKey : locationKeyFromName(nameOrKey);
  if(!k) return false;                 // unknown -> leave unchanged (no invention)
  if(EXCLUDED.has(k)) return false;    // tower/social -> keep last real location
  return applyKey(k, {live:true});
}

/* Resolve initial atmosphere on load, by priority. */
export function resolveInitialAtmosphere(){
  const selected = read(SELECTED_KEY);
  if(applyKey(selected)) return selected;         // 1. explicit selection
  const live = read(LIVE_KEY);
  if(applyKey(live)) return live;                 // 2. last live location
  return "";                                      // 3. default (blue) via CSS :root
}

/* Ensure the shared atmosphere layer element exists (one per document). */
function ensureAtmosphereLayer(){
  if(document.querySelector(".astrix-atmosphere")) return;
  const el = document.createElement("div");
  el.className = "astrix-atmosphere";
  el.setAttribute("aria-hidden","true");
  document.body.insertBefore(el, document.body.firstChild);
}

/* Auto-wire: create the layer, resolve initial tint, and listen for live
   Guardian data. Reads a location field from the profile detail IF present;
   if the profile does not (yet) carry location, nothing is invented and the
   last known / default tint stands. */
function boot(){
  ensureAtmosphereLayer();
  resolveInitialAtmosphere();
  const onGuardian = event => {
    const d = event.detail || {};
    // Accept any of these shapes if the live profile provides them.
    const name = d.currentLocation || d.location || d.destination
              || d.currentActivityLocation || "";
    if(name) reportLiveLocation(name);
  };
  document.addEventListener("astrix:guardian-selection-changed", onGuardian);
  document.addEventListener("astrix:bungie-profile-loaded", onGuardian);
}

if(document.readyState === "loading"){
  document.addEventListener("DOMContentLoaded", boot, {once:true});
}else{
  boot();
}

export default { setSelectedDestination, reportLiveLocation, resolveInitialAtmosphere, locationKeyFromName };
