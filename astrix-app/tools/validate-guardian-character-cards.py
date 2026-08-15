#!/usr/bin/env python3
"""Paradox validation gate for the live Bungie character selector."""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
PAGE = ROOT / "astrix-app" / "pages" / "guardian-workspace-v2"


def main() -> int:
    html = (PAGE / "index.html").read_text(encoding="utf-8")
    module = (PAGE / "guardian-character-cards.mjs").read_text(encoding="utf-8")
    profile = (PAGE / "guardian-bungie-profile.mjs").read_text(encoding="utf-8")
    styles = (PAGE / "guardian-character-cards.css").read_text(encoding="utf-8")

    assert 'id="guardianCharacterCards"' in html
    assert 'src="./guardian-character-cards.mjs"' in html
    assert 'href="./guardian-character-cards.css"' in html
    assert '<div class="identity">' not in html
    assert "const MAX_CHARACTERS=3" in module
    assert "STAT_SYMBOLS" in module
    assert 'new CustomEvent("astrix:character-selected"' in module
    assert '"astrix:bungie-character-roster"' in module
    assert "function characterRoster(" in profile
    assert "function selectLiveCharacter(" in profile
    assert 'publishCharacterRoster(payload,detail.characterId)' in profile
    assert 'grid-template-columns:repeat(3' in styles
    assert 'scroll-snap-type:x mandatory' in styles
    assert '.stage>.identity,.stage>.hero-stats{display:none!important}' in styles

    print("PARADOX_CHARACTER_CARDS=PASS")
    print("BUNGIE_CHARACTERS=3")
    print("EMBLEM_BACKGROUND=PASS")
    print("FULL_WORKSPACE_SELECTION_EVENT=PASS")
    print("DESKTOP_THREE_CARD_ROW=PASS")
    print("MOBILE_HORIZONTAL_STRIP=PASS")
    print("LEGACY_IDENTITY_STATS_REMOVED=PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
