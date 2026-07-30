const tabs = document.querySelectorAll('.nav-tab');
const mobileToggle = document.querySelector('.mobile-toggle');
const primaryNav = document.querySelector('.primary-nav');

function activateView(view) {
  tabs.forEach((tab) => tab.classList.toggle('active', tab.dataset.view === view));
  const target = document.getElementById(view);
  if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  primaryNav?.classList.remove('open');
  mobileToggle?.setAttribute('aria-expanded', 'false');
}

tabs.forEach((tab) => {
  tab.addEventListener('click', () => activateView(tab.dataset.view));
});

document.querySelectorAll('[data-jump]').forEach((button) => {
  button.addEventListener('click', () => activateView(button.dataset.jump));
});

mobileToggle?.addEventListener('click', () => {
  const open = primaryNav.classList.toggle('open');
  mobileToggle.setAttribute('aria-expanded', String(open));
});

const observedSections = [...document.querySelectorAll('main section[id]')];
const observer = new IntersectionObserver((entries) => {
  const visible = entries
    .filter((entry) => entry.isIntersecting)
    .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
  if (!visible) return;
  const view = visible.target.id;
  tabs.forEach((tab) => tab.classList.toggle('active', tab.dataset.view === view));
}, { rootMargin: '-30% 0px -55% 0px', threshold: [0.1, 0.35, 0.6] });

observedSections.forEach((section) => observer.observe(section));
