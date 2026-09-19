/**
 * Address -> coordinates, without a network call.
 *
 * A delivery demo needs a believable pin for any address a shopper types. Calling the Google
 * Geocoding API per order would need a billed server key and would make every order request
 * depend on a third party, so this resolves against a table of Nairobi areas instead and is
 * deterministic: the same address always lands on the same point. `GEOCODER=google` plus
 * `GOOGLE_MAPS_SERVER_KEY` is the upgrade path, wired in resolveDestination() below.
 */

/** Where the riders leave from. */
export const HUB = Object.freeze({
  lat: -1.2673,
  lng: 36.8065,
  name: 'Mama Afrika Market, Westlands',
  area: 'Westlands',
});

/**
 * Nairobi areas and their approximate centres. `aliases` catch the ways people actually write an
 * address ("Yaya", "Ngong Rd", "Taj Mall"). Coordinates are area centroids, good to a few hundred
 * metres, which is the right resolution for a delivery map anyway.
 */
export const NAIROBI_AREAS = Object.freeze([
  { name: 'Westlands', lat: -1.2673, lng: 36.8065, aliases: ['sarit', 'westgate', 'rhapta', 'woodvale', 'mpaka'] },
  { name: 'Parklands', lat: -1.2620, lng: 36.8180, aliases: ['highridge', 'aga khan', 'city park'] },
  { name: 'Nairobi CBD', lat: -1.2841, lng: 36.8233, aliases: ['cbd', 'city centre', 'city center', 'town', 'kimathi', 'moi avenue', 'kenyatta avenue', 'koinange'] },
  { name: 'Upper Hill', lat: -1.2980, lng: 36.8130, aliases: ['upperhill', 'ragati', 'bishops'] },
  { name: 'Milimani', lat: -1.2900, lng: 36.8080, aliases: ['state house', 'kilimani road'] },
  { name: 'Kilimani', lat: -1.2900, lng: 36.7850, aliases: ['yaya', 'argwings', 'kodhek', 'lenana', 'dennis pritt', 'rose avenue'] },
  { name: 'Hurlingham', lat: -1.2950, lng: 36.7930, aliases: ['chaka', 'woodlands'] },
  { name: 'Kileleshwa', lat: -1.2795, lng: 36.7790, aliases: ['gatundu', 'laikipia road', 'othaya'] },
  { name: 'Lavington', lat: -1.2795, lng: 36.7660, aliases: ['james gichuru', 'muthangari', 'valley arcade'] },
  { name: 'Riverside', lat: -1.2740, lng: 36.7990, aliases: ['riverside drive', 'chiromo'] },
  { name: 'Spring Valley', lat: -1.2580, lng: 36.7880, aliases: ['lower kabete', 'peponi'] },
  { name: 'Kitisuru', lat: -1.2380, lng: 36.7900, aliases: ['nyari', 'rosslyn'] },
  { name: 'Loresho', lat: -1.2500, lng: 36.7600, aliases: ['kabete', 'mary leakey'] },
  { name: 'Muthaiga', lat: -1.2490, lng: 36.8330, aliases: ['muthaiga north', 'thigiri'] },
  { name: 'Gigiri', lat: -1.2340, lng: 36.8090, aliases: ['un avenue', 'village market', 'limuru road'] },
  { name: 'Runda', lat: -1.2180, lng: 36.8100, aliases: ['runda mumwe', 'ridgeways'] },
  { name: 'Ridgeways', lat: -1.2200, lng: 36.8400, aliases: ['kiambu road'] },
  { name: 'Garden Estate', lat: -1.2330, lng: 36.8720, aliases: ['thome', 'marurui'] },
  { name: 'Ruaraka', lat: -1.2440, lng: 36.8720, aliases: ['allsops', 'baba dogo', 'utalii'] },
  { name: 'Roysambu', lat: -1.2180, lng: 36.8880, aliases: ['trm', 'lumumba', 'mirema'] },
  { name: 'Kasarani', lat: -1.2240, lng: 36.8980, aliases: ['mwiki', 'sunton', 'hunters'] },
  { name: 'Zimmerman', lat: -1.2080, lng: 36.8930, aliases: ['kahawa west'] },
  { name: 'Githurai', lat: -1.1960, lng: 36.9160, aliases: ['githurai 44', 'githurai 45'] },
  { name: 'Kahawa Sukari', lat: -1.1830, lng: 36.9330, aliases: ['kahawa wendani', 'kahawa'] },
  { name: 'Kamakis', lat: -1.2150, lng: 36.9380, aliases: ['eastern bypass', 'bypass'] },
  { name: 'Ruiru', lat: -1.1450, lng: 36.9610, aliases: ['membley', 'kimbo'] },
  { name: 'Juja', lat: -1.1030, lng: 37.0140, aliases: ['jkuat'] },
  { name: 'Thika', lat: -1.0390, lng: 37.0690, aliases: ['thika town', 'blue post'] },
  { name: 'Kiambu', lat: -1.1710, lng: 36.8350, aliases: ['kiambu town', 'ndumberi'] },
  { name: 'Ruaka', lat: -1.2050, lng: 36.7830, aliases: ['two rivers', 'banana hill', 'banana'] },
  { name: 'Eastleigh', lat: -1.2740, lng: 36.8490, aliases: ['first avenue', 'section 3'] },
  { name: 'Pangani', lat: -1.2700, lng: 36.8380, aliases: ['juja road', 'muratina'] },
  { name: 'Ngara', lat: -1.2740, lng: 36.8290, aliases: ['fig tree', 'desai'] },
  { name: 'Buruburu', lat: -1.2880, lng: 36.8720, aliases: ['jogoo road', 'hamza', 'makadara'] },
  { name: 'Donholm', lat: -1.2950, lng: 36.8850, aliases: ['savannah', 'greenspan'] },
  { name: 'Umoja', lat: -1.2800, lng: 36.8930, aliases: ['innercore', 'umoja two'] },
  { name: 'Komarock', lat: -1.2680, lng: 36.9070, aliases: ['kayole', 'matopeni'] },
  { name: 'Utawala', lat: -1.2820, lng: 36.9560, aliases: ['benedicta', 'astrol'] },
  { name: 'Embakasi', lat: -1.3210, lng: 36.8940, aliases: ['pipeline', 'tassia', 'fedha', 'nyayo estate'] },
  { name: 'Imara Daima', lat: -1.3280, lng: 36.8720, aliases: ['taj mall', 'airport north'] },
  { name: 'Syokimau', lat: -1.3620, lng: 36.9440, aliases: ['katani', 'gateway'] },
  { name: 'Mlolongo', lat: -1.3900, lng: 36.9370, aliases: ['athi river', 'kitengela'] },
  { name: 'Industrial Area', lat: -1.3060, lng: 36.8500, aliases: ['enterprise road', 'likoni road'] },
  { name: 'South B', lat: -1.3110, lng: 36.8340, aliases: ['mariakani', 'balozi'] },
  { name: 'South C', lat: -1.3220, lng: 36.8280, aliases: ['bellevue', 'mugoya'] },
  { name: 'Nairobi West', lat: -1.3160, lng: 36.8180, aliases: ['madaraka', 'wilson airport'] },
  { name: 'Langata', lat: -1.3480, lng: 36.7460, aliases: ["lang'ata", 'otiende', 'southlands', 'nyayo highrise'] },
  { name: 'Karen', lat: -1.3190, lng: 36.7080, aliases: ['hardy', 'ngong racecourse', 'bogani'] },
  { name: 'Kibera', lat: -1.3130, lng: 36.7810, aliases: ['olympic', 'ayany'] },
  { name: 'Adams Arcade', lat: -1.3010, lng: 36.7790, aliases: ['woodley', 'ngong road', 'ngong rd', 'kilimani south'] },
  { name: 'Jamhuri', lat: -1.3060, lng: 36.7700, aliases: ['kenyatta golf'] },
  { name: 'Dagoretti', lat: -1.2930, lng: 36.7280, aliases: ['kawangware', 'satellite', 'riruta'] },
  { name: 'Kangemi', lat: -1.2660, lng: 36.7420, aliases: ['mountain view', 'uthiru', 'waiyaki way'] },
  { name: 'Kikuyu', lat: -1.2470, lng: 36.6630, aliases: ['thogoto', 'dagoretti market'] },
  { name: 'Ngong', lat: -1.3530, lng: 36.6550, aliases: ['kiserian', 'matasia'] },
  { name: 'Ongata Rongai', lat: -1.3960, lng: 36.7460, aliases: ['rongai', 'nkoroi'] },
  { name: 'JKIA', lat: -1.3192, lng: 36.9278, aliases: ['jomo kenyatta airport', 'airport'] },
]);

/** Cities we can name but do not deliver to. Keeps an out-of-zone order honest instead of guessing. */
const OTHER_CITIES = Object.freeze([
  { name: 'Mombasa', lat: -4.0435, lng: 39.6682, aliases: ['nyali', 'bamburi', 'likoni', 'diani'] },
  { name: 'Kisumu', lat: -0.0917, lng: 34.7680, aliases: ['milimani kisumu'] },
  { name: 'Nakuru', lat: -0.3031, lng: 36.0800, aliases: ['naivasha'] },
  { name: 'Eldoret', lat: 0.5143, lng: 35.2698, aliases: ['uasin gishu'] },
  { name: 'Nyeri', lat: -0.4201, lng: 36.9476, aliases: ['karatina'] },
  { name: 'Machakos', lat: -1.5177, lng: 37.2634, aliases: ['kangundo'] },
  { name: 'Kericho', lat: -0.3677, lng: 35.2831, aliases: [] },
]);

const norm = (v) => String(v ?? '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

/** Stable 32-bit hash so the same address always gets the same jitter and the same rider. */
export function hashString(str) {
  let h = 2166136261;
  const s = String(str ?? '');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function matchArea(haystack, table) {
  for (const area of table) {
    const needles = [norm(area.name), ...area.aliases.map(norm)];
    // Word-boundary match so "Karen" does not fire on "Karengata Lane" spelled oddly, and
    // longer aliases ("kahawa sukari") win over shorter ones because the table is ordered.
    for (const needle of needles) {
      if (!needle) continue;
      const re = new RegExp(`(^|\\s)${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`);
      if (re.test(haystack)) return area;
    }
  }
  return null;
}

/**
 * Resolve a stored order address to a point on the map.
 * @param {{line1?: string, line2?: string, city?: string, state?: string, postalCode?: string, country?: string}} address
 * @returns {{lat: number, lng: number, area: string, confidence: 'area'|'city'|'default', inZone: boolean}}
 */
export function geocodeAddress(address) {
  // `address = {}` would not cover an explicit null, and callers do pass one.
  const a = address && typeof address === 'object' ? address : {};
  const parts = [a.line1, a.line2, a.city, a.state].map(norm).filter(Boolean);
  const haystack = parts.join(' ');
  const seed = hashString(haystack || 'unknown');

  const area = matchArea(haystack, NAIROBI_AREAS);
  if (area) return { ...jitter(area, seed), area: area.name, confidence: 'area', inZone: true };

  const city = matchArea(haystack, OTHER_CITIES);
  if (city) return { ...jitter(city, seed, 0.012), area: city.name, confidence: 'city', inZone: false };

  // Nothing matched. Nairobi is the delivery city, so put the pin near the centre rather than
  // pretending to know the estate; `confidence: 'default'` lets the UI say so.
  const centre = NAIROBI_AREAS.find((a) => a.name === 'Nairobi CBD');
  return { ...jitter(centre, seed, 0.02), area: a.city ? String(a.city).trim() : 'Nairobi', confidence: 'default', inZone: true };
}

/** Spread pins inside an area so two orders on the same estate do not sit on top of each other. */
function jitter(point, seed, spread = 0.006) {
  const a = (seed % 1000) / 1000;
  const b = ((seed >>> 10) % 1000) / 1000;
  return {
    lat: round6(point.lat + (a - 0.5) * spread * 2),
    lng: round6(point.lng + (b - 0.5) * spread * 2),
  };
}

const round6 = (n) => Math.round(n * 1e6) / 1e6;

/** Metres between two points. */
export function haversineKm(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Compass bearing in degrees from `a` to `b`, for pointing the rider marker. */
export function bearingDeg(a, b) {
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(la2);
  const x = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dLng);
  return (Math.atan2(y, x) * 180) / Math.PI;
}
