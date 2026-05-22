// ============================================================
// ASTRIX285 — Main JavaScript
// ============================================================

const TWITCH_CHANNEL = 'astrix285x';
const TWITCH_FUNCTION = 'https://twitch-status.astrix285.workers.dev';

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

// ── STREAM EMBED SCROLL EXPANSION ───────────────────────────
function setupStreamExpansion() {
  const embed = document.querySelector('.stream-live-embed');
  if (!embed) return;

  function onScroll() {
    const rect = embed.getBoundingClientRect();
    const winH  = window.innerHeight;

    // How far the embed centre is from the screen centre (0 = centred)
    const distFromCenter = Math.abs((rect.top + rect.height / 2) - winH / 2);
    const maxDist = winH / 2 + rect.height / 2;

    // Scale from 0.6 (far away) to 1 (centred)
    const progress = Math.max(0, 1 - distFromCenter / (maxDist * 0.6));
    const scale = 0.6 + (0.4 * progress);

    embed.style.setProperty('--embed-scale', scale);
    embed.style.transform = `scaleX(${scale})`;

    if (scale >= 0.99) {
      embed.classList.add('expanded');
    } else {
      embed.classList.remove('expanded');
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll(); // run once on load
}

// ── TWITCH LIVE CHECK ───────────────────────────────────────
async function checkTwitchLive() {
  const navDot    = document.querySelector('.nav-live-dot');
  const navText   = document.querySelector('.nav-live-text');
  const offlineEl = document.getElementById('streamOffline');
  const liveEl    = document.getElementById('streamLive');

  try {
    const res  = await fetch(TWITCH_FUNCTION);
    const data = await res.json();

    if (data.live) {
      if (navDot)  navDot.classList.add('live');
      if (navText) navText.textContent = '🔴 LIVE NOW';
      if (liveEl)    liveEl.style.display    = 'block';
      if (offlineEl) offlineEl.style.display = 'none';
      document.title = `🔴 LIVE — ${data.game || 'Gaming'} | ASTRIX285`;
      // Start scroll expansion after live section is shown
      setupStreamExpansion();
    } else {
      if (navDot)    navDot.classList.remove('live');
      if (navText)   navText.textContent = 'OFFLINE';
      if (offlineEl) offlineEl.style.display = 'flex';
      if (liveEl)    liveEl.style.display    = 'none';
    }
  } catch (e) {
    if (navDot)    navDot.classList.remove('live');
    if (navText)   navText.textContent = 'OFFLINE';
    if (offlineEl) offlineEl.style.display = 'flex';
    if (liveEl)    liveEl.style.display    = 'none';
  }
}

// ── MOBILE NAV ──────────────────────────────────────────────
function setupMobileNav() {
  const toggle = document.querySelector('.nav-toggle');
  const links  = document.querySelector('.nav-links');
  if (!toggle || !links) return;
  toggle.addEventListener('click', () => links.classList.toggle('open'));
}

// ── INIT ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setActiveNav();
  setupReveal();
  setupMobileNav();
  checkTwitchLive();
});
