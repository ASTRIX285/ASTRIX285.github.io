import {cacheBungieSession,readCachedBungieSession} from "./guardian-session-cache.mjs";

const AUTH_ORIGIN = globalThis.ASTRIX_AUTH_ORIGIN || "https://auth.astrixparadox.com";
const CANONICAL_APP_ORIGIN = "https://astrixparadox.com";

function authReturnUrl(){
  const current=new URL(location.href);
  current.searchParams.delete("bungie");
  // OAuth only accepts the production first-party origin. Netlify deploy-preview
  // origins are intentionally not allow-listed, so preserve the Forge path while
  // moving the callback destination onto the canonical application origin.
  if(current.hostname.endsWith(".netlify.app")){
    return new URL(`${current.pathname}${current.search}${current.hash}`,CANONICAL_APP_ORIGIN);
  }
  return current;
}

function installStyles(){
  if(document.getElementById("guardianBungieAuthStyles")) return;
  const style=document.createElement("style");
  style.id="guardianBungieAuthStyles";
  style.textContent=`
    .bungie-auth-control{display:flex;align-items:center;gap:8px;margin-left:10px}
    .bungie-auth-btn{appearance:none;border:1px solid rgba(139,92,246,.55);background:linear-gradient(180deg,rgba(139,92,246,.18),rgba(16,12,28,.92));color:#f3edff;border-radius:8px;padding:9px 13px;font:700 11px/1 Orbitron,system-ui,sans-serif;letter-spacing:.08em;cursor:pointer;box-shadow:0 0 0 1px rgba(139,92,246,.08) inset;transition:border-color .18s ease,background .18s ease,transform .18s ease}
    .bungie-auth-btn:hover{border-color:rgba(167,125,255,.9);background:linear-gradient(180deg,rgba(139,92,246,.28),rgba(20,14,34,.96));transform:translateY(-1px)}
    .bungie-auth-btn[data-state="connected"]{border-color:rgba(85,232,176,.55);color:#6ff0bc;background:rgba(20,62,48,.28)}
    .bungie-auth-btn[data-state="checking"]{opacity:.68;cursor:wait}
    @media(max-width:1220px){.bungie-auth-control{margin-left:4px}.bungie-auth-btn{padding:8px 10px;font-size:10px}}
  `;
  document.head.appendChild(style);
}

function makeControl(){
  if(document.getElementById("bungieAuthButton")) return document.getElementById("bungieAuthButton");
  const host=document.querySelector(".topbar .char-switch")?.parentElement || document.querySelector(".topbar");
  if(!host) return null;
  const wrap=document.createElement("div");
  wrap.className="bungie-auth-control";
  const button=document.createElement("button");
  button.id="bungieAuthButton";
  button.className="bungie-auth-btn";
  button.type="button";
  button.dataset.state="checking";
  button.textContent="CHECKING BUNGIE…";
  button.addEventListener("click",()=>{
    if(button.dataset.state==="connected") return;
    const returnUrl=authReturnUrl();
    location.href=`${AUTH_ORIGIN}/bungie/start?return=${encodeURIComponent(returnUrl.toString())}`;
  });
  wrap.appendChild(button);
  const anchor=document.querySelector(".topbar .char-switch");
  if(anchor?.parentElement) anchor.insertAdjacentElement("afterend",wrap); else host.appendChild(wrap);
  return button;
}

let sessionRequest=null;

async function requestSession(){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),12000);
  try{
    const response=await fetch(`${AUTH_ORIGIN}/session`,{
      credentials:"include",
      headers:{Accept:"application/json"},
      signal:controller.signal
    });
    const session=await response.json().catch(()=>({authenticated:false}));
    if(response.status===401)return {authenticated:false};
    if(!response.ok)throw new Error(session?.error||`session:${response.status}`);
    return session;
  }finally{
    clearTimeout(timer);
  }
}

function publishSession(session){
  if(!session?.authenticated)return;
  cacheBungieSession(session);
  globalThis.ASTRIX_BUNGIE_SESSION=session;
  globalThis.dispatchEvent(new CustomEvent("astrix:bungie-session",{detail:session}));
}

function getBungieSession({force=false}={}){
  if(!force&&sessionRequest)return sessionRequest;
  if(!force){
    const cached=readCachedBungieSession();
    if(cached){
      publishSession(cached);
      sessionRequest=Promise.resolve(cached);
      globalThis.ASTRIX_BUNGIE_SESSION_PROMISE=sessionRequest;
      return sessionRequest;
    }
  }
  sessionRequest=requestSession()
    .then(session=>{
      publishSession(session);
      return session;
    })
    .catch(error=>{
      console.info("[ASTRIX Bungie auth] no active session",error);
      return {authenticated:false,error:error?.message||"session_unavailable"};
    });
  globalThis.ASTRIX_BUNGIE_SESSION_PROMISE=sessionRequest;
  return sessionRequest;
}

async function refreshAuthState(button){
  const session=await getBungieSession();
  if(session?.authenticated){
    button.dataset.state="connected";
    const active=session.activeDestinyMembership;
    button.textContent=active?.displayName?`BUNGIE: ${active.displayName}`:"BUNGIE CONNECTED";
    return;
  }
  button.dataset.state="disconnected";
  button.textContent="CONNECT BUNGIE";
}

installStyles();
const button=makeControl();
if(button) refreshAuthState(button);
if(new URLSearchParams(location.search).has("rangeTest")) import("./guardian-shooting-range-inline.mjs");

export {AUTH_ORIGIN,getBungieSession};
