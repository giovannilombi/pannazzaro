// Le tre grafiche del gioco (disegni originali): A "chiostro" di maiolica, B "vicolo" di sera, C "bottega" di carta (telefono).
// Ogni grafica dà: cornice con pavimento e archi, i quattro tappeti, Peppo con il fez.
// Unità di disegno: casella = 80, tabellone da 120 a 680 (come nei bozzetti), gli archi stanno nel margine.
const c = i => 160 + 80 * i;

/* ---------------- archi ---------------- */
// id come in board.js (arcId): N0-2, E0-2, S0-2, W0-2, NE, SW
function roundArcs() {
  const out = [];
  for (let k = 0; k < 3; k++) {
    const a = c(2 * k), b = c(2 * k + 1), p = c(2 * k + 1), q = c(2 * k + 2);
    out.push([`N${k}`, `M${a},120 A40,40 0 0 1 ${b},120`], [`W${k}`, `M120,${a} A40,40 0 0 0 120,${b}`]);
    out.push([`S${k}`, `M${p},680 A40,40 0 0 0 ${q},680`], [`E${k}`, `M680,${p} A40,40 0 0 1 680,${q}`]);
  }
  out.push(['NE', 'M640,120 A40,40 0 1 1 680,160'], ['SW', 'M160,680 A40,40 0 1 1 120,640']);
  return out;
}
function squareArcs() { // maniglie basse a spigoli arrotondati: sporgono 24 invece di 40
  const out = [];
  for (let k = 0; k < 3; k++) {
    const a = c(2 * k), b = c(2 * k + 1), p = c(2 * k + 1), q = c(2 * k + 2);
    out.push([`N${k}`, `M${a},120 V108 Q${a},96 ${a + 12},96 H${b - 12} Q${b},96 ${b},108 V120`]);
    out.push([`W${k}`, `M120,${a} H108 Q96,${a} 96,${a + 12} V${b - 12} Q96,${b} 108,${b} H120`]);
    out.push([`S${k}`, `M${p},680 V692 Q${p},704 ${p + 12},704 H${q - 12} Q${q},704 ${q},692 V680`]);
    out.push([`E${k}`, `M680,${p} H692 Q704,${p} 704,${p + 12} V${q - 12} Q704,${q} 692,${q} H680`]);
  }
  out.push(['NE', 'M640,120 V108 Q640,96 652,96 H692 Q704,96 704,108 V148 Q704,160 692,160 H680']);
  out.push(['SW', 'M160,680 V692 Q160,704 148,704 H108 Q96,704 96,692 V652 Q96,640 108,640 H120']);
  return out;
}
const arcsSvg = list => list.map(([id, d]) => `<g class="arc" data-arc="${id}"><path class="a1" d="${d}"/><path class="a2" d="${d}"/><path class="a3" d="${d}"/></g>`).join('');
const floor = '<rect x="120" y="120" width="560" height="560" fill="url(#pz-floor)"/>';

/* ---------------- tappeti ---------------- */
// Disegnati in 152×72 (due caselle meno il bordo); board.js li mette in un riquadro 160×80.
const fringe = col => `<path d="M-3,5 V67 M155,5 V67" fill="none" stroke="${col}" stroke-width="7" stroke-dasharray="2.5 3"/>`;

const A_RUGS = {
  pomodoro: `${fringe('#F3E6C8')}<rect width="152" height="72" rx="6" fill="#D4402E" stroke="#3A120C" stroke-width="2.5"/>
    <rect x="7" y="7" width="138" height="58" rx="3" fill="none" stroke="#F6D9A8" stroke-width="2.5"/>
    <path d="M40,16 L58,36 L40,56 L22,36 Z M76,16 L94,36 L76,56 L58,36 Z M112,16 L130,36 L112,56 L94,36 Z" fill="#F6D9A8"/>
    <path d="M40,26 L49,36 L40,46 L31,36 Z M76,26 L85,36 L76,46 L67,36 Z M112,26 L121,36 L112,46 L103,36 Z" fill="#8E1F17"/>
    <circle cx="40" cy="36" r="2.5" fill="#F6D9A8"/><circle cx="76" cy="36" r="2.5" fill="#F6D9A8"/><circle cx="112" cy="36" r="2.5" fill="#F6D9A8"/>`,
  melanzana: `${fringe('#F3E6C8')}<rect width="152" height="72" rx="6" fill="#6A3C9C" stroke="#24103F" stroke-width="2.5"/>
    <rect x="7" y="7" width="138" height="58" rx="3" fill="none" stroke="#E7D4F6" stroke-width="2.5"/>
    <path d="M16,28 L28,18 L40,28 L52,18 L64,28 L76,18 L88,28 L100,18 L112,28 L124,18 L136,28 M16,54 L28,44 L40,54 L52,44 L64,54 L76,44 L88,54 L100,44 L112,54 L124,44 L136,54" fill="none" stroke="#E7D4F6" stroke-width="4"/>
    <path d="M16,41 L28,31 L40,41 L52,31 L64,41 L76,31 L88,41 L100,31 L112,41 L124,31 L136,41" fill="none" stroke="#F2A93B" stroke-width="4"/>`,
  limone: `${fringe('#F3E6C8')}<rect width="152" height="72" rx="6" fill="#F0BE2C" stroke="#4A3200" stroke-width="2.5"/>
    <rect x="7" y="7" width="138" height="58" rx="3" fill="none" stroke="#1F4E8C" stroke-width="2.5"/>
    <path d="M44,18 L49,31 L62,36 L49,41 L44,54 L39,41 L26,36 L39,31 Z M108,18 L113,31 L126,36 L113,41 L108,54 L103,41 L90,36 L103,31 Z" fill="#1F4E8C"/>
    <rect x="31" y="23" width="26" height="26" fill="none" stroke="#1F4E8C" stroke-width="2.5" transform="rotate(45 44 36)"/>
    <rect x="95" y="23" width="26" height="26" fill="none" stroke="#1F4E8C" stroke-width="2.5" transform="rotate(45 108 36)"/>
    <circle cx="44" cy="36" r="4" fill="#FFF6D6"/><circle cx="108" cy="36" r="4" fill="#FFF6D6"/>
    <path d="M76,24 L84,36 L76,48 L68,36 Z" fill="#FFF6D6" stroke="#1F4E8C" stroke-width="2"/>`,
  basilico: `${fringe('#F3E6C8')}<rect width="152" height="72" rx="6" fill="#2F8A5B" stroke="#0E3320" stroke-width="2.5"/>
    <rect x="7" y="7" width="138" height="58" rx="3" fill="none" stroke="#D9F0D0" stroke-width="2.5"/>
    <path d="M14,14 L26,26 L38,14 L50,26 L62,14 L74,26 L86,14 L98,26 L110,14 L122,26 L134,14 L138,14 L138,12 L14,12 Z M14,58 L26,46 L38,58 L50,46 L62,58 L74,46 L86,58 L98,46 L110,58 L122,46 L134,58 L138,58 L138,60 L14,60 Z" fill="#D9F0D0"/>
    <rect x="18" y="32" width="116" height="8" rx="4" fill="#16553A"/>
    <circle cx="40" cy="36" r="3" fill="#F2C230"/><circle cx="76" cy="36" r="3" fill="#F2C230"/><circle cx="112" cy="36" r="3" fill="#F2C230"/>`,
};

const B_RUGS = {
  pomodoro: `${fringe('#F4EFE3')}<rect width="152" height="72" rx="5" fill="#E5503C" stroke="#F4EFE3" stroke-width="2.5"/>
    <rect x="8" y="24" width="136" height="24" fill="#F4EFE3"/>
    <path d="M22,36 L32,27 L42,36 L32,45 Z M54,36 L64,27 L74,36 L64,45 Z M86,36 L96,27 L106,36 L96,45 Z M118,36 L128,27 L138,36 L128,45 Z" fill="#B92D1F"/>
    <path d="M8,13 H144 M8,59 H144" fill="none" stroke="#7E170E" stroke-width="4"/>`,
  melanzana: `${fringe('#F4EFE3')}<rect width="152" height="72" rx="5" fill="#9A5BD6" stroke="#F4EFE3" stroke-width="2.5"/>
    <path d="M22,8 V64 M46,8 V64 M106,8 V64 M130,8 V64" fill="none" stroke="#3F1D6B" stroke-width="8"/>
    <path d="M34,8 V64 M118,8 V64" fill="none" stroke="#F4EFE3" stroke-width="3"/>
    <circle cx="76" cy="36" r="17" fill="#3F1D6B"/><circle cx="76" cy="36" r="10" fill="none" stroke="#F4EFE3" stroke-width="3"/><circle cx="76" cy="36" r="3.5" fill="#FFB03A"/>`,
  limone: `${fringe('#F4EFE3')}<rect width="152" height="72" rx="5" fill="#F5C73A" stroke="#F4EFE3" stroke-width="2.5"/>
    <path d="M12,12 H140 V60 H12 Z" fill="none" stroke="#1B2B52" stroke-width="4" stroke-dasharray="8 8"/>
    <path d="M28,36 L52,22 L76,36 L100,22 L124,36 L100,50 L76,36 L52,50 Z" fill="none" stroke="#1B2B52" stroke-width="4" stroke-linejoin="round"/>
    <circle cx="52" cy="36" r="4" fill="#1B2B52"/><circle cx="100" cy="36" r="4" fill="#1B2B52"/>`,
  basilico: `${fringe('#F4EFE3')}<rect width="152" height="72" rx="5" fill="#38B27A" stroke="#F4EFE3" stroke-width="2.5"/>
    <path d="M8,16 H144 M8,56 H144" fill="none" stroke="#0E4B30" stroke-width="6"/>
    <path d="M8,26 H144 M8,46 H144" fill="none" stroke="#F4EFE3" stroke-width="2"/>
    <path d="M24,36 L34,30 L44,36 L34,42 Z M66,36 L76,30 L86,36 L76,42 Z M108,36 L118,30 L128,36 L118,42 Z" fill="#0E4B30"/>`,
};

const C_RUGS = {
  pomodoro: `<rect width="152" height="72" rx="8" fill="#E4572E" stroke="#231C14" stroke-width="3.5"/>
    <circle cx="38" cy="36" r="17" fill="#FFF8E7"/><circle cx="114" cy="36" r="17" fill="#FFF8E7"/>
    <circle cx="38" cy="36" r="8" fill="#E4572E"/><circle cx="114" cy="36" r="8" fill="#E4572E"/>
    <path d="M76,18 L88,36 L76,54 L64,36 Z" fill="#231C14"/>`,
  melanzana: `<rect width="152" height="72" rx="8" fill="#7B4FB8" stroke="#231C14" stroke-width="3.5"/>
    <path d="M22,14 L44,36 L22,58 M52,14 L74,36 L52,58 M82,14 L104,36 L82,58 M112,14 L134,36 L112,58" fill="none" stroke="#FFF8E7" stroke-width="9"/>`,
  limone: `<rect width="152" height="72" rx="8" fill="#F2C14E" stroke="#231C14" stroke-width="3.5"/>
    <path d="M14,58 A24,24 0 0 1 62,58 Z M90,14 A24,24 0 0 0 138,14 Z" fill="#231C14"/>
    <path d="M90,58 A24,24 0 0 1 138,58 Z M14,14 A24,24 0 0 0 62,14 Z" fill="#FFF8E7" stroke="#231C14" stroke-width="2.5"/>
    <circle cx="76" cy="36" r="6" fill="#231C14"/>`,
  basilico: `<rect width="152" height="72" rx="8" fill="#3E9B6B" stroke="#231C14" stroke-width="3.5"/>
    <path d="M12,12 L32,44 L52,12 Z M52,12 L72,44 L92,12 Z M92,12 L112,44 L132,12 Z" fill="#FFF8E7"/>
    <path d="M32,60 L52,28 L72,60 Z M72,60 L92,28 L112,60 Z" fill="#231C14"/>`,
};

/* ---------------- Peppo ---------------- */
// .pp-dir gira con la direzione (--rot). Nella A il corpo ha tre pose (davanti, dietro, di fianco) scelte da data-dir.
const svg = (cls, inner) => `<svg class="${cls}" viewBox="-40 -40 80 80" aria-hidden="true">${inner}</svg>`;
const A_FEZ = `<path d="M-9,-21 L-7,-34 H7 L9,-21 Z" fill="#C62F2A" stroke="#1C2433" stroke-width="2.5" stroke-linejoin="round"/>
  <ellipse cx="0" cy="-34" rx="7" ry="2.2" fill="#8E1F17" stroke="#1C2433" stroke-width="1.5"/>`;
const A_ROBE = '<path d="M-19,26 C-21,6 -13,-6 0,-6 C13,-6 21,6 19,26 C10,31 -10,31 -19,26 Z" fill="#F8F1E0" stroke="#1C2433" stroke-width="2.5"/>';
const A_PEPPO = `<div class="pp-dir">${svg('', `<circle r="33" fill="none" stroke="#F2C230" stroke-width="3" stroke-dasharray="4 5"/>
    <path d="M0,-53 L11,-38 H-11 Z" fill="#F2C230" stroke="#0F2547" stroke-width="2.5" stroke-linejoin="round"/>`)}</div>
  <div class="pp-body">
  ${svg('pose front', `<ellipse cx="0" cy="25" rx="26" ry="9" fill="#0B1830" opacity=".3"/>${A_ROBE}
    <path d="M-8,-5 C-10,6 -10,18 -7,29 M8,-5 C10,6 10,18 7,29" fill="none" stroke="#1F4E8C" stroke-width="6" stroke-linecap="round"/>
    <rect class="roll" x="-25" y="2" width="26" height="11" rx="5.5" stroke="#1C2433" stroke-width="2" transform="rotate(-24 -12 7)"/>
    <circle cx="0" cy="-15" r="11" fill="#E3AE80" stroke="#1C2433" stroke-width="2.5"/>
    <path d="M-8,-11 C-4,-14 -1,-13 0,-11 C1,-13 4,-14 8,-11 C5,-8 2,-9 0,-10 C-2,-9 -5,-8 -8,-11 Z" fill="#1C2433"/>
    <circle cx="-4" cy="-17" r="1.4" fill="#1C2433"/><circle cx="4" cy="-17" r="1.4" fill="#1C2433"/>${A_FEZ}
    <path d="M0,-34 C6,-36 10,-33 11,-27" fill="none" stroke="#1C2433" stroke-width="2" stroke-linecap="round"/>
    <rect x="9" y="-28" width="4" height="7" rx="1.5" fill="#F2C230" stroke="#1C2433" stroke-width="1"/>`)}
  ${svg('pose back', `<ellipse cx="0" cy="25" rx="26" ry="9" fill="#0B1830" opacity=".3"/>${A_ROBE}
    <path d="M-11,-4 C-14,8 -14,19 -11,28 C-4,30 4,30 11,28 C14,19 14,8 11,-4 C4,-7 -4,-7 -11,-4 Z" fill="#1F4E8C" stroke="#1C2433" stroke-width="2"/>
    <path d="M0,-4 V29" fill="none" stroke="#163A6B" stroke-width="2"/>
    <rect class="roll" x="-1" y="2" width="26" height="11" rx="5.5" stroke="#1C2433" stroke-width="2" transform="rotate(24 12 7)"/>
    <circle cx="0" cy="-15" r="11" fill="#E3AE80" stroke="#1C2433" stroke-width="2.5"/>
    <path d="M-10.5,-13 A10.6,10.6 0 0 0 10.5,-13 C6,-10 -6,-10 -10.5,-13 Z" fill="#1C2433"/>${A_FEZ}
    <path d="M0,-34 C1,-30 1,-26 0,-22" fill="none" stroke="#1C2433" stroke-width="2" stroke-linecap="round"/>
    <rect x="-2" y="-23" width="4" height="7" rx="1.5" fill="#F2C230" stroke="#1C2433" stroke-width="1"/>`)}
  ${svg('pose side', `<ellipse cx="0" cy="25" rx="22" ry="8" fill="#0B1830" opacity=".3"/>
    <path d="M-14,26 C-16,6 -9,-6 0,-6 C10,-6 15,6 14,26 C7,30 -7,30 -14,26 Z" fill="#F8F1E0" stroke="#1C2433" stroke-width="2.5"/>
    <path d="M-3,-5 C-7,6 -7,18 -4,29" fill="none" stroke="#1F4E8C" stroke-width="8" stroke-linecap="round"/>
    <rect class="roll" x="-6" y="3" width="28" height="11" rx="5.5" stroke="#1C2433" stroke-width="2" transform="rotate(-8 8 8)"/>
    <circle cx="1" cy="-15" r="11" fill="#E3AE80" stroke="#1C2433" stroke-width="2.5"/>
    <circle cx="12.5" cy="-13" r="2.6" fill="#E3AE80" stroke="#1C2433" stroke-width="2"/>
    <path d="M5,-11 C8,-13 12,-12 15,-8 C11,-8 8,-9 5,-11 Z" fill="#1C2433"/>
    <circle cx="7" cy="-17" r="1.4" fill="#1C2433"/>
    <path d="M-10,-14 A10.6,10.6 0 0 0 -3,-5.5 C-5,-9 -6,-12 -6,-16 Z" fill="#1C2433"/>
    <g transform="translate(1,0)">${A_FEZ}</g>
    <path d="M1,-34 C-5,-36 -9,-33 -10,-27" fill="none" stroke="#1C2433" stroke-width="2" stroke-linecap="round"/>
    <rect x="-12" y="-28" width="4" height="7" rx="1.5" fill="#F2C230" stroke="#1C2433" stroke-width="1"/>`)}
  </div>`;

const B_PEPPO = `<div class="pp-dir">${svg('', `<defs><linearGradient id="pz-cone" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#FFD27A" stop-opacity=".5"/><stop offset="1" stop-color="#FFD27A" stop-opacity="0"/></linearGradient></defs>
    <path d="M-7,-16 L-30,-74 A62,62 0 0 1 30,-74 L7,-16 Z" fill="url(#pz-cone)"/>
    <circle r="34" fill="#FFB03A" opacity=".14"/>
    <ellipse cx="0" cy="3" rx="22" ry="14" fill="#F4EFE3" stroke="#0C0D10" stroke-width="2.5"/>
    <path d="M-15,-6 C-19,0 -19,8 -14,13 M15,-6 C19,0 19,8 14,13" fill="none" stroke="#24437C" stroke-width="6" stroke-linecap="round"/>
    <rect class="roll" x="-18" y="-21" width="36" height="9" rx="4.5" stroke="#0C0D10" stroke-width="2"/>
    <circle cx="-13" cy="-13" r="4.5" fill="#E3AE80" stroke="#0C0D10" stroke-width="2"/><circle cx="13" cy="-13" r="4.5" fill="#E3AE80" stroke="#0C0D10" stroke-width="2"/>
    <circle r="12" fill="#D8372E" stroke="#0C0D10" stroke-width="2.5"/><circle r="7" fill="#AE241D"/>
    <path d="M0,0 C4,4 7,8 8,13" fill="none" stroke="#0C0D10" stroke-width="2.2" stroke-linecap="round"/>
    <rect x="6" y="12" width="4.5" height="8" rx="2" fill="#FFB03A" stroke="#0C0D10" stroke-width="1.2"/>`)}</div>`;

const C_PEPPO = `<div class="pp-dir">${svg('', '<path d="M0,-66 L13,-50 H-13 Z" fill="#231C14" stroke="#FFF8E7" stroke-width="3" stroke-linejoin="round"/>')}</div>
  <div class="pp-body">${svg('', `<ellipse cx="0" cy="27" rx="26" ry="8" fill="#231C14" opacity=".25"/>
    <path d="M-22,28 C-22,8 -14,2 0,2 C14,2 22,8 22,28 Z" fill="#FFF8E7" stroke="#231C14" stroke-width="3.5" stroke-linejoin="round"/>
    <path class="roll" d="M-12,4 L10,28 H-2 L-18,10 Z" stroke="#231C14" stroke-width="2.5" stroke-linejoin="round"/>
    <circle cx="0" cy="-10" r="15" fill="#E8B68A" stroke="#231C14" stroke-width="3.5"/>
    <circle cx="-5.5" cy="-12" r="2" fill="#231C14"/><circle cx="5.5" cy="-12" r="2" fill="#231C14"/>
    <path d="M-12,-3 C-8,-8 -2,-7 0,-4 C2,-7 8,-8 12,-3 C8,-1 3,-2 0,-3 C-3,-2 -8,-1 -12,-3 Z" fill="#231C14"/>
    <path d="M-13,-19 L-10,-40 H10 L13,-19 Z" fill="#D8372E" stroke="#231C14" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M0,-40 C9,-43 15,-38 16,-29" fill="none" stroke="#231C14" stroke-width="3" stroke-linecap="round"/>
    <rect x="13" y="-30" width="6" height="10" rx="2" fill="#F2C14E" stroke="#231C14" stroke-width="2"/>`)}</div>`;

/* ---------------- cornici ---------------- */
const dots = (pts, r, fill) => pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`).join('');
const A_FRAME = `<defs><pattern id="pz-floor" width="80" height="80" patternUnits="userSpaceOnUse" x="120" y="120">
    <rect width="80" height="80" fill="#F4ECDB"/>
    <circle r="20" fill="#ECE2CC"/><circle cx="80" r="20" fill="#ECE2CC"/><circle cy="80" r="20" fill="#ECE2CC"/><circle cx="80" cy="80" r="20" fill="#ECE2CC"/>
    <circle cx="40" cy="40" r="19" fill="none" stroke="#E6DAC0" stroke-width="3"/><path d="M40,31 L49,40 L40,49 L31,40 Z" fill="#E6DAC0"/>
    <path d="M0,0 H80 V80 H0 Z" fill="none" stroke="#DDD0B4" stroke-width="1.5"/></pattern>
    <g id="pz-rosette"><circle r="15" fill="#0F2547"/><path d="M0,-12 L3.5,-3.5 L12,0 L3.5,3.5 L0,12 L-3.5,3.5 L-12,0 L-3.5,-3.5 Z" fill="#F2C230"/><circle r="3.5" fill="#F8F1E0"/></g></defs>
  <rect x="56" y="56" width="688" height="688" rx="22" fill="#0F2547"/><rect x="62" y="62" width="676" height="676" rx="18" fill="#1F4E8C"/>
  <rect x="68" y="68" width="664" height="664" rx="14" fill="none" stroke="#F2C230" stroke-width="2.5"/>
  ${arcsSvg(roundArcs())}
  ${dots([[200, 103], [360, 103], [520, 103], [697, 280], [697, 440], [697, 600], [280, 697], [440, 697], [600, 697], [103, 200], [103, 360], [103, 520]], 5, '#F2C230')}
  ${dots([[695, 105], [105, 695]], 6, '#F2C230')}
  <use href="#pz-rosette" x="94" y="94"/><use href="#pz-rosette" x="706" y="706"/>
  <rect x="113" y="113" width="574" height="574" rx="7" fill="#0F2547"/>${floor}`;

const B_FRAME = `<defs><pattern id="pz-floor" width="160" height="160" patternUnits="userSpaceOnUse" x="120" y="120">
    <rect width="160" height="160" fill="#1A1D23"/>
    <rect x="2" y="2" width="76" height="76" rx="5" fill="#2B2F37"/><rect x="82" y="2" width="76" height="76" rx="5" fill="#30343D"/>
    <rect x="2" y="82" width="76" height="76" rx="5" fill="#2E323A"/><rect x="82" y="82" width="76" height="76" rx="5" fill="#292D35"/>
    ${dots([[22, 58], [118, 24], [52, 124], [136, 118]], 1.6, '#3A3F49')}</pattern>
    <radialGradient id="pz-glow"><stop offset="0" stop-color="#FFB03A" stop-opacity=".55"/><stop offset="1" stop-color="#FFB03A" stop-opacity="0"/></radialGradient></defs>
  <circle cx="92" cy="92" r="46" fill="url(#pz-glow)"/><circle cx="708" cy="708" r="46" fill="url(#pz-glow)"/>
  <circle cx="92" cy="92" r="9" fill="#FFB03A" stroke="#14161B" stroke-width="3"/><circle cx="708" cy="708" r="9" fill="#FFB03A" stroke="#14161B" stroke-width="3"/>
  ${arcsSvg(roundArcs())}
  <rect x="114" y="114" width="572" height="572" rx="8" fill="#0C0D10"/>${floor}
  <rect x="117" y="117" width="566" height="566" rx="6" fill="none" stroke="#4A505C" stroke-width="2"/>`;

const C_FRAME = `<defs><pattern id="pz-floor" width="80" height="80" patternUnits="userSpaceOnUse" x="120" y="120">
    <rect width="80" height="80" fill="#E9DDC4"/><path d="M0,0 H80 V80 H0 Z" fill="none" stroke="#D3C4A4" stroke-width="2"/><circle cx="40" cy="40" r="3" fill="#D9CBAD"/></pattern></defs>
  ${arcsSvg(squareArcs())}${floor}
  <rect x="118" y="118" width="564" height="564" rx="4" fill="none" stroke="#231C14" stroke-width="5"/>`;

/** @typedef {{ name: string, view: [number, number], frame: string, rugs: Record<string, string>, peppo: string }} Skin
 * view = [inizio, lato] del riquadro di disegno (il tabellone va sempre da 120 a 680). */
/** @type {Record<'a' | 'b' | 'c', Skin>} */
export const SKINS = {
  a: { name: 'Chiostro', view: [56, 688], frame: A_FRAME, rugs: A_RUGS, peppo: A_PEPPO },
  b: { name: 'Vicolo di sera', view: [44, 712], frame: B_FRAME, rugs: B_RUGS, peppo: B_PEPPO },
  c: { name: 'Bottega', view: [92, 616], frame: C_FRAME, rugs: C_RUGS, peppo: C_PEPPO },
};
