// ============================================================
// ASTRIX285 — Main JavaScript
// ============================================================

const TWITCH_CHANNEL = 'astrix285x';
const FB_PAGE        = 'https://www.facebook.com/xASTRIX285x';

// ── NAV ACTIVE STATE ────────────────────────────────────────
function setActiveNav() {
  const path = window.location.pathname;
  document.querySelectorAll('.nav-links a').forEach(link => {
    link.classList.remove('active');
    const href = link.getAttribute('href');
    if (path.endsWith(href) || (path === '/' && href === 'index.html') ||
        (path.endsWith('/') && href === 'index.html')) {
      link.classList.add('active');
    }
  });
}

// ── SCROLL REVEAL ───────────────────────────────────────────
function setupReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) entry.target.classList.add('visible');
    });
  }, { threshold: 0.15 });
  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
}

// ── STREAM EMBED CLIP-REVEAL ─────────────────────────────────
// The iframe is always full width — never scaled or stretched.
// The clipper wrapper opens via clip-path as you scroll.
// The header beneath the embed gets covered as the reveal widens.
function setupStreamExpansion() {
  const clipper = document.getElementById('streamEmbedClipper');
  if (!clipper) return;

  function onScroll() {
    const rect   = clipper.getBoundingClientRect();
    const winH   = window.innerHeight;

    // Start opening when the top edge of the embed hits 85% down the viewport.
    // Fully open when the centre of the embed reaches the centre of the viewport.
    const startTrigger  = winH * 0.85;
    const endTrigger    = winH * 0.5;
    const currentTop    = rect.top;

    const raw      = (startTrigger - currentTop) / (startTrigger - endTrigger);
    const progress = Math.min(1, Math.max(0, raw));

    // Clip sides from 35% → 0%
    const clip = Math.round(35 * (1 - progress));
    clipper.style.clipPath = `inset(0 ${clip}% 0 ${clip}%)`;

    if (progress >= 0.99) {
      clipper.classList.add('fully-open');
    } else {
      clipper.classList.remove('fully-open');
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

// ── SET OFFLINE VOD STATE ────────────────────────────────────
function setOfflineVod(data) {
  const vodEmbed    = document.getElementById('vodEmbed');
  const vodTitle    = document.getElementById('vodTitle');
  const vodFbLink   = document.getElementById('vodFbLink');
  const vodTwLink   = document.getElementById('vodTwLink');
  const vodSection  = document.getElementById('vodSection');
  const vodFallback = document.getElementById('vodFallback');

  if (data.vod_id && vodEmbed) {
    vodEmbed.src = `https://player.twitch.tv/?video=${data.vod_id}&parent=astrixparadox.com&parent=www.astrixparadox.com&autoplay=false&muted=true`;
    const offlineFull = document.getElementById('streamOffline');
    if (offlineFull) offlineFull.classList.add('has-vod');

    if (vodTitle)  vodTitle.textContent = data.vod_title || 'Latest Stream';
    if (vodTwLink) vodTwLink.href       = data.vod_url   || `https://twitch.tv/${TWITCH_CHANNEL}`;

    if (vodFbLink) {
      vodFbLink.href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(data.vod_url || '')}`;
    }

    if (vodSection)  vodSection.style.display  = 'block';
    if (vodFallback) vodFallback.style.display = 'none';
  } else {
    if (vodSection)  vodSection.style.display  = 'none';
    if (vodFallback) vodFallback.style.display = 'block';
  }
}

// ── TWITCH LIVE CHECK ───────────────────────────────────────
async function checkTwitchLive() {
  const navDot    = document.querySelector('.nav-live-dot');
  const navText   = document.querySelector('.nav-live-text');
  const offlineEl = document.getElementById('streamOffline');
  const liveEl    = document.getElementById('streamLive');

  try {
    const res  = await fetch('/twitch-status.json?t=' + Date.now());
    if (!res.ok) throw new Error('Status file not found');
    const data = await res.json();

    console.log('[ASTRIX] twitch-status.json:', JSON.stringify(data));

    if (data.live) {
      if (navDot)  navDot.classList.add('live');
      if (navText) navText.textContent = '🔴 LIVE NOW';
      if (liveEl)    liveEl.style.display    = 'block';
      if (offlineEl) offlineEl.style.display = 'none';
      document.title = `🔴 LIVE — ${data.game || 'Gaming'} | ASTRIX285`;
      setupStreamExpansion();
    } else {
      if (navDot)    navDot.classList.remove('live');
      if (navText)   navText.textContent = 'OFFLINE';
      if (offlineEl) offlineEl.style.display = 'flex';
      if (liveEl)    liveEl.style.display    = 'none';
      setOfflineVod(data);
    }

  } catch (e) {
    console.error('[ASTRIX] checkTwitchLive error:', e);
    if (navDot)    navDot.classList.remove('live');
    if (navText)   navText.textContent = 'OFFLINE';
    if (offlineEl) offlineEl.style.display = 'flex';
    if (liveEl)    liveEl.style.display    = 'none';
    const vodFallback = document.getElementById('vodFallback');
    if (vodFallback) vodFallback.style.display = 'block';
  }
}

// ── MOBILE NAV ──────────────────────────────────────────────
function setupMobileNav() {
  const toggle = document.querySelector('.nav-toggle');
  const links  = document.querySelector('.nav-links');
  if (!toggle || !links) return;
  toggle.addEventListener('click', () => links.classList.toggle('open'));
}

// ── HERO VIDEO SPEED ─────────────────────────────────────────
function setupHeroVideo() {
  const video = document.getElementById('heroBg');
  if (!video) return;
  video.addEventListener('loadedmetadata', () => { video.playbackRate = 0.5; });
  if (video.readyState >= 1) video.playbackRate = 0.5;
}

// ── INIT ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setActiveNav();
  setupReveal();
  setupMobileNav();
  setupHeroVideo();
  checkTwitchLive();
});
