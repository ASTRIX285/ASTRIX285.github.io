// ============================================================
// ASTRIX285 — Main JavaScript
// ============================================================

const TWITCH_CHANNEL = 'astrix285x';
const TWITCH_VOD     = '2777252499';
const TWITCH_CLIENT_ID = 'kimne78kx3ncx6brgo4mv6wki5h1ko'; // public Twitch embed client

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
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, { threshold: 0.15 });

  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
}

// ── TWITCH LIVE CHECK ───────────────────────────────────────
// Uses Twitch public API — no auth needed for this endpoint
async function checkTwitchLive() {
  // We can't call Twitch API directly from browser without CORS
  // So we check by loading the stream and seeing if it's live
  // via the Twitch embed API callback
  setupStreamSection();
}

function setupStreamSection() {
  const offlineEl = document.getElementById('streamOffline');
  const liveEl    = document.getElementById('streamLive');
  const navDot    = document.querySelector('.nav-live-dot');
  const navText   = document.querySelector('.nav-live-text');

  if (!offlineEl || !liveEl) return;

  // Load Twitch embed API
  const script = document.createElement('script');
  script.src = 'https://embed.twitch.tv/embed/v1.js';
  script.onload = () => {
    const embed = new Twitch.Embed('twitch-embed-target', {
      width: '100%',
      height: '100%',
      channel: TWITCH_CHANNEL,
      layout: 'video',
      autoplay: false,
      muted: true,
      parent: [window.location.hostname]
    });

    embed.addEventListener(Twitch.Embed.VIDEO_READY, () => {
      const player = embed.getPlayer();
      // Check if live after a short delay
      setTimeout(() => {
        // Twitch embed doesn't expose isLive directly
        // but we can check via stream online check
        fetchLiveStatus(player, offlineEl, liveEl, navDot, navText);
      }, 2000);
    });
  };
  document.head.appendChild(script);
}

async function fetchLiveStatus(player, offlineEl, liveEl, navDot, navText) {
  // Use a CORS proxy or direct check
  // Since we can't call Twitch API directly, use the embed player state
  try {
    const response = await fetch(
      `https://api.twitch.tv/helix/streams?user_login=${TWITCH_CHANNEL}`,
      {
        headers: {
          'Client-ID': 'kimne78kx3ncx6brgo4mv6wki5h1ko',
          'Authorization': 'Bearer cfabdegwdoklmawdzdo7tfn26'
        }
      }
    );
    const data = await response.json();
    const isLive = data.data && data.data.length > 0;

    if (isLive) {
      const stream = data.data[0];
      setLiveState(stream, offlineEl, liveEl, navDot, navText);
    } else {
      setOfflineState(offlineEl, liveEl, navDot, navText);
    }
  } catch (e) {
    // Fallback — show offline state
    setOfflineState(offlineEl, liveEl, navDot, navText);
  }
}

function setLiveState(stream, offlineEl, liveEl, navDot, navText) {
  offlineEl.style.display = 'none';
  liveEl.style.display    = 'block';
  if (navDot) navDot.classList.add('live');
  if (navText) navText.textContent = '🔴 LIVE NOW';

  // Update page title
  document.title = `🔴 LIVE — ${stream.game_name || 'Gaming'} | ASTRIX285`;
}

function setOfflineState(offlineEl, liveEl, navDot, navText) {
  offlineEl.style.display = 'flex';
  liveEl.style.display    = 'none';
  if (navDot) navDot.classList.remove('live');
  if (navText) navText.textContent = 'OFFLINE';
}

// ── MOBILE NAV ──────────────────────────────────────────────
function setupMobileNav() {
  const toggle = document.querySelector('.nav-toggle');
  const links  = document.querySelector('.nav-links');
  if (!toggle || !links) return;
  toggle.addEventListener('click', () => {
    links.classList.toggle('open');
  });
}

// ── INIT ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setActiveNav();
  setupReveal();
  setupMobileNav();

  // Only run stream check on home page
  if (document.getElementById('streamOffline') || document.getElementById('streamLive')) {
    checkTwitchLive();
  }
});
