/**
 * Cartes Leaflet (OpenStreetMap).
 *  - GuessMap   : minimap interactive pour placer son marqueur pendant la manche.
 *  - ResultMap  : carte des résultats (vrai lieu + suppositions + lignes).
 */
window.Maps = (function () {
  const OSM_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
  const OSM_ATTR = "© OpenStreetMap";

  /* --------------------------- GuessMap ---------------------------- */
  const GuessMap = (function () {
    let map = null;
    let marker = null;
    let onPlaceCb = null;

    function ensure(containerId) {
      if (map) return;
      map = L.map(containerId, {
        center: [20, 0],
        zoom: 2,
        worldCopyJump: true,
        zoomControl: true,
      });
      L.tileLayer(OSM_URL, { attribution: OSM_ATTR, maxZoom: 19 }).addTo(map);

      map.on("click", (e) => {
        setMarker(e.latlng);
        if (onPlaceCb) onPlaceCb(e.latlng);
      });
    }

    function setMarker(latlng) {
      if (marker) {
        marker.setLatLng(latlng);
      } else {
        marker = L.marker(latlng, { draggable: true }).addTo(map);
        marker.on("dragend", () => {
          if (onPlaceCb) onPlaceCb(marker.getLatLng());
        });
      }
    }

    /** Réinitialise la carte pour une nouvelle manche. */
    function reset(containerId, onPlace) {
      ensure(containerId);
      onPlaceCb = onPlace;
      if (marker) {
        map.removeLayer(marker);
        marker = null;
      }
      map.setView([20, 0], 2);
      // Leaflet a besoin d'un recalcul de taille quand le conteneur change.
      setTimeout(() => map.invalidateSize(), 50);
    }

    function getGuess() {
      if (!marker) return null;
      const { lat, lng } = marker.getLatLng();
      return { lat, lng };
    }

    function refresh() {
      if (map) setTimeout(() => map.invalidateSize(), 50);
    }

    return { reset, getGuess, refresh };
  })();

  /* --------------------------- ResultMap --------------------------- */
  const ResultMap = (function () {
    let map = null;
    let layer = null;

    function ensure(containerId) {
      if (map) return;
      map = L.map(containerId, { center: [20, 0], zoom: 2, worldCopyJump: true });
      L.tileLayer(OSM_URL, { attribution: OSM_ATTR, maxZoom: 19 }).addTo(map);
      layer = L.layerGroup().addTo(map);
    }

    function pin(color, label) {
      return L.divIcon({
        className: "",
        html:
          `<div style="background:${color};width:18px;height:18px;border-radius:50% 50% 50% 0;` +
          `transform:rotate(-45deg);border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.5)" ` +
          `title="${label}"></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });
    }

    /**
     * Affiche le vrai lieu (étoile) et chaque supposition reliée par une ligne.
     * @param {{lat,lng,name}} actual
     * @param {Array<{name,guess,color}>} entries
     */
    function render(containerId, actual, entries) {
      ensure(containerId);
      layer.clearLayers();
      const bounds = [];

      // Vrai lieu
      const actualIcon = L.divIcon({
        className: "",
        html:
          '<div style="font-size:26px;filter:drop-shadow(0 1px 3px #000)">📍</div>',
        iconSize: [26, 26],
        iconAnchor: [13, 26],
      });
      L.marker([actual.lat, actual.lng], { icon: actualIcon })
        .addTo(layer)
        .bindPopup(`<b>Lieu exact</b><br>${actual.name || ""}`);
      bounds.push([actual.lat, actual.lng]);

      // Suppositions
      entries.forEach((e) => {
        if (!e.guess) return;
        L.marker([e.guess.lat, e.guess.lng], { icon: pin(e.color, e.name) })
          .addTo(layer)
          .bindPopup(`<b>${e.name}</b>`);
        L.polyline(
          [
            [e.guess.lat, e.guess.lng],
            [actual.lat, actual.lng],
          ],
          { color: e.color, weight: 2, dashArray: "6 6", opacity: 0.8 }
        ).addTo(layer);
        bounds.push([e.guess.lat, e.guess.lng]);
      });

      setTimeout(() => {
        map.invalidateSize();
        if (bounds.length > 1) {
          map.fitBounds(bounds, { padding: [60, 60] });
        } else {
          map.setView([actual.lat, actual.lng], 5);
        }
      }, 60);
    }

    return { render };
  })();

  return { GuessMap, ResultMap };
})();
