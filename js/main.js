```javascript
// ============================================================
// ASTRIX285 — Main JavaScript
// ============================================================

const TWITCH_CHANNEL = 'astrix285x';


// ─────────────────────────────────────────
// NAV ACTIVE
// ─────────────────────────────────────────

function setActiveNav() {

  const path = window.location.pathname;

  document.querySelectorAll('.nav-links a')
    .forEach(link => {

      link.classList.remove('active');

      const href =
        link.getAttribute('href');

      if (
        path.endsWith(href) ||
        (path === '/' && href === 'index.html')
      ) {

        link.classList.add('active');

      }

    });

}


// ─────────────────────────────────────────
// REVEALS
// ─────────────────────────────────────────

function setupReveal() {

  const observer =
    new IntersectionObserver(entries => {

      entries.forEach(entry => {

        if (entry.isIntersecting) {

          entry.target.classList.add('visible');

        }

      });

    }, {
      threshold: 0.15
    });

  document.querySelectorAll('.reveal')
    .forEach(el => observer.observe(el));

}


// ─────────────────────────────────────────
// HERO VIDEO
// ─────────────────────────────────────────

function setupHeroVideo() {

  const video =
    document.getElementById('heroBg');

  if (!video) return;

  video.addEventListener(
    'loadedmetadata',
    () => {

      video.playbackRate = 0.5;

    }
  );

}


// ─────────────────────────────────────────
// MOBILE NAV
// ─────────────────────────────────────────

function setupMobileNav() {

  const toggle =
    document.querySelector('.nav-toggle');

  const links =
    document.querySelector('.nav-links');

  if (!toggle || !links) return;

  toggle.addEventListener('click', () => {

    links.classList.toggle('open');

  });

}


// ─────────────────────────────────────────
// CINEMATIC STREAM
// ─────────────────────────────────────────

function setupStreamExpansion() {

  const embed =
    document.querySelector('.stream-live-embed');

  const nav =
    document.querySelector('.nav');

  const header =
    document.querySelector('.stream-live-header');

  if (!embed) return;

  let ticking = false;

  function update() {

    const rect =
      embed.getBoundingClientRect();

    const winH =
      window.innerHeight;

    let progress =
      1 - (
        (rect.top + rect.height * 0.5 - winH * 0.5)
        / (winH * 0.8)
      );

    progress =
      Math.max(0, Math.min(1, progress));

    // CINEMATIC WINDOW

    const tb =
      30 - (30 * progress);

    const lr =
      35 - (35 * progress);

    embed.style.clipPath =
      `inset(${tb}% ${lr}% ${tb}% ${lr}%)`;

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
          1 - Math.max(0, (progress - 0.55) * 2.5)
        );

      nav.style.opacity =
        navOpacity;

      nav.style.background =
        `rgba(6,6,6,${0.96 - progress})`;

    }

    // IMMERSION

    if (progress >= 0.98) {

      document.body.classList.add(
        'stream-locked'
      );

      embed.classList.add('expanded');

      if (nav) {

        nav.style.opacity = '0';
        nav.style.pointerEvents = 'none';

      }

    } else {

      document.body.classList.remove(
        'stream-locked'
      );

      embed.classList.remove('expanded');

      if (nav) {

        nav.style.pointerEvents = '';

      }

    }

    ticking = false;

  }

  function onScroll() {

    if (!ticking) {

      requestAnimationFrame(update);

      ticking = true;

    }

  }

  window.addEventListener(
    'scroll',
    onScroll,
    { passive: true }
  );

  update();

}


// ─────────────────────────────────────────
// OFFLINE VOD
// ─────────────────────────────────────────

function setOfflineVod(data) {

  const vodEmbed =
    document.getElementById('vodEmbed');

  const vodTitle =
    document.getElementById('vodTitle');

  const vodSection =
    document.getElementById('vodSection');

  const vodFallback =
    document.getElementById('vodFallback');

  if (data.vod_id && vodEmbed) {

    vodEmbed.src =
      `https://player.twitch.tv/?video=${data.vod_id}&parent=astrixparadox.com&parent=www.astrixparadox.com`;

    if (vodTitle) {

      vodTitle.textContent =
        data.vod_title || 'Latest Stream';

    }

    if (vodSection) {

      vodSection.style.display =
        'block';

    }

    if (vodFallback) {

      vodFallback.style.display =
        'none';

    }

  }

}


// ─────────────────────────────────────────
// TWITCH STATUS
// ─────────────────────────────────────────

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
      await fetch(
        '/twitch-status.json?t=' + Date.now()
      );

    const data =
      await res.json();

    if (data.live) {

      if (navDot) {

        navDot.classList.add('live');

      }

      if (navText) {

        navText.textContent =
          'LIVE NOW';

      }

      if (liveEl) {

        liveEl.style.display =
          'block';

      }

      if (offlineEl) {

        offlineEl.style.display =
          'none';

      }

      setupStreamExpansion();

    } else {

      if (offlineEl) {

        offlineEl.style.display =
          'flex';

      }

      if (liveEl) {

        liveEl.style.display =
          'none';

      }

      setOfflineVod(data);

    }

  } catch (e) {

    console.error(e);

  }

}


// ─────────────────────────────────────────
// INIT
// ─────────────────────────────────────────

document.addEventListener(
  'DOMContentLoaded',
  () => {

    setActiveNav();
    setupReveal();
    setupHeroVideo();
    setupMobileNav();
    checkTwitchLive();

  }
);
```
