/**
 * Gestion de la vue panoramique 360°.
 *
 * Deux fournisseurs possibles (choisis dans config.js) :
 *   - 'google'    : Google Street View (recommandé, crédit gratuit 200$/mois).
 *   - 'mapillary' : alternative 100 % gratuite (couverture variable).
 *
 * Interface commune :
 *   Panorama.init(containerEl)    -> Promise   (charge le SDK une fois)
 *   Panorama.show({lat, lng})     -> Promise<boolean>  (true si une vue existe)
 *   Panorama.setMovement(allowed) -> verrouille/déverrouille le déplacement
 *                                     dans la vue (mode NMPZ). `ALLOW_MOVE`
 *                                     dans config.js reste un plafond global :
 *                                     s'il est à false, le mouvement reste
 *                                     verrouillé même si la salle l'autorise.
 */
window.Panorama = (function () {
  const cfg = window.APP_CONFIG;
  const provider = cfg.PANORAMA_PROVIDER === "mapillary" ? "mapillary" : "google";

  /* =========================== GOOGLE ============================== */
  const Google = (function () {
    let pano = null;
    let svService = null;

    function loadSdk() {
      return new Promise((resolve, reject) => {
        if (window.google && window.google.maps) return resolve();
        const cbName = "__gmapsInit";
        window[cbName] = () => resolve();
        const s = document.createElement("script");
        s.src =
          "https://maps.googleapis.com/maps/api/js?key=" +
          encodeURIComponent(cfg.GOOGLE_MAPS_API_KEY) +
          "&callback=" +
          cbName;
        s.async = true;
        s.defer = true;
        s.onerror = () => reject(new Error("Échec du chargement de Google Maps"));
        document.head.appendChild(s);
      });
    }

    async function init(container) {
      await loadSdk();
      svService = new google.maps.StreetViewService();
      pano = new google.maps.StreetViewPanorama(container, {
        visible: false,
        addressControl: false, // masque le nom de rue/lieu (anti-triche basique)
        showRoadLabels: false,
        fullscreenControl: false,
        motionTracking: false,
        motionTrackingControl: false,
        linksControl: cfg.ALLOW_MOVE,
        clickToGo: cfg.ALLOW_MOVE,
        panControl: true,
        zoomControl: true,
        enableCloseButton: false,
      });
    }

    function findAndShow(request) {
      return new Promise((resolve) => {
        svService.getPanorama(request, (data, status) => {
          if (status === google.maps.StreetViewStatus.OK) {
            pano.setPano(data.location.pano);
            pano.setPov({ heading: Math.random() * 360, pitch: 0 });
            pano.setZoom(0);
            pano.setVisible(true);
            resolve(true);
          } else {
            // ZERO_RESULTS = pas d'image à cet endroit (normal, on élargit).
            // UNKNOWN_ERROR / OVER_QUERY_LIMIT = problème de clé/quota, utile à logger.
            if (status !== google.maps.StreetViewStatus.ZERO_RESULTS) {
              console.warn("Street View getPanorama() :", status, request);
            }
            resolve(false);
          }
        });
      });
    }

    async function show(location) {
      // On élargit progressivement la recherche : un lieu connu finit presque
      // toujours par trouver une image dans un des paliers ci-dessous.
      const attempts = [
        { location, radius: 200, source: google.maps.StreetViewSource.OUTDOOR },
        { location, radius: 5000, source: google.maps.StreetViewSource.OUTDOOR },
        { location, radius: 50000 }, // dernier recours, toutes sources
      ];
      for (const request of attempts) {
        if (await findAndShow(request)) return true;
      }
      console.warn("Aucune vue Street View trouvée près de", location, "après tous les paliers.");
      return false;
    }

    function setMovement(allowed) {
      if (!pano) return;
      const effective = allowed && cfg.ALLOW_MOVE;
      pano.setOptions({ linksControl: effective, clickToGo: effective });
    }

    return { init, show, setMovement };
  })();

  /* ========================== MAPILLARY ============================ */
  const Mapillary = (function () {
    let viewer = null;

    function loadSdk() {
      return new Promise((resolve, reject) => {
        if (window.mapillary) return resolve();
        const css = document.createElement("link");
        css.rel = "stylesheet";
        css.href = "https://unpkg.com/mapillary-js@4.1.2/dist/mapillary.css";
        document.head.appendChild(css);

        const s = document.createElement("script");
        s.src = "https://unpkg.com/mapillary-js@4.1.2/dist/mapillary.js";
        s.onload = () => resolve();
        s.onerror = () => reject(new Error("Échec du chargement de Mapillary"));
        document.head.appendChild(s);
      });
    }

    async function init(container) {
      await loadSdk();
      viewer = new mapillary.Viewer({
        accessToken: cfg.MAPILLARY_TOKEN,
        container,
        component: { cover: false },
      });
    }

    // Cherche l'image Mapillary la plus proche via la Graph API, puis l'affiche.
    async function show(location) {
      const d = 0.02; // ~2 km de demi-côté pour la bbox
      const bbox = [
        location.lng - d,
        location.lat - d,
        location.lng + d,
        location.lat + d,
      ].join(",");
      const url =
        "https://graph.mapillary.com/images?access_token=" +
        encodeURIComponent(cfg.MAPILLARY_TOKEN) +
        "&fields=id&bbox=" +
        bbox +
        "&limit=1";

      try {
        const res = await fetch(url);
        const json = await res.json();
        const img = json && json.data && json.data[0];
        if (!img) return false;
        await viewer.moveTo(img.id);
        return true;
      } catch (e) {
        console.error("Mapillary:", e);
        return false;
      }
    }

    // Le mode NMPZ n'est pas géré pour Mapillary (le viewer reste navigable).
    function setMovement() {}

    return { init, show, setMovement };
  })();

  const impl = provider === "mapillary" ? Mapillary : Google;
  return { init: impl.init, show: impl.show, setMovement: impl.setMovement, provider };
})();
