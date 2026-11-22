const PATHS = {
  fish: '<path d="M16 7c-5-5-10-2-13 3 3 5 8 8 13 3l5 4V3z"/><circle cx="7.5" cy="9" r=".6" fill="currentColor"/>',
  home: '<path d="m3 10 9-7 9 7M5 9v12h14V9M9 21v-7h6v7"/>',
  leaf: '<path d="M20 3C7 2 2 9 6 15s13 4 14-12ZM4 21 16 9"/>',
  book: '<path d="M3 4h6a4 4 0 0 1 3 2 4 4 0 0 1 3-2h6v15h-6a4 4 0 0 0-3 2 4 4 0 0 0-3-2H3ZM12 6v15"/>',
  settings: '<path d="m14 3 1 3 3 1 3-1 1 4-2 2 1 3-2 3-3-1-2 2-4-1-1-3-3-1-1-4 2-2V5l4-1z"/><circle cx="12" cy="11" r="3"/>',
  arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
  refresh: '<path d="M20 7v5h-5M4 17v-5h5M6 6a8 8 0 0 1 13 3M5 15a8 8 0 0 0 13 3"/>',
  pin: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  check: '<path d="m5 12 4 4L20 5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 10v7m0-11v1"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 5-5 4 4 4-6 5 7"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  spark: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
};
export function icon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.5'); svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = PATHS[name] ?? PATHS.leaf;
  return svg;
}
let serial = 0;
/** Original vector placeholders; no external imagery or character art. */
export function illustration(kind = 'home') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const id = `sw-art-${++serial}`;
  svg.setAttribute('class', 'sw-illustration'); svg.setAttribute('viewBox', '0 0 800 400');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid slice'); svg.setAttribute('aria-hidden', 'true');
  if (kind === 'home') svg.innerHTML = `
    <defs><linearGradient id="${id}-sky" x2="0" y2="1"><stop stop-color="#dce8dc"/><stop offset="1" stop-color="#c8d8c7"/></linearGradient><linearGradient id="${id}-floor" x2="0" y2="1"><stop stop-color="#b8c9b1"/><stop offset="1" stop-color="#8da991"/></linearGradient></defs>
    <path fill="#e6eadd" d="M0 0h800v400H0z"/><path fill="#dce3d2" d="M0 0h219v275H0z"/>
    <path fill="url(#${id}-floor)" d="M0 273h800v127H0z"/><path fill="#aabb9e" opacity=".35" d="m442 272 241 128h117V274z"/>
    <rect x="260" y="28" width="262" height="211" rx="2" fill="#9cb09c"/><rect x="268" y="35" width="246" height="195" fill="url(#${id}-sky)"/>
    <circle cx="445" cy="83" r="29" fill="#f7f0ce"/><path d="M268 162q45-65 90-21t79-5 77 9v85H268" fill="#93b29a" opacity=".6"/><path d="M268 196q56-38 108-4t138-20v58H268" fill="#739d89" opacity=".45"/>
    <path d="M390 35v195M268 130h246" fill="none" stroke="#e6ebdc" stroke-width="9"/><path fill="#cbd7bd" d="M243 15h38v240h-40q24-100 2-240m267 0h35v240h-35q-18-120 0-240"/><path d="M238 17h313" stroke="#899d81" stroke-width="5"/>
    <rect x="47" y="179" width="153" height="109" rx="5" fill="#aebf9f"/><rect x="56" y="193" width="135" height="42" fill="#ced7bb"/><path d="M98 193v42m48-42v42M56 246h135" stroke="#8fa27e" stroke-width="3"/><path d="M66 194v37m8-39v39m9-35v35m28-38v38m8-39v39m9-34v34m29-38 8 38m4-36 8 36" stroke="#8a9d7b" stroke-width="6"/>
    <rect x="72" y="70" width="81" height="73" fill="#bccbad"/><rect x="79" y="77" width="67" height="59" fill="#edf0df"/><path d="m90 123 13-31 12 31m-4-8 13-27 13 35" stroke="#96ad8e" stroke-width="3" fill="none"/>
    <ellipse cx="462" cy="344" rx="181" ry="40" fill="#a4b89b" opacity=".75"/><path d="M554 191h119v89H554z" fill="#819f89"/><rect x="495" y="214" width="186" height="85" rx="18" fill="#94ad91"/><rect x="484" y="231" width="33" height="70" rx="12" fill="#789b82"/><rect x="661" y="231" width="30" height="70" rx="12" fill="#789b82"/><path d="M517 258h143" stroke="#658b73" stroke-width="2"/><rect x="537" y="220" width="48" height="35" rx="7" fill="#cbd6b4" transform="rotate(-8 537 220)"/><path d="M506 300v12m163-12v12" stroke="#65836b" stroke-width="6"/>
    <ellipse cx="432" cy="291" rx="67" ry="17" fill="#b6c4a0"/><path d="M379 292v44m105-44v44" stroke="#819674" stroke-width="6"/><path d="M420 286h24v-8h-24z" fill="#e6e4c7"/><path d="M442 279q12-1 8 8h-8" stroke="#e6e4c7" fill="none" stroke-width="3"/><path d="m392 285 13-10 17 6-13 10z" fill="#d4d8b7"/>
    <path d="M733 275v-86m0 40q-31-31-27-44 28 3 27 35m0-14q10-37 29-39 7 24-29 46m-1-7q-22-24-16-42 21 7 17 36" stroke="#6a926f" stroke-width="4" fill="#86a17a"/><path d="M714 260h39l-7 38h-25z" fill="#a8b28b"/>
    <path d="M0 274h800" stroke="#78946f" stroke-opacity=".25"/><path d="m92 322 42 78m162-127 12 127m300-127-39 127" stroke="#668d72" stroke-opacity=".13"/>`;
  else svg.innerHTML = `
    <defs><linearGradient id="${id}-sky" x2="0" y2="1"><stop stop-color="#e7e0bf"/><stop offset="1" stop-color="#c1d4bc"/></linearGradient><linearGradient id="${id}-river" x2="0" y2="1"><stop stop-color="#9dbfb4"/><stop offset="1" stop-color="#719e94"/></linearGradient></defs>
    <path fill="url(#${id}-sky)" d="M0 0h800v400H0z"/><circle cx="584" cy="91" r="39" fill="#faf0c6"/>
    <path d="M0 159Q115 55 237 144T478 136 800 133v267H0" fill="#adc2a5"/><path d="M0 214Q128 127 268 192t261-12 271 31v189H0" fill="#86a98e"/>
    <path d="M407 202q-98 60-46 89t-89 109h331q-69-57-126-89t15-109" fill="url(#${id}-river)"/>
    <path d="M0 272q129-71 361-6-106 45-89 134H0" fill="#698f76"/><path d="M490 243q139-38 310 12v145H603q-30-56-122-97-52-20 9-60" fill="#75987a"/>
    <path d="m229 268 309-17 4 21-315 19z" fill="#9eaa86"/><path d="m237 264 299-17" stroke="#c5c7a0" stroke-width="7"/><path d="m252 258-2-49m85 44v-48m89 43-1-48m93 44-1-48m-269 28 273-17" stroke="#6e8065" fill="none" stroke-width="7"/><path d="m259 285-1 40m251-54 4 36" stroke="#6a7e62" stroke-width="11"/>
    <path d="m394 326 38-1m-60 15 81-2m-116 31 111-2m-59 16 76-2m17-86 28-1" stroke="#d8e2c4" stroke-width="2" stroke-linecap="round" opacity=".55"/>
    <g stroke="#4c7961" stroke-width="3" fill="none"><path d="m78 338 3-101m-4 54-24-31m29 14 23-36m-5 103 16-79m-2 29 22-17m-2 87 14-110m-3 47-17-18m508 84-5-93m4 51 26-33m-5 83 14-119m-7 52 28-28m4 91 2-71m-1 33 23-17"/></g>
    <g fill="#acc0a0"><ellipse cx="79" cy="234" rx="4" ry="12"/><ellipse cx="106" cy="237" rx="4" ry="12" transform="rotate(35 106 237)"/><ellipse cx="147" cy="248" rx="4" ry="12"/><ellipse cx="673" cy="238" rx="4" ry="13"/></g>
    ${kind === 'ending' ? '<path d="m564 306 68-8 5 42-68 8z" fill="#e8e4c5"/><path d="m576 317 42-5m-41 13 32-4" stroke="#9ca68c" stroke-width="2"/><path d="M566 327q-23-12-15-33t-6-24" stroke="#557fa1" stroke-width="5" fill="none"/>' : '<path d="m326 298 14-5 9 25-14 5z" fill="#c7ddd2" stroke="#83ab9a" stroke-width="2" transform="rotate(18 336 308)"/><path d="m332 302 8-2 3 12-8 3z" fill="#e5e3c7"/>'}
    <path d="M0 383q141-15 229 17H0m628 0q113-46 172-26v26" fill="#507d65" opacity=".65"/>`;
  return svg;
}
