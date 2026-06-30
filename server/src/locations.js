'use strict';

/**
 * Liste de coordonnées « sûres » : des lieux connus disposant d'une bonne
 * couverture Street View (et souvent Mapillary). Toutes les manches sont
 * tirées de cette liste pour garantir qu'une vue panoramique existe et que
 * TOUS les joueurs voient exactement le même endroit.
 *
 * Pour ajouter des lieux : ajoute simplement { lat, lng, name }.
 * Le champ `name` n'est révélé qu'à la fin de la manche (écran de résultats).
 */

const LOCATIONS = [
  { lat: 48.8584, lng: 2.2945, name: 'Tour Eiffel, Paris (France)' },
  { lat: 40.758, lng: -73.9855, name: 'Times Square, New York (USA)' },
  { lat: 51.5007, lng: -0.1246, name: 'Big Ben, Londres (Royaume-Uni)' },
  { lat: 35.6595, lng: 139.7005, name: 'Shibuya, Tokyo (Japon)' },
  { lat: -33.8568, lng: 151.2153, name: 'Opéra de Sydney (Australie)' },
  { lat: 37.8199, lng: -122.4783, name: 'Golden Gate, San Francisco (USA)' },
  { lat: 41.8902, lng: 12.4922, name: 'Colisée, Rome (Italie)' },
  { lat: -22.9519, lng: -43.2105, name: 'Rio de Janeiro (Brésil)' },
  { lat: -33.9249, lng: 18.4241, name: 'Le Cap (Afrique du Sud)' },
  { lat: 55.7539, lng: 37.6208, name: 'Place Rouge, Moscou (Russie)' },
  { lat: 52.5163, lng: 13.3777, name: 'Porte de Brandebourg, Berlin (Allemagne)' },
  { lat: 52.3676, lng: 4.9041, name: 'Amsterdam (Pays-Bas)' },
  { lat: 41.4036, lng: 2.1744, name: 'Sagrada Família, Barcelone (Espagne)' },
  { lat: 43.6426, lng: -79.3871, name: 'CN Tower, Toronto (Canada)' },
  { lat: 1.2834, lng: 103.8607, name: 'Marina Bay, Singapour' },
  { lat: 13.7563, lng: 100.5018, name: 'Bangkok (Thaïlande)' },
  { lat: 41.0086, lng: 28.9802, name: 'Istanbul (Turquie)' },
  { lat: 37.9715, lng: 23.7257, name: 'Acropole, Athènes (Grèce)' },
  { lat: -34.6037, lng: -58.3816, name: 'Buenos Aires (Argentine)' },
  { lat: 19.4326, lng: -99.1332, name: 'Mexico (Mexique)' },
  { lat: 34.1341, lng: -118.3215, name: 'Hollywood, Los Angeles (USA)' },
  { lat: 41.8781, lng: -87.6298, name: 'Chicago (USA)' },
  { lat: 47.6205, lng: -122.3493, name: 'Space Needle, Seattle (USA)' },
  { lat: 49.2827, lng: -123.1207, name: 'Vancouver (Canada)' },
  { lat: 38.7223, lng: -9.1393, name: 'Lisbonne (Portugal)' },
  { lat: 40.4168, lng: -3.7038, name: 'Madrid (Espagne)' },
  { lat: 48.2082, lng: 16.3738, name: 'Vienne (Autriche)' },
  { lat: 50.0755, lng: 14.4378, name: 'Prague (Tchéquie)' },
  { lat: 59.3293, lng: 18.0686, name: 'Stockholm (Suède)' },
  { lat: 59.9139, lng: 10.7522, name: 'Oslo (Norvège)' },
  { lat: 55.6761, lng: 12.5683, name: 'Copenhague (Danemark)' },
  { lat: 53.3498, lng: -6.2603, name: 'Dublin (Irlande)' },
  { lat: 55.9533, lng: -3.1883, name: 'Édimbourg (Écosse)' },
  { lat: 52.2297, lng: 21.0122, name: 'Varsovie (Pologne)' },
  { lat: 47.4979, lng: 19.0402, name: 'Budapest (Hongrie)' },
  { lat: 60.1699, lng: 24.9384, name: 'Helsinki (Finlande)' },
  { lat: 64.1466, lng: -21.9426, name: 'Reykjavik (Islande)' },
  { lat: -41.2865, lng: 174.7762, name: 'Wellington (Nouvelle-Zélande)' },
  { lat: -36.8485, lng: 174.7633, name: 'Auckland (Nouvelle-Zélande)' },
  { lat: 37.5665, lng: 126.978, name: 'Séoul (Corée du Sud)' },
  { lat: 22.3193, lng: 114.1694, name: 'Hong Kong' },
  { lat: 3.1578, lng: 101.7117, name: 'Tours Petronas, Kuala Lumpur (Malaisie)' },
  { lat: -33.4489, lng: -70.6693, name: 'Santiago (Chili)' },
  { lat: -12.0464, lng: -77.0428, name: 'Lima (Pérou)' },
  { lat: 4.711, lng: -74.0721, name: 'Bogotá (Colombie)' },
  { lat: 45.5017, lng: -73.5673, name: 'Montréal (Canada)' },
  { lat: 36.1147, lng: -115.1728, name: 'Las Vegas Strip (USA)' },
  { lat: 25.7617, lng: -80.1918, name: 'Miami (USA)' },
  { lat: 29.9511, lng: -90.0715, name: 'La Nouvelle-Orléans (USA)' },
  { lat: 21.3069, lng: -157.8583, name: 'Honolulu, Hawaï (USA)' },
];

/**
 * Mélange (Fisher–Yates) une copie du tableau, puis renvoie les `count`
 * premiers éléments. Garantit des lieux distincts pour une même partie.
 */
function pickLocations(count) {
  const pool = LOCATIONS.slice();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(count, pool.length));
}

module.exports = { LOCATIONS, pickLocations };
