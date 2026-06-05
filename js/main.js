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

    if (
      path.endsWith(href) ||
      (path === '/' && href === 'index.html') ||
      (path.endsWith('/') && href === 'index.html')
    ) {
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

  }, {
    threshold: 0.15
  });

  document.querySelectorAll('.reveal').forEach(el => {
    observer.observe(el);
  });

}


// ── HERO VIDEO SPEED ─────────────────────────────────────────
function setupHeroVideo() {

  const video =
    document.getElementById('heroBg');

  if (!video) return;

  video.addEventListener('loadedmetadata', () => {
    video.playbackRate = 0.5;
  });

  if (video.readyState >= 1) {
    video.playbackRate = 0.5;
  }

}


// ── MOBILE NAV ──────────────────────────────────────────────
function setupMobileNav() {

  const toggle =
    document.querySelector('.nav-toggle');

  const links =
    document.querySelector('.nav-links');

  if (!toggle || !links) return;

  toggle.addEventListener('click', () => {

    links.classList.toggle('open');
    toggle.classList.toggle('open');

  });

  links.querySelectorAll('a').forEach(a => {

    a.addEventListener('click', () => {

      links.classList.remove('open');
      toggle.classList.remove('open');

    });

  });

}


// ── CINEMATIC STREAM EXPANSION ─────────────────────────────
function setupStreamExpansion() {

  const embed =
    document.querySelector('.stream-live-embed');

  const nav =
    document.querySelector('.nav');

  const header =
    document.querySelector('.stream-live-header');

  if (!embed) return;

  let ticking = false;

  function updateScroll() {

    const rect =
      embed.getBoundingClientRect();

    const winH =
      window.innerHeight;

    const progress =
      Math.max(
        0,
        Math.min(
          1,
          1 - (
            (rect.top + rect.height * 0.5 - winH * 0.5)
            / (winH * 0.8)
          )
        )
      );

    // CINEMATIC WINDOW
    const topBottom =
      30 - (30 * progress);

    const leftRight =
      35 - (35 * progress);

    embed.style.clipPath =
      `inset(${topBottom}% ${leftRight}% ${topBottom}% ${leftRight}%)`;

    // HEADER FADE
    if (header) {

      header.style.opacity =
        Math.max(0, 1 - progress * 2.5);

    }

    // NAV FADE
    if (nav) {

      const navOpacity =
        Math.max(
          0,
          1 - Math.max(0, (progress - 0.55) * 2.4)
        );

      nav.style.opacity =
        navOpacity;

      nav.style.background =
        `rgba(6,6,6,${0.95 - progress})`;

    }

    // FULL IMMERSION
    if (progress >= 0.98) {

      document.body.classList.add('stream-locked');

      embed.classList.add('expanded');

      if (nav) {

        nav.style.opacity = '0';
        nav.style.pointerEvents = 'none';

      }

    } else {

      document.body.classList.remove('stream-locked');

      embed.classList.remove('expanded');

      if (nav) {

        nav.style.pointerEvents = '';

      }

    }

    ticking = false;

  }

  function onScroll() {

    if (!ticking) {

      requestAnimationFrame(updateScroll);

      ticking = true;

    }

  }

  window.addEventListener(
    'scroll',
    onScroll,
    { passive: true }
  );

  updateScroll();

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

    vodEmbed.src =
      `https://player.twitch.tv/?video=${data.vod_id}&parent=astrixparadox.com&parent=www.astrixparadox.com&autoplay=false&muted=true`;

    const offlineFull =
      document.getElementById('streamOffline');

    if (offlineFull) {
      offlineFull.classList.add('has-vod');
    }

    if (vodTitle) {
      vodTitle.textContent =
        data.vod_title || 'Latest Stream';
    }

    if (vodTwLink) {
      vodTwLink.href =
        data.vod_url ||
        `https://twitch.tv/${TWITCH_CHANNEL}`;
    }

    if (vodFbLink) {

      const fbShareUrl =
        `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(data.vod_url || '')}`;

      vodFbLink.href = fbShareUrl;

    }

    if (vodSection) {
      vodSection.style.display = 'block';
    }

    if (vodFallback) {
      vodFallback.style.display = 'none';
    }

  } else {

    if (vodSection) {
      vodSection.style.display = 'none';
    }

    if (vodFallback) {
      vodFallback.style.display = 'block';
    }

  }

}


// ── TWITCH LIVE CHECK ───────────────────────────────────────
async function checkTwitchLive() {

  const navDot =
    document.querySelector('.nav-live-dot');

  const navText =
    document.querySelector('.nav-live-text');

  const offlineEl =
    document.getElementById('streamOffline');

  const liveEl =
    document.getElementById('streamLive');

  try {

    const res =
      await fetch('/twitch-status.json?t=' + Date.now());

    if (!res.ok) {
      throw new Error('Status file not found');
    }

    const data =
      await res.json();

    if (data.live) {

      if (navDot) {
        navDot.classList.add('live');
      }

      if (navText) {
        navText.textContent = 'LIVE NOW';
      }

      if (liveEl) {
        liveEl.style.display = 'block';
      }

      if (offlineEl) {
        offlineEl.style.display = 'none';
      }

      document.title =
        `🔴 LIVE — ${data.game || 'Gaming'} | ASTRIX285`;

      setupStreamExpansion();

    } else {

      if (navDot) {
        navDot.classList.remove('live');
      }

      if (navText) {
        navText.textContent = 'OFFLINE';
      }

      if (offlineEl) {
        offlineEl.style.display = 'flex';
      }

      if (liveEl) {
        liveEl.style.display = 'none';
      }

      setOfflineVod(data);

    }

  } catch (e) {

    if (navDot) {
      navDot.classList.remove('live');
    }

    if (navText) {
      navText.textContent = 'OFFLINE';
    }

    if (offlineEl) {
      offlineEl.style.display = 'flex';
    }

    if (liveEl) {
      liveEl.style.display = 'none';
    }

  }

}


// ── INIT ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

  setActiveNav();
  setupReveal();
  setupHeroVideo();
  setupMobileNav();
  checkTwitchLive();

});
