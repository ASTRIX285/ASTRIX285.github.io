/* ==========================================================================
   ASTRIX PARADOX - BOTTOM PANEL HEIGHT LOCK & EQUALIZER
   Locks the vertical stretch alignment of weapon and armour columns across
   reflow breakpoints and container mutations.
   ========================================================================== */

function lockBottomPanelHeights() {
  let style = document.getElementById('astrix-bottom-equal-height');
  if (!style) {
    style = document.createElement('style');
    style.id = 'astrix-bottom-equal-height';
    style.textContent = `
      .equip.gear-layout-active {
        align-items: stretch !important;
      }
      .equip.gear-layout-active > .gear-weapons {
        height: auto !important;
        min-height: 100% !important;
        align-self: stretch !important;
        box-sizing: border-box !important;
      }
      .equip.gear-layout-active > .gear-combined {
        align-self: stretch !important;
        box-sizing: border-box !important;
      }
    `;
    document.head.appendChild(style);
  }
}

lockBottomPanelHeights();
document.addEventListener('astrix:guardian-selection-changed', lockBottomPanelHeights);
document.addEventListener('astrix:beta-fixture-loaded', lockBottomPanelHeights);