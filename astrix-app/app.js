import { BUILD_DATA_URL, availableFilters, selectBuilds } from './build-rules.js';

const tabs = document.querySelectorAll('.nav-tab');
const mobileToggle = document.querySelector('.mobile-toggle');
const primaryNav = document.querySelector('.primary-nav');
const buildGrid = document.querySelector('[data-build-grid]');
const buildStatus = document.querySelector('[data-build-status]');
const subclassFilter = document.querySelector('[data-filter-subclass]');
const activityFilter = document.querySelector('[data-filter-activity]');
let buildCatalogue = [];

function activateView(view) {
  tabs.forEach((tab) => tab.classList.toggle('active', tab.dataset.view === view));
  const target = document.getElementById(view);
  if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  primaryNav?.classList.remove('open');
  mobileToggle?.setAttribute('aria-expanded', 'false');
}

tabs.forEach((tab) => tab.addEventListener('click', () => activateView(tab.dataset.view)));
document.querySelectorAll('[data-jump]').forEach((button) => button.addEventListener('click', () => activateView(button.dataset.jump)));
mobileToggle?.addEventListener('click', () => {
  const open = primaryNav.classList.toggle('open');
  mobileToggle.setAttribute('aria-expanded', String(open));
});

const observedSections = [...document.querySelectorAll('main section[id]')];
const observer = new IntersectionObserver((entries) => {
  const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
  if (!visible) return;
  tabs.forEach((tab) => tab.classList.toggle('active', tab.dataset.view === visible.target.id));
}, { rootMargin: '-30% 0px -55% 0px', threshold: [0.1, 0.35, 0.6] });
observedSections.forEach((section) => observer.observe(section));

function option(value, label = value) {
  const element = document.createElement('option');
  element.value = value;
  element.textContent = label;
  return element;
}

function populateFilters(builds) {
  const filters = availableFilters(builds);
  subclassFilter?.replaceChildren(option('all', 'All subclasses'), ...filters.subclasses.map((value) => option(value.toLowerCase(), value)));
  activityFilter?.replaceChildren(option('all', 'All activities'), ...filters.activities.map((value) => option(value, value.replaceAll('-', ' '))));
}

function statSummary(statTargets) {
  return Object.entries(statTargets)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, value]) => `${name} ${value}`)
    .join(' · ');
}

function buildCard(build) {
  const article = document.createElement('article');
  article.className = `build-card ${build.subclass.toLowerCase()}`;
  const verification = build.verified ? 'Verified' : 'Review required';
  const reviewCount = build.reviewNotes?.length || 0;

  article.innerHTML = `
    <div class="build-art">
      <span class="class-symbol">${build.class.charAt(0)}</span>
      <div class="element-glow"></div>
    </div>
    <div class="build-body">
      <div class="build-tags">
        <span>${build.activityTags[0].replaceAll('-', ' ').toUpperCase()}</span>
        <span>${build.class.toUpperCase()}</span>
        <span>${verification.toUpperCase()}</span>
      </div>
      <h3>${build.name}</h3>
      <p>${build.summary}</p>
      <p><strong>${build.exoticArmor.name}</strong> · ${statSummary(build.armor3.statTargets)}</p>
      <div class="build-footer">
        <span>${build.role.join(' · ')}</span>
        <button type="button" aria-label="${reviewCount} review items for ${build.name}">${reviewCount} checks</button>
      </div>
    </div>`;

  return article;
}

function renderBuilds() {
  if (!buildGrid) return;
  const builds = selectBuilds(buildCatalogue, {
    subclass: subclassFilter?.value || 'all',
    activity: activityFilter?.value || 'all'
  });

  buildGrid.replaceChildren(...builds.map(buildCard));
  if (buildStatus) {
    const unverified = builds.filter((build) => !build.verified).length;
    buildStatus.textContent = `${builds.length} build${builds.length === 1 ? '' : 's'} shown · ${unverified} awaiting human verification`;
  }
}

async function loadBuilds() {
  try {
    const response = await fetch(BUILD_DATA_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Build data returned ${response.status}`);
    const data = await response.json();
    buildCatalogue = Array.isArray(data.builds) ? data.builds : [];
    populateFilters(buildCatalogue);
    renderBuilds();
  } catch (error) {
    console.error('Unable to load static build catalogue', error);
    if (buildStatus) buildStatus.textContent = 'Build catalogue unavailable. Check the committed JSON file.';
    buildGrid?.replaceChildren();
  }
}

subclassFilter?.addEventListener('change', renderBuilds);
activityFilter?.addEventListener('change', renderBuilds);
loadBuilds();
