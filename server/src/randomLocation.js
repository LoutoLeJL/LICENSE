'use strict';

/**
 * Génère des lieux VRAIMENT aléatoires sur Terre pour chaque manche, plutôt
 * qu'une liste fixe de villes connues (qui finissait par se répéter).
 *
 * Principe :
 *   1. On tire un pays au hasard parmi une liste de pays ayant une bonne
 *      couverture Google Street View (voir COUNTRY_NAMES_FR ci-dessous).
 *   2. On tire un point au hasard dans le rectangle englobant ce pays, et on
 *      vérifie qu'il tombe bien À L'INTÉRIEUR de sa frontière réelle (point
 *      dans polygone). On recommence jusqu'à en trouver un (ou on change de
 *      pays si ça échoue trop de fois, ex: pays très morcelé en îles).
 *   3. Le nom du pays (en français) et son code sont renvoyés avec le point :
 *      utile pour l'écran de résultats et pour le mode "Pays".
 *
 * Choix assumés (voir README) :
 *   - Liste volontairement limitée aux pays à couverture Street View réelle,
 *     pour éviter de tomber trop souvent sur une manche sans aucune image
 *     (le mode "Monde entier" n'est donc pas *littéralement* n'importe quel
 *     point du globe, mais un tirage honnête parmi les pays où le jeu a une
 *     chance raisonnable de fonctionner).
 *   - Zones de conflit actif volontairement exclues (Ukraine, Russie, Israël/
 *     Palestine, Syrie, Yémen, Afghanistan...), par précaution.
 */

const fs = require('fs');
const path = require('path');
const topojson = require('topojson-client');

const topology = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', '..', 'shared', 'countries-50m.json'), 'utf8')
);
const FEATURES = topojson.feature(topology, topology.objects.countries).features;

/**
 * Codes ISO 3166-1 numériques (identiques à ceux du fichier de frontières)
 * -> nom français, pour les pays avec une couverture Street View
 * significative. Sert à la fois de liste blanche pour le tirage et de nom
 * affiché aux résultats (le jeu de données géographiques ne fournit que des
 * noms anglais).
 */
const COUNTRY_NAMES_FR = {
  // Amériques
  '840': 'États-Unis',
  '124': 'Canada',
  '484': 'Mexique',
  '076': 'Brésil',
  '032': 'Argentine',
  '152': 'Chili',
  '858': 'Uruguay',
  '604': 'Pérou',
  '170': 'Colombie',
  '218': 'Équateur',
  '068': 'Bolivie',
  '600': 'Paraguay',
  // Europe
  '250': 'France',
  '276': 'Allemagne',
  '826': 'Royaume-Uni',
  '372': 'Irlande',
  '528': 'Pays-Bas',
  '056': 'Belgique',
  '442': 'Luxembourg',
  '724': 'Espagne',
  '620': 'Portugal',
  '380': 'Italie',
  '756': 'Suisse',
  '040': 'Autriche',
  '208': 'Danemark',
  '752': 'Suède',
  '578': 'Norvège',
  '246': 'Finlande',
  '352': 'Islande',
  '616': 'Pologne',
  '203': 'Tchéquie',
  '703': 'Slovaquie',
  '348': 'Hongrie',
  '642': 'Roumanie',
  '100': 'Bulgarie',
  '300': 'Grèce',
  '191': 'Croatie',
  '705': 'Slovénie',
  '688': 'Serbie',
  '233': 'Estonie',
  '428': 'Lettonie',
  '440': 'Lituanie',
  '807': 'Macédoine du Nord',
  '499': 'Monténégro',
  '470': 'Malte',
  '196': 'Chypre',
  '020': 'Andorre',
  '492': 'Monaco',
  '438': 'Liechtenstein',
  '674': 'Saint-Marin',
  // Asie / Océanie
  '392': 'Japon',
  '410': 'Corée du Sud',
  '344': 'Hong Kong',
  '702': 'Singapour',
  '458': 'Malaisie',
  '764': 'Thaïlande',
  '360': 'Indonésie',
  '608': 'Philippines',
  '158': 'Taïwan',
  '036': 'Australie',
  '554': 'Nouvelle-Zélande',
  // Afrique
  '710': 'Afrique du Sud',
  '404': 'Kenya',
  '288': 'Ghana',
  '566': 'Nigeria',
  '686': 'Sénégal',
  '072': 'Botswana',
  '426': 'Lesotho',
  '748': 'Eswatini',
  '800': 'Ouganda',
  '646': 'Rwanda',
};

/** Sous-ensemble européen de la liste ci-dessus (pour le filtre de zone). */
const EUROPE_IDS = new Set([
  '250', '276', '826', '372', '528', '056', '442', '724', '620', '380',
  '756', '040', '208', '752', '578', '246', '352', '616', '203', '703',
  '348', '642', '100', '300', '191', '705', '688', '233', '428', '440',
  '807', '499', '470', '196', '020', '492', '438', '674',
]);

/* --------------------- Géométrie : pays et territoires --------------------
 * Certains pays de ce jeu de données regroupent, dans un seul MultiPolygon,
 * leur territoire principal ET des territoires d'outre-mer très éloignés
 * (ex: la "France" inclut la Guyane et La Réunion, les "Pays-Bas" incluent
 * Aruba/Curaçao). Le rectangle englobant brut devient alors immense et
 * l'échantillonnage aléatoire tombe presque toujours en dehors des terres —
 * ou pire, tombe parfois en Guyane pour une manche "France". On ne garde
 * donc que le territoire principal + ses voisins proches (Corse pour la
 * France, Sicile/Sardaigne pour l'Italie, les deux îles principales pour la
 * Nouvelle-Zélande...), et on écarte le reste. -------------------------- */

function ringBbox(ring) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of ring) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return [minX, minY, maxX, maxY];
}

/** Un "composant" = un seul polygone (anneau extérieur + éventuels trous). */
function componentsOf(feature) {
  return feature.geometry.type === 'Polygon'
    ? [feature.geometry.coordinates]
    : feature.geometry.coordinates;
}

function bboxOfRings(rings) {
  const boxes = rings.map(ringBbox);
  return [
    Math.min(...boxes.map((b) => b[0])),
    Math.min(...boxes.map((b) => b[1])),
    Math.max(...boxes.map((b) => b[2])),
    Math.max(...boxes.map((b) => b[3])),
  ];
}

function bboxArea([minX, minY, maxX, maxY]) {
  return Math.max(0, maxX - minX) * Math.max(0, maxY - minY);
}

/** Distance "circulaire" en longitude (gère le passage par l'antiméridien). */
function lngDistance(a, b) {
  const d = Math.abs(a - b);
  return d > 180 ? 360 - d : d;
}

const MAIN_LAT_SPAN = 25; // écart de latitude toléré avec le territoire principal
const MAIN_LNG_SPAN = 40; // plus permissif en longitude (grands archipels type Indonésie)

/**
 * Ne garde que le territoire principal d'un pays (+ voisins proches) et
 * écarte les territoires manifestement éloignés (outre-mer, exclaves...).
 */
function mainlandComponents(feature) {
  const comps = componentsOf(feature).map((rings) => ({
    rings,
    box: bboxOfRings(rings),
  }));
  if (comps.length === 1) return comps;

  const anchor = comps.reduce((a, b) => (bboxArea(b.box) > bboxArea(a.box) ? b : a));
  const anchorCenter = [(anchor.box[0] + anchor.box[2]) / 2, (anchor.box[1] + anchor.box[3]) / 2];

  let kept = comps.filter((c) => {
    if (c === anchor) return true;
    const center = [(c.box[0] + c.box[2]) / 2, (c.box[1] + c.box[3]) / 2];
    const latD = Math.abs(center[1] - anchorCenter[1]);
    const lngD = lngDistance(center[0], anchorCenter[0]);
    return latD <= MAIN_LAT_SPAN && lngD <= MAIN_LNG_SPAN;
  });

  // Garde-fou : si le regroupement laisse quand même une bbox démesurée
  // (ex: un composant proche mais de l'autre côté de l'antiméridien), on se
  // rabat sur le seul territoire principal.
  const combined = bboxOfRings(kept.flatMap((c) => c.rings));
  if (combined[2] - combined[0] > 2 * MAIN_LNG_SPAN || combined[3] - combined[1] > 2 * MAIN_LAT_SPAN) {
    kept = [anchor];
  }
  return kept;
}

/**
 * id -> { components, bbox }. Certains identifiants ISO sont partagés par un
 * pays et un petit territoire qui lui est associé dans ce jeu de données
 * (ex: "036" = Australie ET les îles Ashmore-et-Cartier) : on garde
 * systématiquement la plus grande géométrie brute pour éviter de tirer un
 * confetti au lieu du pays, puis on retire ses éventuels territoires
 * d'outre-mer éloignés.
 */
const byId = new Map();
for (const f of FEATURES) {
  if (!f.id || !COUNTRY_NAMES_FR[f.id]) continue;
  const existing = byId.get(f.id);
  const area = bboxArea(bboxOfRings(componentsOf(f).flat()));
  if (!existing || area > existing._rawArea) {
    byId.set(f.id, Object.assign(f, { _rawArea: area }));
  }
}
for (const [id, feature] of byId) {
  const components = mainlandComponents(feature);
  byId.set(id, { components, box: bboxOfRings(components.flatMap((c) => c.rings)) });
}

/** Ray-casting standard (règle pair-impair), gère les trous via le XOR entre anneaux. */
function pointInRing(lng, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersect =
      yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function pointInPolygonRings(lng, lat, rings) {
  let inside = false;
  for (const ring of rings) {
    if (pointInRing(lng, lat, ring)) inside = !inside;
  }
  return inside;
}

function pointInEntry(lng, lat, entry) {
  return entry.components.some((c) => pointInPolygonRings(lng, lat, c.rings));
}

/** Tire un point au hasard À L'INTÉRIEUR du pays donné (ou null si échec). */
function randomPointInEntry(entry, maxAttempts = 60) {
  const [minX, minY, maxX, maxY] = entry.box;
  for (let i = 0; i < maxAttempts; i++) {
    const lng = minX + Math.random() * (maxX - minX);
    const lat = minY + Math.random() * (maxY - minY);
    if (pointInEntry(lng, lat, entry)) return { lat, lng };
  }
  return null;
}

/** Liste des ids éligibles selon la zone choisie dans le lobby. */
function eligibleIds(region) {
  if (region === 'france') return ['250'];
  if (region === 'europe') return [...EUROPE_IDS].filter((id) => byId.has(id));
  return [...byId.keys()];
}

/**
 * Tire `count` lieux aléatoires, filtrés par zone géographique.
 * Évite de retirer le même pays deux fois de suite dans la même partie
 * quand le pool le permet (juste pour la variété, pas une garantie stricte).
 */
function pickRandomLocations(count, region) {
  const ids = eligibleIds(region);
  const results = [];
  let lastId = null;

  for (let i = 0; i < count; i++) {
    let picked = null;

    for (let attempt = 0; attempt < 25 && !picked; attempt++) {
      const candidates = ids.length > 1 ? ids.filter((id) => id !== lastId) : ids;
      const id = candidates[Math.floor(Math.random() * candidates.length)];
      const entry = byId.get(id);
      const point = randomPointInEntry(entry);
      if (point) {
        picked = {
          lat: point.lat,
          lng: point.lng,
          countryId: id,
          name: COUNTRY_NAMES_FR[id],
        };
        lastId = id;
      }
    }

    // Filet de sécurité ultime (ne devrait jamais arriver en pratique) :
    // ne jamais planter une manche faute d'avoir trouvé un point.
    if (!picked) {
      picked = { lat: 48.8566, lng: 2.3522, countryId: '250', name: 'France' };
      lastId = '250';
    }

    results.push(picked);
  }
  return results;
}

module.exports = { pickRandomLocations, COUNTRY_NAMES_FR };
