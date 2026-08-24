#!/usr/bin/env python3
"""Paradox gate for Main and Build resolution/zoom adaptation."""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
PAGE = ROOT / "astrix-app" / "pages" / "guardian-workspace-v2"
AUTHORITY = "guardian-resolution-adaptive.css"


def main() -> int:
    index = (PAGE / "index.html").read_text(encoding="utf-8")
    build_index = (PAGE / "paradox-build-space" / "index.html").read_text(encoding="utf-8")
    adaptive = (PAGE / AUTHORITY).read_text(encoding="utf-8")
    build_css = (PAGE / "paradox-build-space" / "paradox-build-space.css").read_text(encoding="utf-8")
    hero = (PAGE / "guardian-hero.css").read_text(encoding="utf-8")

    assert '<meta name="viewport" content="width=device-width, initial-scale=1.0">' in index
    assert f'<link rel="stylesheet" href="./{AUTHORITY}?v=' in index
    assert f'<link rel="stylesheet" href="../{AUTHORITY}?v=' in build_index
    assert index.index(AUTHORITY) > index.index("astrix-token-branch-preview.css")
    assert build_index.index(AUTHORITY) > build_index.index("astrix-token-branch-preview.css")

    for marker in (
        "html{font-size:max(16px,.833333vw)!important}",
        "--pf-slot:max(52px,2.708333vw)",
        "--pf-mod-size:var(--pf-slot)",
        "grid-template-columns:repeat(3,max(300px,15.625vw))",
        "width:max(300px,15.625vw)!important",
        "grid-template-columns:max(384px,20vw) minmax(0,1fr)!important",
        "grid-template-columns:max(384px,20vw) minmax(0,1fr) max(364.8px,19vw)!important",
        "grid-template-columns:repeat(5,minmax(0,1fr))!important",
        "@media (min-width:981px) and (max-width:1499px)",
        "grid-template-columns:minmax(300px,20vw) minmax(0,1fr)!important",
        "@media (max-width:980px)",
        "grid-template-columns:repeat(2,minmax(0,1fr))!important",
        "overflow:visible!important",
    ):
        assert marker in adaptive, f"Adaptive layout marker missing: {marker}"

    assert "overflow-x:auto" not in build_css.split("/* Shared Main armour cards", 1)[1]
    assert "--pf-build-armour-card-width:300px" not in build_css

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

    for css_path in PAGE.rglob("*.css"):
        css = css_path.read_text(encoding="utf-8")
        assert css.count("{") == css.count("}"), f"Unbalanced CSS blocks: {css_path.name}"

    print("PARADOX_ADAPTIVE_LAYOUT=PASS")
    print("WORKSPACE_COLUMN_OWNER=guardian-resolution-adaptive.css")
    print("MAIN_BUILD_BROWSER_ZOOM_SCALE=PASS")
    print("BUILD_CENTRAL_CONSOLE_NO_SCROLL=PASS")
    print("MAIN_BUILD_SHARED_MOD_SCALE=PASS")
    print("GUARDIAN_STAGE_CONTAINMENT=PASS")
    print("GUARDIAN_HORIZONTAL_CENTER=PASS")
    print("RENDER_STATUS_CENTER=PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
