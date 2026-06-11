// Vehicle art is generated from each car's name so garage cards and mini-games
// don't collapse distinct vehicles into one generic archetype image.

export type VehicleArchetype =
  | "offroader"
  | "pickup"
  | "sportscar"
  | "saloon"
  | "van"
  | "motorcycle"
  | "estate";

export function vehicleArchetype(
  name: string,
  power = 5,
  offRoad = 5,
): VehicleArchetype {
  const n = (name ?? "").toLowerCase();

  if (/wave|crf|moto|bike|scooter|cc\b/.test(n)) return "motorcycle";
  if (/pickup|hilux|ranger|truck|\bute\b/.test(n)) return "pickup";
  if (/estate|wagon/.test(n)) return "estate";
  if (/delica|\bape\b|multipla|\bvan\b|combi|bus|minibus/.test(n)) return "van";
  if (
    /buggy|defender|land rover|range rover|land cruiser|cruiser|\bjeep\b|cherokee|uaz|vitara|jimny|pajero|patrol|niva|trooper|series|quattro|4x4|wrangler|discovery/.test(
      n,
    )
  )
    return "offroader";
  if (
    /laferrari|ferrari|mclaren|porsche|aston|lamborghini|lotus|maserati|jaguar|corvette|viper|rx-?7|impreza|wrx|skyline|silvia|ae86|gti|\bevo\b|turbo|coupe|\bgt\b|\bgti\b|s13|celica|supra|mx-?5|sti|205 gti/.test(
      n,
    )
  )
    return "sportscar";

  // Stat-based fallback
  if (offRoad >= 7) return "offroader";
  if (power >= 7 && offRoad <= 4) return "sportscar";
  return "saloon";
}

export function vehicleSprite(archetype: VehicleArchetype): string {
  return `/images/vehicles/${archetype}.png`;
}

const BRAND_COLORS: Array<[RegExp, string, string]> = [
  [/ferrari|laferrari|demon|hellcat|dodge/i, "#dc2626", "#fee2e2"],
  [/mclaren|lamborghini|huracan|aventador|urus/i, "#f97316", "#ffedd5"],
  [/porsche|mercedes|amg|benz|bmw|audi|nio|rimac/i, "#cbd5e1", "#38bdf8"],
  [/jaguar|aston|bentley|rolls/i, "#14532d", "#facc15"],
  [/land rover|range rover|jeep|land cruiser|hilux|ranger|wrangler|discovery|raptor/i, "#166534", "#bbf7d0"],
  [/subaru|impreza|mitsubishi|evo|lancer|focus rs|rs4|quattro/i, "#2563eb", "#facc15"],
  [/lancia|alfa|fiat|maserati|citroen|renault|peugeot/i, "#b91c1c", "#f8fafc"],
  [/ford|mustang|capri|gt40|gt\b|cortina|sierra|mondeo/i, "#1d4ed8", "#f8fafc"],
  [/vw|volkswagen|golf|beetle|polo|amarok/i, "#f8fafc", "#1e40af"],
  [/cadillac|lincoln|buick|chevrolet|corvette|camaro|chrysler|pontiac/i, "#581c87", "#fef3c7"],
  [/buggy|custom/i, "#facc15", "#111827"],
  [/motorcycle|bike|scooter|tvs|crf/i, "#ef4444", "#f8fafc"],
];

const FALLBACK_COLORS = [
  ["#ef4444", "#fee2e2"],
  ["#f59e0b", "#fffbeb"],
  ["#22c55e", "#dcfce7"],
  ["#06b6d4", "#cffafe"],
  ["#6366f1", "#e0e7ff"],
  ["#a855f7", "#f3e8ff"],
  ["#64748b", "#f8fafc"],
] as const;

const CURATED_SIDE_SPRITES: Array<[RegExp, string]> = [
  [/\bmclaren p1\b/i, "/images/vehicles/curated/mclaren-p1-side.png"],
  [/\bporsche 918\b/i, "/images/vehicles/curated/porsche-918-spyder-side.png"],
  [/\blaferrari\b/i, "/images/vehicles/curated/laferrari-side.png"],
  [/\bjaguar xj-?s\b/i, "/images/vehicles/curated/jaguar-xjs-side.png"],
];

export function curatedVehicleSideSprite(name: string): string | undefined {
  return CURATED_SIDE_SPRITES.find(([pattern]) => pattern.test(name))?.[1];
}

function hashName(name: string): number {
  let hash = 2166136261;
  for (let i = 0; i < name.length; i++) {
    hash ^= name.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function svgUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function vehicleColors(name: string): { body: string; accent: string; hash: number } {
  const hash = hashName(name);
  const brand = BRAND_COLORS.find(([pattern]) => pattern.test(name));
  if (brand) return { body: brand[1], accent: brand[2], hash };
  const [body, accent] = FALLBACK_COLORS[hash % FALLBACK_COLORS.length];
  return { body, accent, hash };
}

function variantForName(name: string, archetype: VehicleArchetype): string {
  const n = name.toLowerCase();
  if (/buggy/.test(n)) return "buggy";
  if (/p1|918|laferrari|chiron|veyron|senna|rimac|vulcan|xj220|eb 110|gt40|ford gt|huracan|aventador|countach|testarossa|f-type|db9|dbs|superleggera|vantage|nsx|4c|e10s|a110|project 8/.test(n)) return "hypercar";
  if (/mustang|camaro|challenger|charger|demon|hellcat|exorcist|corvette|viper|stinger/.test(n)) return "muscle";
  if (/xj-s|xjs|xk8|coupe|montecarlo|stratos|x1\/9|murena|le-seyde/.test(n)) return "long-coupe";
  if (/xjr|xj6|s600|750li|s-class|sts|sd1|mondeo|cortina|sierra|230e|200t|continental mark|riviera/.test(n)) return "saloon";
  if (/convertible|spider|spyder|volante|roadster|mx-?5|caterham/.test(n)) return "open-top";
  if (/rally|impreza|evo|quattro|focus rs|rs4|037|delta/.test(n)) return "rally";
  if (/camper|rv|pacer|tropi-cal|voyager|avantime|berlingo/.test(n)) return "tall";
  if (/limousine|continental|coupe de ville|420g|s600|bentley|rolls|dawn/.test(n)) return "luxury";
  if (/pickup|ranger|hilux|hardbody|amarok|x-class|k2500|raptor/.test(n)) return "pickup";
  if (/wrangler|jeep|land rover|range rover|land cruiser|discovery|defender|velar|jimny/.test(n)) return "offroad";
  if (/motorcycle|bike|scooter|tvs|crf/.test(n)) return "motorcycle";
  return archetype;
}

function stripeMarkup(hash: number, accent: string, view: "side" | "top"): string {
  const mode = hash % 4;
  if (mode === 0) return "";
  if (view === "top") {
    if (mode === 1) return `<path d="M48 18v108" stroke="${accent}" stroke-width="4" opacity="0.85"/>`;
    if (mode === 2) return `<path d="M39 22v98M57 22v98" stroke="${accent}" stroke-width="3" opacity="0.75"/>`;
    return `<path d="M26 94c13 8 31 8 44 0" stroke="${accent}" stroke-width="4" fill="none" opacity="0.8"/>`;
  }
  if (mode === 1) return `<path d="M35 62h132" stroke="${accent}" stroke-width="5" opacity="0.9"/>`;
  if (mode === 2) return `<path d="M50 34h92" stroke="${accent}" stroke-width="4" opacity="0.8"/>`;
  return `<path d="M118 23l24 63" stroke="${accent}" stroke-width="5" opacity="0.75"/>`;
}

function sideBodyPath(variant: string): string {
  switch (variant) {
    case "pickup":
      return "M17 61h25l12-23h58l11 23h77v25H17Z";
    case "offroad":
      return "M16 55h16l14-24h88l18 24h42v31H16Z";
    case "tall":
      return "M18 35h36l10-14h88l30 32h19v34H18Z";
    case "luxury":
      return "M10 66h22l18-25h84l28 25h48v20H10Z";
    case "open-top":
      return "M14 67h28l17-19h51l15 19h74v19H14Z";
    case "rally":
      return "M14 64h30l14-26h66l20 26h55v23H14Z";
    case "buggy":
      return "M19 69h28l10-22h48l18 22h55v17H19Z";
    case "long-coupe":
      return "M10 70h22l25-33h73l23 33h56v16H10Z";
    case "hypercar":
      return "M9 76c30-4 39-22 60-30h57c26 3 39 21 83 27l-5 14H13Z";
    case "muscle":
      return "M11 68h31l17-22h82l19 22h47v19H11Z";
    default:
      return "M13 67h29l17-26h69l23 26h53v20H13Z";
  }
}

function sideWindowMarkup(variant: string): string {
  switch (variant) {
    case "pickup":
      return `<path d="M61 42h48l9 19H50Z" fill="#dbeafe" opacity="0.86"/><path d="M113 61h70v20h-70Z" fill="#111827" opacity="0.16"/>`;
    case "offroad":
      return `<path d="M52 36h77l15 22H39Z" fill="#dbeafe" opacity="0.86"/><path d="M150 58h28v19h-28Z" fill="#111827" opacity="0.22"/>`;
    case "tall":
      return `<path d="M63 27h83l26 27H50Z" fill="#dbeafe" opacity="0.84"/><path d="M31 42h22v27H31Z" fill="#dbeafe" opacity="0.55"/>`;
    case "open-top":
      return `<path d="M59 51h47l13 15H46Z" fill="#dbeafe" opacity="0.55"/><path d="M72 43h38" stroke="#111827" stroke-width="5" stroke-linecap="round"/>`;
    case "long-coupe":
      return `<path d="M62 45h63l16 20H48Z" fill="#dbeafe" opacity="0.88"/><path d="M99 45v20" stroke="#1f2937" stroke-width="3"/>`;
    case "hypercar":
      return `<path d="M76 48h41c11 3 20 9 28 17H54c6-8 13-14 22-17Z" fill="#dbeafe" opacity="0.86"/><path d="M119 49l22 16" stroke="#1f2937" stroke-width="3" opacity="0.65"/>`;
    case "muscle":
      return `<path d="M64 49h69l17 18H50Z" fill="#dbeafe" opacity="0.82"/><path d="M101 49v18" stroke="#1f2937" stroke-width="3"/>`;
    case "buggy":
      return `<path d="M61 50h44l14 18H51Z" fill="#dbeafe" opacity="0.55"/><path d="M48 69l26-34h28l37 34" stroke="#111827" stroke-width="5" fill="none"/>`;
    default:
      return `<path d="M63 43h62l19 21H48Z" fill="#dbeafe" opacity="0.86"/><path d="M96 43v21" stroke="#1f2937" stroke-width="3"/>`;
  }
}

function accessoryMarkup(variant: string, hash: number, accent: string): string {
  const roofRack = variant === "offroad" || variant === "tall" || (variant === "pickup" && hash % 5 === 0);
  const spoiler = variant === "rally" || variant === "long-coupe" || (variant === "muscle" && hash % 3 === 0);
  return [
    roofRack ? `<path d="M63 27h72M67 22v10M131 22v10" stroke="#78350f" stroke-width="4" stroke-linecap="round"/>` : "",
    spoiler ? `<path d="M21 58h26" stroke="${accent}" stroke-width="7" stroke-linecap="round"/>` : "",
    variant === "hypercar" ? `<path d="M35 76c18 7 39 6 64-2" stroke="#020617" stroke-width="4" opacity="0.38" fill="none"/><path d="M151 72h36" stroke="#020617" stroke-width="4" opacity="0.36"/><path d="M23 63h25" stroke="${accent}" stroke-width="4" stroke-linecap="round" opacity="0.78"/>` : "",
    variant === "muscle" ? `<path d="M56 50h82" stroke="#020617" stroke-width="3" opacity="0.28"/><path d="M181 60h18" stroke="${accent}" stroke-width="5" stroke-linecap="round"/>` : "",
    variant === "offroad" ? `<circle cx="177" cy="68" r="10" fill="#111827"/><circle cx="177" cy="68" r="5" fill="#64748b"/>` : "",
    variant === "pickup" ? `<path d="M127 66h53" stroke="#111827" stroke-width="3" opacity="0.55"/>` : "",
  ].join("");
}

function wheelMarkup(hash: number): string {
  const rim = hash % 2 === 0 ? "#e5e7eb" : "#94a3b8";
  return [50, 164].map((cx) => `
    <g>
      <circle cx="${cx}" cy="86" r="18" fill="#0f172a"/>
      <circle cx="${cx}" cy="86" r="10" fill="${rim}"/>
      <circle cx="${cx}" cy="86" r="4" fill="#334155"/>
      <path d="M${cx - 9} 86h18M${cx} 77v18" stroke="#0f172a" stroke-width="2" opacity="0.65"/>
    </g>
  `).join("");
}

function motorcycleSideSvg(name: string): string {
  const { body, accent, hash } = vehicleColors(name);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 100" role="img" aria-label="${escapeXml(name)}">
    <ellipse cx="110" cy="91" rx="91" ry="5" fill="#020617" opacity="0.18"/>
    <circle cx="58" cy="82" r="20" fill="#111827"/><circle cx="58" cy="82" r="11" fill="#94a3b8"/>
    <circle cx="165" cy="82" r="20" fill="#111827"/><circle cx="165" cy="82" r="11" fill="#94a3b8"/>
    <path d="M58 80l38-30h38l31 30M94 50l-12 31M133 50l22 32" stroke="#111827" stroke-width="7" stroke-linecap="round" fill="none"/>
    <path d="M91 48h52l-14 18H83Z" fill="${body}" stroke="#111827" stroke-width="4" stroke-linejoin="round"/>
    <path d="M117 42h35" stroke="${accent}" stroke-width="6" stroke-linecap="round"/>
    <path d="M146 43l23-14" stroke="#111827" stroke-width="5" stroke-linecap="round"/>
      ${stripeMarkup(hash, accent, "side")}
  </svg>`;
}

export function vehicleSideSvg(name: string, power = 5, offRoad = 5): string {
  const archetype = vehicleArchetype(name, power, offRoad);
  const variant = variantForName(name, archetype);
  if (variant === "motorcycle") return motorcycleSideSvg(name);
  const { body, accent, hash } = vehicleColors(name);
  const id = `v${hash}`;
  const stripes = variant === "hypercar" ? "" : stripeMarkup(hash, accent, "side");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 100" role="img" aria-label="${escapeXml(name)}">
    <defs>
      <linearGradient id="${id}body" x1="20" x2="195" y1="28" y2="91" gradientUnits="userSpaceOnUse">
        <stop stop-color="${body}"/>
        <stop offset="1" stop-color="#020617" stop-opacity="0.38"/>
      </linearGradient>
      <filter id="${id}shadow" x="-10%" y="-25%" width="120%" height="150%">
        <feDropShadow dx="0" dy="3" stdDeviation="2" flood-color="#020617" flood-opacity="0.32"/>
      </filter>
    </defs>
    <ellipse cx="110" cy="93" rx="96" ry="5" fill="#020617" opacity="0.18"/>
    <g filter="url(#${id}shadow)">
      <path d="${sideBodyPath(variant)}" fill="url(#${id}body)" stroke="#111827" stroke-width="5" stroke-linejoin="round"/>
      ${sideWindowMarkup(variant)}
      ${stripes}
      ${accessoryMarkup(variant, hash, accent)}
      <path d="M192 67h10" stroke="#fef3c7" stroke-width="5" stroke-linecap="round"/>
      <path d="M18 72h10" stroke="#fecaca" stroke-width="4" stroke-linecap="round"/>
      ${wheelMarkup(hash)}
    </g>
  </svg>`;
}

function topBodyPath(variant: string): string {
  switch (variant) {
    case "pickup":
      return "M27 20h42v40l7 18v43H20V78l7-18Z";
    case "offroad":
      return "M22 20h52v101H22Z";
    case "tall":
      return "M18 17h60v110H18Z";
    case "open-top":
      return "M48 18c19 12 25 80 17 104-7 8-27 8-34 0-8-24-2-92 17-104Z";
    case "long-coupe":
      return "M48 10c16 0 25 27 27 64 1 30-9 56-27 61-18-5-28-31-27-61 2-37 11-64 27-64Z";
    case "hypercar":
      return "M48 12c20 6 30 42 26 86-3 18-12 29-26 34-14-5-23-16-26-34-4-44 6-80 26-86Z";
    case "muscle":
      return "M24 21h48l6 47-8 58H26l-8-58Z";
    case "buggy":
      return "M28 29h40l13 54-12 39H27L15 83Z";
    default:
      return "M48 14c17 0 27 31 27 62s-10 53-27 57c-17-4-27-26-27-57s10-62 27-62Z";
  }
}

function topWindowMarkup(variant: string): string {
  switch (variant) {
    case "pickup":
      return `<path d="M29 31h38v28H29Z" fill="#dbeafe" opacity="0.86"/><path d="M27 81h42v32H27Z" fill="#111827" opacity="0.16"/>`;
    case "offroad":
      return `<path d="M28 32h40v33H28Z" fill="#dbeafe" opacity="0.82"/><circle cx="48" cy="104" r="14" fill="#111827" opacity="0.32"/>`;
    case "tall":
      return `<path d="M26 29h44v74H26Z" fill="#dbeafe" opacity="0.55"/><path d="M31 35h34v22H31Z" fill="#e0f2fe" opacity="0.84"/>`;
    case "open-top":
      return `<path d="M33 57h30v47H33Z" fill="#111827" opacity="0.35"/><path d="M35 35h26" stroke="#dbeafe" stroke-width="8" stroke-linecap="round" opacity="0.75"/>`;
    case "long-coupe":
      return `<path d="M33 45h30l7 33-9 29H35l-9-29Z" fill="#dbeafe" opacity="0.83" stroke="#1e293b" stroke-width="3"/><path d="M48 45v62" stroke="#1e293b" stroke-width="2" opacity="0.55"/>`;
    case "hypercar":
      return `<path d="M32 42h32l8 32-9 25H33l-9-25Z" fill="#dbeafe" opacity="0.84" stroke="#1e293b" stroke-width="3"/><path d="M28 103h40" stroke="#111827" stroke-width="4" opacity="0.25"/>`;
    case "muscle":
      return `<path d="M31 38h34l6 33H25Z" fill="#dbeafe" opacity="0.84" stroke="#1e293b" stroke-width="3"/><path d="M29 83h38" stroke="#111827" stroke-width="4" opacity="0.25"/>`;
    case "buggy":
      return `<path d="M32 52h32l9 29-9 28H32l-9-28Z" fill="#dbeafe" opacity="0.5"/><path d="M25 81l16-42h18l16 42" stroke="#111827" stroke-width="5" fill="none"/>`;
    default:
      return `<path d="M34 43h28l7 32-8 32H35l-8-32Z" fill="#dbeafe" opacity="0.84" stroke="#1e293b" stroke-width="3"/>`;
  }
}

export function vehicleTopDownSvg(name: string, power = 5, offRoad = 5): string {
  const archetype = vehicleArchetype(name, power, offRoad);
  const variant = variantForName(name, archetype);
  const { body, accent, hash } = vehicleColors(name);
  const id = `t${hash}`;
  if (variant === "motorcycle") {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 144" role="img" aria-label="${escapeXml(name)}">
      <ellipse cx="48" cy="130" rx="16" ry="6" fill="#020617" opacity="0.2"/>
      <path d="M48 18v108" stroke="#111827" stroke-width="12" stroke-linecap="round"/>
      <path d="M48 39c13 16 13 49 0 66-13-17-13-50 0-66Z" fill="${body}" stroke="#111827" stroke-width="4"/>
      <path d="M31 62h34M30 92h36" stroke="${accent}" stroke-width="5" stroke-linecap="round"/>
      <circle cx="48" cy="21" r="9" fill="#0f172a"/><circle cx="48" cy="126" r="9" fill="#0f172a"/>
    </svg>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 144" role="img" aria-label="${escapeXml(name)}">
    <defs>
      <linearGradient id="${id}body" x1="24" x2="72" y1="16" y2="128" gradientUnits="userSpaceOnUse">
        <stop stop-color="${body}"/>
        <stop offset="1" stop-color="#020617" stop-opacity="0.34"/>
      </linearGradient>
      <filter id="${id}shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="3" stdDeviation="2.4" flood-color="#020617" flood-opacity="0.32"/>
      </filter>
    </defs>
    <ellipse cx="48" cy="132" rx="34" ry="7" fill="#020617" opacity="0.2"/>
    <g filter="url(#${id}shadow)">
      <rect x="13" y="36" width="11" height="30" rx="5" fill="#0f172a"/>
      <rect x="72" y="36" width="11" height="30" rx="5" fill="#0f172a"/>
      <rect x="12" y="89" width="12" height="32" rx="5" fill="#0f172a"/>
      <rect x="72" y="89" width="12" height="32" rx="5" fill="#0f172a"/>
      <path d="${topBodyPath(variant)}" fill="url(#${id}body)" stroke="#111827" stroke-width="4" stroke-linejoin="round"/>
      ${topWindowMarkup(variant)}
      ${stripeMarkup(hash, accent, "top")}
      ${variant === "offroad" ? `<circle cx="48" cy="111" r="10" fill="#111827"/><circle cx="48" cy="111" r="5" fill="#64748b"/>` : ""}
      ${variant === "pickup" ? `<path d="M28 84h40" stroke="#111827" stroke-width="3" opacity="0.45"/>` : ""}
      <path d="M31 126h12M53 126h12" stroke="#fef2f2" stroke-width="4" stroke-linecap="round"/>
      <path d="M36 18h24" stroke="${accent}" stroke-width="4" stroke-linecap="round" opacity="0.8"/>
    </g>
  </svg>`;
}

export function vehicleSideSprite(name: string, power = 5, offRoad = 5): string {
  return svgUrl(vehicleSideSvg(name, power, offRoad));
}

export function vehicleTopDownSprite(name: string, power = 5, offRoad = 5): string {
  return svgUrl(vehicleTopDownSvg(name, power, offRoad));
}
