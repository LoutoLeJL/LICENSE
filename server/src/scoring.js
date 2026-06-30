'use strict';

/**
 * Calcul des distances (formule de Haversine) et des scores (0 à 5000).
 *
 * Le score décroît exponentiellement avec la distance, comme dans GeoGuessr.
 *   score = MAX_SCORE * e^(-distance_km / SCALE_KM)
 *
 * - Un SCALE_KM petit = jeu plus difficile (les points chutent vite).
 * - En dessous de PERFECT_DISTANCE_KM, on accorde le score maximum.
 */

const EARTH_RADIUS_KM = 6371;
const MAX_SCORE = 5000;
const PERFECT_DISTANCE_KM = 0.15; // < 150 m => 5000 points
const SCALE_KM = 2000; // facteur de décroissance (adapté à une carte monde)

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

/**
 * Distance du grand cercle entre deux points {lat, lng} en kilomètres.
 */
function haversineKm(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Convertit une distance (km) en points (0 à 5000).
 */
function scoreFromDistance(distanceKm) {
  if (distanceKm <= PERFECT_DISTANCE_KM) return MAX_SCORE;
  return Math.round(MAX_SCORE * Math.exp(-distanceKm / SCALE_KM));
}

module.exports = {
  haversineKm,
  scoreFromDistance,
  MAX_SCORE,
  SCALE_KM,
};
