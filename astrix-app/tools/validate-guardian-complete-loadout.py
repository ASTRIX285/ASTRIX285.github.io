#!/usr/bin/env python3
"""Paradox gate for complete Bungie character and in-game loadout mapping."""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
PAGE = ROOT / "astrix-app" / "pages" / "guardian-workspace-v2"


def main() -> int:
    profile = (PAGE / "guardian-bungie-profile.mjs").read_text(encoding="utf-8")
    advisor = (PAGE / "guardian-advisor-layer.mjs").read_text(encoding="utf-8")
    gear = (PAGE / "guardian-gear-layout.mjs").read_text(encoding="utf-8")
    cards_css = (PAGE / "guardian-character-cards.css").read_text(encoding="utf-8")

    # Subclass socket data must be promoted to the renderer's public contract.
    for field in (
        "super:subclassBuild.super",
        "classAbility:subclassBuild.classAbility",
        "movement:subclassBuild.movement",
        "melee:subclassBuild.melee",
        "grenade:subclassBuild.grenade",
        "abilities:subclassBuild.abilities",
        "aspects:subclassBuild.aspects",
        "fragments:subclassBuild.fragments",
        "superOptions:subclassBuild.superOptions",
        'subclassIcon:subclass?.icon||""',
    ):
        assert field in profile, f"Missing public subclass field: {field}"

    assert "function currentArtifact(" in profile
    assert "artifact," in profile
    assert "function identityCosmetics(" in profile
    assert "emblem:{hash:character.emblemHash" in profile
    assert "shader," in profile and "ornament," in profile
    assert "appearancePlugs:[shader,ornament].filter(Boolean)" in profile

    # Every selected loadout must carry equipment sockets and be rejected if
    # Bungie's response cannot support a truthful complete render.
    assert "function profileWithSelectedLoadout(" in profile
    assert "Array.isArray(item.plugItemHashes)" in profile
    assert "function loadoutCoverage(" in profile
    for category in (
        'missing.push("super")',
        'missing.push("abilities")',
        'missing.push("aspects")',
        'missing.push("fragments")',
        'missing.push("weapons")',
        'missing.push("armour")',
        'missing.push("subclass sockets")',
    ):
        assert category in profile, f"Coverage gate missing: {category}"
    assert "if(!detail.coverage.complete)" in profile
    assert "itemComponents?.reusablePlugs" in profile
    assert "reusablePlugsAvailable" in profile

    # The page regions consume the same contract rather than retaining fixture data.
    assert "data.super" in advisor
    assert "data.classAbility" in advisor
    assert "Array.isArray(data.aspects)" in advisor
    assert "Array.isArray(data.fragments)" in advisor
    assert "data.artifact" in advisor
    assert "ensureClassSuperRow" in advisor
    assert "data.superOptions??data.subclassBuild?.superOptions" in advisor
    assert 'type="button" class="super-option' in advisor
    assert "available in future build editor" in advisor
    assert ".class-super-row" in cards_css
    assert "clip-path:polygon(50% 0,100% 50%,50% 100%,0 50%)" in cards_css
    assert ".super-option.is-active" in cards_css
    assert ".super-option.is-inactive" in cards_css
    assert ".super-options::-webkit-scrollbar{display:none" in cards_css
    assert "const mods=Array.isArray(item?.mods)?item.mods:[]" in gear
    assert "Array.from({length:slotCount}" in gear
    assert "modTile(mods[i])" in gear
    assert "appearancePlugs" in gear

    print("PARADOX_COMPLETE_LOADOUT=PASS")
    print("SUPER_ABILITIES_ASPECTS_FRAGMENTS=PASS")
    print("WEAPONS_ARMOUR_MODS=PASS")
    print("ARTIFACT_CHARACTER_CONTEXT=PASS")
    print("EMBLEM_SHADER_ORNAMENT=PASS")
    print("CLASS_SUPER_SELECTOR=PASS")
    print("SUPER_DIAMOND_CONTROLS=PASS")
    print("INCOMPLETE_BUNGIE_PAYLOAD_REJECTED=PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
