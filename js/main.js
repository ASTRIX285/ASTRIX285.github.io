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
// The scroll-track div is 400vh tall. The embed wrapper is sticky
// so it stays fixed in the viewport while the user scrolls through
// the track. Scroll progress (0→1) drives clip-path from a narrow
// centred strip to full viewport on both axes.
function setupStreamExpansion() {
  const track  = document.getElementById('streamScrollTrack');
  const sticky = document.getElementById('streamStickyWrap');
  const clip   = document.getElementById('streamEmbedClipper');
  const header = document.getElementById('streamLiveHeader');
  if (!track || !sticky || !clip) return;

  function onScroll() {
    const rect     = track.getBoundingClientRect();
    const trackH   = track.offsetHeight;
    const winH     = window.innerHeight;

    // progress: 0 = track top just entered viewport
    //           1 = track bottom just leaving viewport
    const scrolled  = -rect.top;
    const scrollMax = trackH - winH;
    const progress  = Math.min(1, Math.max(0, scrolled / scrollMax));

    // Clip: width  35% → 0%  (both sides)
    //       height 30% → 0%  (top and bottom)
    const clipX = Math.round(35 * (1 - progress));
    const clipY = Math.round(30 * (1 - progress));
    clip.style.clipPath = `inset(${clipY}% ${clipX}% ${clipY}% ${clipX}%)`;

    // Fade the header out as embed expands over it (progress 0→0.4)
    if (header) {
      const headerOpacity = Math.max(0, 1 - progress * 3);
      header.style.opacity = headerOpacity;
    }

    // Edge fades gone when fully open
    if (progress >= 0.98) {
      clip.classList.add('fully-open');
    } else {
      clip.classList.remove('fully-open');
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
