import { resolveBuildAspectIds } from './aspect-linkage.mjs';
import { recommendSynergies } from './synergy-engine.mjs';

const BUILD_DATA_URL = './data/armor-3-builds.json';
const COMPONENT_DATA_URL = './data/armor-3-components.json';
const detailRoot = document.querySelector('[data-build-detail]');

let dataPromise;

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function loadStaticData() {
  if (!dataPromise) {
    dataPromise = Promise.all([
      fetch(BUILD_DATA_URL, { cache: 'no-store' }),
      fetch(COMPONENT_DATA_URL, { cache: 'no-store' })
    ]).then(async ([buildResponse, componentResponse]) => {
      if (!buildResponse.ok) {
        throw new Error(`Build data returned ${buildResponse.status}`);
      }
      if (!componentResponse.ok) {
        throw new Error(`Component data returned ${componentResponse.status}`);
      }

      const [buildCatalogue, componentCatalogue] = await Promise.all([
        buildResponse.json(),
        componentResponse.json()
      ]);

      return { buildCatalogue, componentCatalogue };
    });
  }

  return dataPromise;
}

function reasonMarkup(reason, componentsById) {
  const supportingAspects = reason.supportingComponentIds
    .map((id) => componentsById.get(id))
    .filter((component) => component?.type === 'aspect')
    .map((component) => component.name);

  const aspectText = supportingAspects.length > 0
    ? supportingAspects.join(', ')
    : 'the selected verified aspect';

  const artifactText = Array.isArray(reason.artifactNames) && reason.artifactNames.length > 0
    ? `<span>Available from: ${reason.artifactNames.map(escapeHtml).join(', ')}</span>`
    : '';

  return `
    <li>
      <strong>${escapeHtml(reason.matchedKeywords.join(', '))} · rule priority ${escapeHtml(reason.rulePriority)}</strong>
      <span>Matched with ${escapeHtml(aspectText)}.</span>
      <span>${escapeHtml(reason.summary)}</span>
      ${artifactText}
    </li>`;
}

function statModifierMarkup(modifier) {
  const value = Number(modifier.value);
  const state = value < 0 ? 'negative' : value > 0 ? 'positive' : '';
  const prefix = value > 0 ? '+' : '';
  return `<span class="stat-modifier ${state}">${escapeHtml(modifier.stat)} ${prefix}${escapeHtml(value)}</span>`;
}

function recommendationCard(recommendation, componentsById) {
  const statModifiers = Array.isArray(recommendation.statModifiers)
    ? `<div class="stat-modifiers" aria-label="Fragment stat trade-offs">
        ${recommendation.statModifiers.length > 0
          ? recommendation.statModifiers.map(statModifierMarkup).join('')
          : '<span class="stat-modifier">No recorded stat change</span>'}
      </div>`
    : '';

  const artifactNames = Array.isArray(recommendation.artifactNames)
    ? `<div class="synergy-meta">${recommendation.artifactNames.map((name) => `<span>${escapeHtml(name)}</span>`).join('')}</div>`
    : '';

  return `
    <article class="synergy-card">
      <h5>${escapeHtml(recommendation.name)}</h5>
      <p>${escapeHtml(recommendation.effect)}</p>
      ${artifactNames}
      ${statModifiers}
      <ul class="synergy-reasons">
        ${recommendation.reasons.map((reason) => reasonMarkup(reason, componentsById)).join('')}
      </ul>
    </article>`;
}

function sectionMarkup(title, section, componentsById, countLabel = '') {
  const count = section.recommendations.length;
  const label = countLabel || `${count} recommendation${count === 1 ? '' : 's'}`;

  if (section.status !== 'ready') {
    return `
      <div class="synergy-group">
        <div class="synergy-group-heading"><h4>${escapeHtml(title)}</h4><span>${escapeHtml(section.status)}</span></div>
        <div class="synergy-empty">
          <strong>${escapeHtml(section.status)}</strong>
          <p>${escapeHtml(section.unavailableReason || 'Insufficient verified data for this build context.')}</p>
        </div>
      </div>`;
  }

  return `
    <div class="synergy-group">
      <div class="synergy-group-heading"><h4>${escapeHtml(title)}</h4><span>${escapeHtml(label)}</span></div>
      <div class="synergy-grid">
        ${section.recommendations.map((recommendation) => recommendationCard(recommendation, componentsById)).join('')}
      </div>
    </div>`;
}

function enginePanelMarkup(build, result, componentsById, unresolvedAspects) {
  const usedSlots = result.recommendations.fragments.recommendations.length;
  const slotLimit = result.fragmentSlotLimit;
  const linkageWarning = unresolvedAspects.length > 0
    ? `<span class="synergy-pill warning">${unresolvedAspects.length} aspect link${unresolvedAspects.length === 1 ? '' : 's'} unresolved</span>`
    : '';

  return `
    <section class="detail-section synergy-panel" data-synergy-panel>
      <div class="detail-section-heading">
        <div>
          <h3>ASTRIX synergy recommendations</h3>
          <p class="synergy-intro">Deterministic recommendations from verified component effects. Every result shows the recorded rule and selected aspect that caused the match.</p>
        </div>
        <span class="verification-badge ${build.verified ? 'verified' : 'pending'}">${build.verified ? 'Verified build' : 'Review required'}</span>
      </div>

      <div class="synergy-status-row">
        <span class="synergy-pill">Engine ${escapeHtml(result.engineVersion)}</span>
        <span class="synergy-pill">Status: ${escapeHtml(result.status)}</span>
        <span class="synergy-pill">Fragment slots ${escapeHtml(usedSlots)} / ${escapeHtml(slotLimit)}</span>
        ${linkageWarning}
      </div>

      ${result.status === 'missing build linkage'
        ? `<div class="synergy-empty"><strong>Insufficient verified data</strong><p>${escapeHtml(result.errors?.join(' ') || 'The build could not be linked to verified aspects.')}</p></div>`
        : `
          ${sectionMarkup('Recommended fragments', result.recommendations.fragments, componentsById, `${usedSlots} of ${slotLimit} slots used`)}
          ${sectionMarkup('Recommended artifact perks', result.recommendations.artifactPerks, componentsById)}
          ${sectionMarkup('Recommended gear sets', result.recommendations.setBonuses, componentsById)}
        `}
    </section>`;
}

function loadingPanelMarkup() {
  return `
    <section class="detail-section synergy-panel" data-synergy-panel>
      <div class="detail-section-heading"><h3>ASTRIX synergy recommendations</h3></div>
      <div class="synergy-loading">Loading the committed component library and deterministic engine…</div>
    </section>`;
}

function errorPanelMarkup(error) {
  return `
    <section class="detail-section synergy-panel" data-synergy-panel>
      <div class="detail-section-heading"><h3>ASTRIX synergy recommendations</h3></div>
      <div class="synergy-error"><strong>Insufficient verified data</strong><p>${escapeHtml(error.message)}</p></div>
    </section>`;
}

async function renderSynergyForBuild(buildId) {
  if (!detailRoot) return;

  detailRoot.querySelector('[data-synergy-panel]')?.remove();
  detailRoot.insertAdjacentHTML('beforeend', loadingPanelMarkup());

  try {
    const { buildCatalogue, componentCatalogue } = await loadStaticData();
    const build = buildCatalogue.builds.find((candidate) => candidate.id === buildId);
    if (!build) throw new Error('The selected build is not present in the committed build catalogue.');

    const aspectLinks = resolveBuildAspectIds(build, componentCatalogue.components);
    const result = recommendSynergies({
      catalogue: componentCatalogue,
      buildContext: {
        buildId: build.id,
        class: build.class,
        subclass: build.subclass,
        element: build.subclass,
        aspectIds: aspectLinks.resolvedIds,
        activity: build.activityTags?.[0] || null
      }
    });

    const componentsById = new Map(
      componentCatalogue.components.map((component) => [component.id, component])
    );

    detailRoot.querySelector('[data-synergy-panel]')?.remove();
    detailRoot.insertAdjacentHTML(
      'beforeend',
      enginePanelMarkup(build, result, componentsById, aspectLinks.unresolved)
    );
  } catch (error) {
    console.error('Unable to render static synergy recommendations', error);
    detailRoot.querySelector('[data-synergy-panel]')?.remove();
    detailRoot.insertAdjacentHTML('beforeend', errorPanelMarkup(error));
  }
}

document.addEventListener('click', (event) => {
  const trigger = event.target.closest('[data-open-build]');
  if (!trigger) return;

  const buildId = trigger.dataset.openBuild;
  queueMicrotask(() => renderSynergyForBuild(buildId));
});
