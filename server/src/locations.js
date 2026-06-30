'use strict';

/**
 * Liste de coordonnées « sûres » : des lieux connus disposant d'une bonne
 * couverture Street View (et souvent Mapillary). Toutes les manches sont
 * tirées de cette liste pour garantir qu'une vue panoramique existe et que
 * TOUS les joueurs voient exactement le même endroit.
 *
 * Champs :
 *   name       Nom affiché aux résultats (jamais pendant la manche).
 *   lat, lng   Coordonnées du lieu.
 *   countryId  Code numérique ISO 3166-1 (string) — doit correspondre aux
 *              identifiants utilisés par client/data/countries-50m.json,
 *              c'est ce qui permet de noter le mode "Pays".
 *   country    Code alpha-2 ISO 3166-1, pour filtrage/affichage.
 *   continent  'europe' | 'north-america' | 'south-america' | 'asia' |
 *              'africa' | 'oceania' — utilisé par le mode thématique.
 *
 * Pour ajouter des lieux : ajoute simplement une entrée avec ces champs.
 */

const LOCATIONS = [
  { lat: 48.8584, lng: 2.2945, name: 'Tour Eiffel, Paris (France)', countryId: '250', country: 'FR', continent: 'europe' },
  { lat: 40.758, lng: -73.9855, name: 'Times Square, New York (USA)', countryId: '840', country: 'US', continent: 'north-america' },
  { lat: 51.5007, lng: -0.1246, name: 'Big Ben, Londres (Royaume-Uni)', countryId: '826', country: 'GB', continent: 'europe' },
  { lat: 35.6595, lng: 139.7005, name: 'Shibuya, Tokyo (Japon)', countryId: '392', country: 'JP', continent: 'asia' },
  { lat: -33.8568, lng: 151.2153, name: 'Opéra de Sydney (Australie)', countryId: '036', country: 'AU', continent: 'oceania' },
  { lat: 37.8199, lng: -122.4783, name: 'Golden Gate, San Francisco (USA)', countryId: '840', country: 'US', continent: 'north-america' },
  { lat: 41.8902, lng: 12.4922, name: 'Colisée, Rome (Italie)', countryId: '380', country: 'IT', continent: 'europe' },
  { lat: -22.9519, lng: -43.2105, name: 'Rio de Janeiro (Brésil)', countryId: '076', country: 'BR', continent: 'south-america' },
  { lat: -33.9249, lng: 18.4241, name: 'Le Cap (Afrique du Sud)', countryId: '710', country: 'ZA', continent: 'africa' },
  { lat: 55.7539, lng: 37.6208, name: 'Place Rouge, Moscou (Russie)', countryId: '643', country: 'RU', continent: 'europe' },
  { lat: 52.5163, lng: 13.3777, name: 'Porte de Brandebourg, Berlin (Allemagne)', countryId: '276', country: 'DE', continent: 'europe' },
  { lat: 52.3676, lng: 4.9041, name: 'Amsterdam (Pays-Bas)', countryId: '528', country: 'NL', continent: 'europe' },
  { lat: 41.4036, lng: 2.1744, name: 'Sagrada Família, Barcelone (Espagne)', countryId: '724', country: 'ES', continent: 'europe' },
  { lat: 43.6426, lng: -79.3871, name: 'CN Tower, Toronto (Canada)', countryId: '124', country: 'CA', continent: 'north-america' },
  { lat: 1.2834, lng: 103.8607, name: 'Marina Bay, Singapour', countryId: '702', country: 'SG', continent: 'asia' },
  { lat: 13.7563, lng: 100.5018, name: 'Bangkok (Thaïlande)', countryId: '764', country: 'TH', continent: 'asia' },
  { lat: 41.0086, lng: 28.9802, name: 'Istanbul (Turquie)', countryId: '792', country: 'TR', continent: 'europe' },
  { lat: 37.9715, lng: 23.7257, name: 'Acropole, Athènes (Grèce)', countryId: '300', country: 'GR', continent: 'europe' },
  { lat: -34.6037, lng: -58.3816, name: 'Buenos Aires (Argentine)', countryId: '032', country: 'AR', continent: 'south-america' },
  { lat: 19.4326, lng: -99.1332, name: 'Mexico (Mexique)', countryId: '484', country: 'MX', continent: 'north-america' },
  { lat: 34.1341, lng: -118.3215, name: 'Hollywood, Los Angeles (USA)', countryId: '840', country: 'US', continent: 'north-america' },
  { lat: 41.8781, lng: -87.6298, name: 'Chicago (USA)', countryId: '840', country: 'US', continent: 'north-america' },
  { lat: 47.6205, lng: -122.3493, name: 'Space Needle, Seattle (USA)', countryId: '840', country: 'US', continent: 'north-america' },
  { lat: 49.2827, lng: -123.1207, name: 'Vancouver (Canada)', countryId: '124', country: 'CA', continent: 'north-america' },
  { lat: 38.7223, lng: -9.1393, name: 'Lisbonne (Portugal)', countryId: '620', country: 'PT', continent: 'europe' },
  { lat: 40.4168, lng: -3.7038, name: 'Madrid (Espagne)', countryId: '724', country: 'ES', continent: 'europe' },
  { lat: 48.2082, lng: 16.3738, name: 'Vienne (Autriche)', countryId: '040', country: 'AT', continent: 'europe' },
  { lat: 50.0755, lng: 14.4378, name: 'Prague (Tchéquie)', countryId: '203', country: 'CZ', continent: 'europe' },
  { lat: 59.3293, lng: 18.0686, name: 'Stockholm (Suède)', countryId: '752', country: 'SE', continent: 'europe' },
  { lat: 59.9139, lng: 10.7522, name: 'Oslo (Norvège)', countryId: '578', country: 'NO', continent: 'europe' },
  { lat: 55.6761, lng: 12.5683, name: 'Copenhague (Danemark)', countryId: '208', country: 'DK', continent: 'europe' },
  { lat: 53.3498, lng: -6.2603, name: 'Dublin (Irlande)', countryId: '372', country: 'IE', continent: 'europe' },
  { lat: 55.9533, lng: -3.1883, name: 'Édimbourg (Écosse)', countryId: '826', country: 'GB', continent: 'europe' },
  { lat: 52.2297, lng: 21.0122, name: 'Varsovie (Pologne)', countryId: '616', country: 'PL', continent: 'europe' },
  { lat: 47.4979, lng: 19.0402, name: 'Budapest (Hongrie)', countryId: '348', country: 'HU', continent: 'europe' },
  { lat: 60.1699, lng: 24.9384, name: 'Helsinki (Finlande)', countryId: '246', country: 'FI', continent: 'europe' },
  { lat: 64.1466, lng: -21.9426, name: 'Reykjavik (Islande)', countryId: '352', country: 'IS', continent: 'europe' },
  { lat: -41.2865, lng: 174.7762, name: 'Wellington (Nouvelle-Zélande)', countryId: '554', country: 'NZ', continent: 'oceania' },
  { lat: -36.8485, lng: 174.7633, name: 'Auckland (Nouvelle-Zélande)', countryId: '554', country: 'NZ', continent: 'oceania' },
  { lat: 37.5665, lng: 126.978, name: 'Séoul (Corée du Sud)', countryId: '410', country: 'KR', continent: 'asia' },
  { lat: 22.3193, lng: 114.1694, name: 'Hong Kong', countryId: '344', country: 'HK', continent: 'asia' },
  { lat: 3.1578, lng: 101.7117, name: 'Tours Petronas, Kuala Lumpur (Malaisie)', countryId: '458', country: 'MY', continent: 'asia' },
  { lat: -33.4489, lng: -70.6693, name: 'Santiago (Chili)', countryId: '152', country: 'CL', continent: 'south-america' },
  { lat: -12.0464, lng: -77.0428, name: 'Lima (Pérou)', countryId: '604', country: 'PE', continent: 'south-america' },
  { lat: 4.711, lng: -74.0721, name: 'Bogotá (Colombie)', countryId: '170', country: 'CO', continent: 'south-america' },
  { lat: 45.5017, lng: -73.5673, name: 'Montréal (Canada)', countryId: '124', country: 'CA', continent: 'north-america' },
  { lat: 36.1147, lng: -115.1728, name: 'Las Vegas Strip (USA)', countryId: '840', country: 'US', continent: 'north-america' },
  { lat: 25.7617, lng: -80.1918, name: 'Miami (USA)', countryId: '840', country: 'US', continent: 'north-america' },
  { lat: 29.9511, lng: -90.0715, name: 'La Nouvelle-Orléans (USA)', countryId: '840', country: 'US', continent: 'north-america' },
  { lat: 21.3069, lng: -157.8583, name: 'Honolulu, Hawaï (USA)', countryId: '840', country: 'US', continent: 'north-america' },

  // --- France : pool dédiée pour le mode thématique "France uniquement" ---
  { lat: 43.2965, lng: 5.3698, name: 'Vieux-Port, Marseille (France)', countryId: '250', country: 'FR', continent: 'europe' },
  { lat: 45.7640, lng: 4.8357, name: 'Vieux Lyon (France)', countryId: '250', country: 'FR', continent: 'europe' },
  { lat: 44.8378, lng: -0.5792, name: 'Place de la Bourse, Bordeaux (France)', countryId: '250', country: 'FR', continent: 'europe' },
  { lat: 43.6047, lng: 1.4442, name: 'Capitole, Toulouse (France)', countryId: '250', country: 'FR', continent: 'europe' },
  { lat: 48.5734, lng: 7.7521, name: 'Cathédrale de Strasbourg (France)', countryId: '250', country: 'FR', continent: 'europe' },
  { lat: 43.6961, lng: 7.2716, name: 'Promenade des Anglais, Nice (France)', countryId: '250', country: 'FR', continent: 'europe' },
  { lat: 47.2184, lng: -1.5536, name: 'Château des ducs de Bretagne, Nantes (France)', countryId: '250', country: 'FR', continent: 'europe' },
  { lat: 50.6292, lng: 3.0573, name: 'Grand-Place, Lille (France)', countryId: '250', country: 'FR', continent: 'europe' },
  { lat: 48.6361, lng: -1.5115, name: 'Mont-Saint-Michel (France)', countryId: '250', country: 'FR', continent: 'europe' },
  { lat: 45.8992, lng: 6.1294, name: 'Annecy (France)', countryId: '250', country: 'FR', continent: 'europe' },
  { lat: 43.2061, lng: 2.3636, name: 'Cité de Carcassonne (France)', countryId: '250', country: 'FR', continent: 'europe' },
  { lat: 43.9493, lng: 4.8059, name: 'Palais des Papes, Avignon (France)', countryId: '250', country: 'FR', continent: 'europe' },
  { lat: 48.0794, lng: 7.3585, name: 'Colmar (France)', countryId: '250', country: 'FR', continent: 'europe' },
  { lat: 47.3220, lng: 5.0415, name: 'Dijon (France)', countryId: '250', country: 'FR', continent: 'europe' },
  { lat: 48.1173, lng: -1.6778, name: 'Rennes (France)', countryId: '250', country: 'FR', continent: 'europe' },
  { lat: 48.8049, lng: 2.1204, name: 'Château de Versailles (France)', countryId: '250', country: 'FR', continent: 'europe' },
];

/**
 * Mélange (Fisher–Yates) une copie du tableau, puis renvoie les `count`
 * premiers éléments. Garantit des lieux distincts pour une même partie.
 *
 * @param {number} count
 * @param {'world'|'europe'|'france'} [region] Filtre thématique (défaut: 'world' = tout).
 */
function pickLocations(count, region) {
  let pool = LOCATIONS;
  if (region === 'europe') {
    pool = LOCATIONS.filter((l) => l.continent === 'europe');
  } else if (region === 'france') {
    pool = LOCATIONS.filter((l) => l.country === 'FR');
  }
  // Filet de sécurité : si le filtre ne laisse pas assez de lieux (ne devrait
  // pas arriver avec les pools ci-dessus), on complète avec le pool complet.
  if (pool.length < count) pool = LOCATIONS;

  pool = pool.slice();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(count, pool.length));
}

module.exports = { LOCATIONS, pickLocations };
