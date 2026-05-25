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

// ── STREAM SCROLL EXPANSION ──────────────────────────────────
function setupStreamExpansion() {
  const track  = document.getElementById('streamScrollTrack');
  const clip   = document.getElementById('streamEmbedClipper');
  const header = document.getElementById('streamLiveHeader');
  const nav    = document.querySelector('.nav');
  if (!track || !clip) return;

  function onScroll() {
    const rect     = track.getBoundingClientRect();
    const trackH   = track.offsetHeight;
    const winH     = window.innerHeight;

    const scrolled  = -rect.top;
    const scrollMax = trackH - winH;
    const progress  = Math.min(1, Math.max(0, scrolled / scrollMax));

    // clip-path: starts inset(30% 35% 30% 35%), opens to inset(0 0 0 0)
    const clipX = (35 * (1 - progress)).toFixed(2);
    const clipY = (30 * (1 - progress)).toFixed(2);
    clip.style.clipPath = `inset(${clipY}% ${clipX}% ${clipY}% ${clipX}%)`;

    // Fade header out quickly in first 40% of scroll
    if (header) {
      header.style.opacity = Math.max(0, 1 - progress * 2.5).toFixed(2);
    }

    // Nav: fade background to transparent as embed expands
    // Fully transparent at progress >= 0.7
    if (nav) {
      const navAlpha = Math.max(0, 1 - progress * 1.4).toFixed(2);
      nav.style.background = `rgba(6,6,6,${navAlpha})`;
      nav.style.borderBottomColor = `rgba(139,0,0,${Math.max(0, 0.3 - progress * 0.4)})`;
      nav.style.backdropFilter = progress > 0.7 ? 'none' : 'blur(10px)';
    }

    // At full expansion lock scroll and hide footer
    const footer = document.querySelector('.footer');
    if (progress >= 0.999) {
      clip.classList.add('fully-open');
      document.body.classList.add('stream-locked');
      if (footer) footer.style.visibility = 'hidden';
    } else {
      clip.classList.remove('fully-open');
      document.body.classList.remove('stream-locked');
      if (footer) footer.style.visibility = 'visible';
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
