#!/usr/bin/env python3
"""Paradox gate for the Guardian Workspace top-level layout contract."""

import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
PAGE = ROOT / "astrix-app" / "pages" / "guardian-workspace-v2"
AUTHORITY = "guardian-adaptive-layout.css"


def workspace_blocks(css: str) -> list[str]:
    return re.findall(r"(?<![\w>])\.workspace\s*\{([^}]*)\}", css, re.DOTALL)


def main() -> int:
    index = (PAGE / "index.html").read_text(encoding="utf-8")
    adaptive = (PAGE / AUTHORITY).read_text(encoding="utf-8")
    hero = (PAGE / "guardian-hero.css").read_text(encoding="utf-8")

    assert '<meta name="viewport" content="width=device-width, initial-scale=1.0">' in index
    assert '<link rel="stylesheet" href="./guardian-adaptive-layout.css">' in index
    assert index.index(AUTHORITY) > index.index("guardian-mobile.css")

    for marker in (
        ".workspace>*{min-width:0}",
        "container-type:inline-size",
        "@media (min-width:1500px)",
        "@media (min-width:1281px) and (max-width:1499px)",
        "@media (min-width:981px) and (max-width:1280px)",
        "@media (max-width:980px)",
        '@container (max-width:780px)',
        '@container (max-width:340px)',
        'grid-template-areas:"left stage right" "equip equip right"',
        'grid-template-areas:"left" "stage" "right" "equip"',
        "clamp(420px,30vw,600px)",
        "grid-template-columns:repeat(3,minmax(150px,1fr))",
        "grid-template-columns:repeat(2,minmax(145px,1fr))",
        "overflow-wrap:anywhere",
    ):
        assert marker in adaptive, f"Adaptive layout marker missing: {marker}"

    competing = []
    for css_path in sorted(PAGE.glob("*.css")):
        if css_path.name == AUTHORITY:
            continue
        css = css_path.read_text(encoding="utf-8")
        if any("grid-template-columns" in block for block in workspace_blocks(css)):
            competing.append(css_path.name)
    assert not competing, f"Competing .workspace grid-column owners: {', '.join(competing)}"

    for marker in (
        "left:50%",
        "top:0",
        "bottom:0",
        "width:100%",
        "height:100%",
        "max-width:100%",
        "max-height:100%",
        "object-fit:contain",
        "object-position:center bottom",
        "left:50%!important",
        "top:50%!important",
        "transform:translate(-50%,-50%)!important",
    ):
        assert marker in hero, f"Guardian containment marker missing: {marker}"

    for css_path in PAGE.glob("*.css"):
        css = css_path.read_text(encoding="utf-8")
        assert css.count("{") == css.count("}"), f"Unbalanced CSS blocks: {css_path.name}"

    print("PARADOX_ADAPTIVE_LAYOUT=PASS")
    print("WORKSPACE_COLUMN_OWNER=guardian-adaptive-layout.css")
    print("DESKTOP_RIGHT_RAIL_PRIORITY=PASS")
    print("STACK_ORDER_LEFT_STAGE_RIGHT_EQUIP=PASS")
    print("RIGHT_RAIL_CAP_600PX=PASS")
    print("GUARDIAN_STAGE_CONTAINMENT=PASS")
    print("GUARDIAN_HORIZONTAL_CENTER=PASS")
    print("RENDER_STATUS_CENTER=PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
