/**
 * Cartes Leaflet (OpenStreetMap).
 *  - GuessMap   : minimap interactive (placer un marqueur OU cliquer un pays).
 *  - ResultMap  : carte des résultats (vrai lieu/pays + suppositions + liens).
 */
window.Maps = (function () {
  const OSM_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
  const OSM_ATTR = "© OpenStreetMap";

  const COUNTRY_DATA_URL = "data/countries-50m.json";
  const COUNTRY_DEFAULT_STYLE = { color: "#1b232d", weight: 1, fillColor: "#4361ee", fillOpacity: 0.22 };
  const COUNTRY_HOVER_STYLE = { color: "#1b232d", weight: 1, fillColor: "#4361ee", fillOpacity: 0.4 };
  const COUNTRY_SELECTED_STYLE = { color: "#06121b", weight: 2, fillColor: "#4cc9f0", fillOpacity: 0.65 };

  // Partagé entre GuessMap et ResultMap : on ne télécharge/convertit les
  // frontières des pays qu'une seule fois par session.
  let countriesGeoJsonPromise = null;
  function loadCountriesGeoJson() {
    if (!countriesGeoJsonPromise) {
      countriesGeoJsonPromise = fetch(COUNTRY_DATA_URL)
        .then((r) => r.json())
        .then((topo) => topojson.feature(topo, topo.objects.countries));
    }
    return countriesGeoJsonPromise;
  }

  /* --------------------------- GuessMap ---------------------------- */
  const GuessMap = (function () {
    let map = null;
    let marker = null;
    let onPlaceCb = null;
    let mode = "precise";
    let countryLayer = null;
    let selectedCountryId = null;

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
        if (mode !== "precise") return;
        setMarker(e.latlng);
        if (onPlaceCb) onPlaceCb({ lat: e.latlng.lat, lng: e.latlng.lng });
      });
    }

    function setMarker(latlng) {
      if (marker) {
        marker.setLatLng(latlng);
      } else {
        marker = L.marker(latlng, { draggable: true }).addTo(map);
        marker.on("dragend", () => {
          const ll = marker.getLatLng();
          if (onPlaceCb) onPlaceCb({ lat: ll.lat, lng: ll.lng });
        });
      }
    }

    function clearMarker() {
      if (marker) {
        map.removeLayer(marker);
        marker = null;
      }
    }

    function selectCountry(countryId) {
      selectedCountryId = countryId;
      countryLayer.eachLayer((l) => {
        l.setStyle(l.feature.id === countryId ? COUNTRY_SELECTED_STYLE : COUNTRY_DEFAULT_STYLE);
      });
    }

    async function showCountryLayer() {
      const geo = await loadCountriesGeoJson();
      if (mode !== "country") return; // la manche a pu changer entre-temps
      if (countryLayer) map.removeLayer(countryLayer);
      selectedCountryId = null;
      countryLayer = L.geoJSON(geo, {
        style: () => COUNTRY_DEFAULT_STYLE,
        onEachFeature: (feature, fLayer) => {
          fLayer.on("click", (e) => {
            L.DomEvent.stopPropagation(e);
            selectCountry(feature.id);
            if (onPlaceCb) onPlaceCb({ countryId: feature.id });
          });
          fLayer.on("mouseover", () => {
            if (feature.id !== selectedCountryId) fLayer.setStyle(COUNTRY_HOVER_STYLE);
          });
          fLayer.on("mouseout", () => {
            if (feature.id !== selectedCountryId) fLayer.setStyle(COUNTRY_DEFAULT_STYLE);
          });
        },
      }).addTo(map);
    }

    function hideCountryLayer() {
      if (countryLayer) {
        map.removeLayer(countryLayer);
        countryLayer = null;
      }
      selectedCountryId = null;
    }

    /**
     * Réinitialise la carte pour une nouvelle manche.
     * @param {string} containerId
     * @param {'precise'|'country'} guessMode
     * @param {(guess: {lat,lng}|{countryId}) => void} onPlace
     */
    function reset(containerId, guessMode, onPlace) {
      ensure(containerId);
      mode = guessMode === "country" ? "country" : "precise";
      onPlaceCb = onPlace;
      clearMarker();
      map.setView([20, 0], 2);

      if (mode === "country") {
        showCountryLayer();
      } else {
        hideCountryLayer();
      }
      // Leaflet a besoin d'un recalcul de taille quand le conteneur change.
      setTimeout(() => map.invalidateSize(), 50);
    }

    function getGuess() {
      if (mode === "country") {
        return selectedCountryId ? { countryId: selectedCountryId } : null;
      }
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
     * Mode "précis" : affiche le vrai lieu et chaque supposition reliée par une ligne.
     * @param {{lat,lng,name}} actual
     * @param {Array<{name,guess,color}>} entries
     */
    function render(containerId, actual, entries) {
      ensure(containerId);
      layer.clearLayers();
      const bounds = [];

      const actualIcon = L.divIcon({
        className: "",
        html: '<div style="font-size:26px;filter:drop-shadow(0 1px 3px #000)">📍</div>',
        iconSize: [26, 26],
        iconAnchor: [13, 26],
      });
      L.marker([actual.lat, actual.lng], { icon: actualIcon })
        .addTo(layer)
        .bindPopup(`<b>Lieu exact</b><br>${actual.name || ""}`);
      bounds.push([actual.lat, actual.lng]);

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

    /**
     * Mode "pays" : colore le pays correct en vert et chaque pays deviné dans
     * la couleur du joueur qui l'a choisi (regroupés si plusieurs d'accord).
     * @param {{lat,lng,name,countryId}} actual
     * @param {Array<{name,guess:{countryId}|null,color}>} entries
     */
    async function renderCountry(containerId, actual, entries) {
      ensure(containerId);
      layer.clearLayers();

      const geo = await loadCountriesGeoJson();
      const guessedByCountry = new Map();
      entries.forEach((e) => {
        if (!e.guess) return;
        const cid = e.guess.countryId;
        if (!guessedByCountry.has(cid)) guessedByCountry.set(cid, []);
        guessedByCountry.get(cid).push(e);
      });

      const bounds = [];
      L.geoJSON(geo, {
        style: (feature) => {
          if (feature.id === actual.countryId) {
            return { color: '#06d6a0', weight: 2, fillColor: '#06d6a0', fillOpacity: 0.55 };
          }
          if (guessedByCountry.has(feature.id)) {
            return {
              color: guessedByCountry.get(feature.id)[0].color,
              weight: 2,
              fillColor: guessedByCountry.get(feature.id)[0].color,
              fillOpacity: 0.35,
            };
          }
          return { color: '#39434f', weight: 0.5, fillColor: '#1b232d', fillOpacity: 0.12 };
        },
        onEachFeature: (feature, fLayer) => {
          const isActual = feature.id === actual.countryId;
          const guessers = guessedByCountry.get(feature.id);
          if (isActual) {
            fLayer.bindPopup(`<b>Pays exact</b><br>${actual.name || feature.properties.name}`);
            bounds.push(fLayer.getBounds());
          } else if (guessers) {
            fLayer.bindPopup(`<b>${guessers.map((g) => g.name).join(', ')}</b>`);
            bounds.push(fLayer.getBounds());
          }
        },
      }).addTo(layer);

      setTimeout(() => {
        map.invalidateSize();
        if (bounds.length) {
          let combined = bounds[0];
          for (let i = 1; i < bounds.length; i++) combined = combined.extend(bounds[i]);
          map.fitBounds(combined, { padding: [40, 40] });
        } else {
          map.setView([actual.lat, actual.lng], 3);
        }
      }, 60);
    }

    return { render, renderCountry };
  })();

  return { GuessMap, ResultMap };
})();
