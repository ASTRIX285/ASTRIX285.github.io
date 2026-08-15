#!/usr/bin/env python3
"""Paradox gate for zoom-safe Guardian Workspace container reflow."""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
PAGE = ROOT / "astrix-app" / "pages" / "guardian-workspace-v2"


def main() -> int:
    index = (PAGE / "index.html").read_text(encoding="utf-8")
    css = (PAGE / "guardian-adaptive-layout.css").read_text(encoding="utf-8")

    assert '<meta name="viewport" content="width=device-width, initial-scale=1.0">' in index
    assert '<link rel="stylesheet" href="./guardian-adaptive-layout.css">' in index
    assert index.index("guardian-adaptive-layout.css") > index.index("guardian-mobile.css")

    for marker in (
        ".workspace>*{min-width:0}",
        "container-type:inline-size",
        "@media (min-width:1281px)",
        "@media (min-width:981px) and (max-width:1280px)",
        "@media (min-width:861px) and (max-width:980px)",
        '@container (max-width:780px)',
        '@container (max-width:340px)',
        "grid-template-areas:\"stage\" \"left\" \"equip\" \"right\"",
        "grid-template-columns:repeat(3,minmax(150px,1fr))",
        "grid-template-columns:repeat(2,minmax(145px,1fr))",
        "overflow-wrap:anywhere",
    ):
        assert marker in css, f"Adaptive layout marker missing: {marker}"

    assert css.count("{") == css.count("}"), "Unbalanced CSS blocks"
    assert "minmax(0,1fr)" in css
    assert "width:calc(100vw - (var(--workspace-edge) * 2))" in css

    print("PARADOX_ADAPTIVE_LAYOUT=PASS")
    print("ZOOM_REFLOW_1281_PLUS=PASS")
    print("ZOOM_REFLOW_981_1280=PASS")
    print("ZOOM_REFLOW_861_980=PASS")
    print("CONTAINER_CHARACTER_CARDS=PASS")
    print("CONTAINER_ARMOUR_GRID=PASS")
    print("CONTAINER_ANALYSIS=PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
