// ============================================================
// ASTRIX285 — Main JavaScript
// ============================================================

const TWITCH_CHANNEL = 'astrix285x';

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

// ── TWITCH LIVE CHECK ───────────────────────────────────────
async function checkTwitchLive() {
  const navDot    = document.querySelector('.nav-live-dot');
  const navText   = document.querySelector('.nav-live-text');
  const offlineEl = document.getElementById('streamOffline');
  const liveEl    = document.getElementById('streamLive');
  const iframe    = document.getElementById('twitchIframe');

  try {
    const res  = await fetch('/.netlify/functions/twitch-status');
    const data = await res.json();

    if (data.live) {
      // Set live nav state
      if (navDot)  navDot.classList.add('live');
      if (navText) navText.textContent = '🔴 LIVE NOW';

      // Load iframe only when live (avoids loading it on page load)
      if (iframe && !iframe.src) {
        const parent = window.location.hostname;
        iframe.src = `https://player.twitch.tv/?channel=${TWITCH_CHANNEL}&parent=${parent}&autoplay=true&muted=false`;
      }

      // Show live section
      if (liveEl)    liveEl.style.display    = 'block';
      if (offlineEl) offlineEl.style.display = 'none';

      document.title = `🔴 LIVE — ${data.game || 'Gaming'} | ASTRIX285`;

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
