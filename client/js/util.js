/* Petites fonctions utilitaires partagées. */
window.Util = (function () {
  /** Sélecteur court. */
  function $(id) {
    return document.getElementById(id);
  }

  /** Affiche un seul écran (gère la classe .active). */
  function showScreen(id) {
    document.querySelectorAll(".screen").forEach((s) => {
      s.classList.toggle("active", s.id === id);
    });
  }

  /** Formate une distance en mètres ou kilomètres lisibles. */
  function formatDistance(km) {
    if (km == null) return "—";
    if (km < 1) return `${Math.round(km * 1000)} m`;
    if (km < 100) return `${km.toFixed(1)} km`;
    return `${Math.round(km).toLocaleString("fr-FR")} km`;
  }

  /** Formate un nombre de secondes en M:SS. */
  function formatTime(totalSeconds) {
    const s = Math.max(0, Math.floor(totalSeconds));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, "0")}`;
  }

  /** Couleur stable par joueur (pour les marqueurs sur la carte). */
  const PALETTE = [
    "#4cc9f0", "#ef476f", "#06d6a0", "#ffd166", "#b388ff",
    "#ff7b00", "#00bbf9", "#f15bb5", "#9ef01a", "#fee440",
  ];
  function colorFor(index) {
    return PALETTE[index % PALETTE.length];
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  return { $, showScreen, formatDistance, formatTime, colorFor, escapeHtml };
})();
