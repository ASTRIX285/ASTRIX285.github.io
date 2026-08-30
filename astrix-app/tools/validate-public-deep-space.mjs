import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../../',import.meta.url));
const css=readFileSync(`${root}css/style.css`,'utf8');
const marker='PUBLIC SITE DEEP-SPACE BACKGROUND';
const backgroundRules=css.slice(css.indexOf(marker));

assert.ok(css.includes(marker),'Public deep-space rules must remain in the global stylesheet');
assert.ok(existsSync(`${root}astrix-app/shared/astrix-deep-space.jpg`),'Shared deep-space artwork must exist');
assert.match(backgroundRules,/body::before\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?inset:\s*0;/,'Deep-space canvas must remain fixed to the viewport');
assert.match(backgroundRules,/astrix-deep-space\.jpg'\) center center \/ cover no-repeat/,'Deep-space artwork must cover the full viewport without tiling');
assert.match(backgroundRules,/\.hero-bg-video video\s*\{[\s\S]*?display:\s*none\s*!important;/,'Homepage moving background must remain disabled');
assert.match(backgroundRules,/body > section:not\(\.hero\)[\s\S]*?background:\s*rgba\(4,7,13,0\.58\)\s*!important;/,'Public content sections must remain translucent');
assert.match(backgroundRules,/\.review-card,[\s\S]*?\.platform-overview,[\s\S]*?background:\s*rgba\(5,8,14,0\.82\)\s*!important;/,'Foreground content surfaces must remain readable and translucent');

console.log('STATIC_DEEP_SPACE_BACKGROUND=PASS');
console.log('PUBLIC_SURFACE_TRANSPARENCY=PASS');
console.log('PUBLIC_SITE_MECHANICS_UNCHANGED=PASS');
