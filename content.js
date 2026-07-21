const STATE = {
  lastCoords: null, // { lat, lng }
  overlayEl: null,
  lastLookupKey: null,
  lastTimeZone: null,
};

/* ---------------------------------------------------------------------- */
/* 1. Coordinate retrieval                                                */
/* ---------------------------------------------------------------------- */
window.addEventListener("message", (event) => {
    if (event.source !== window) return;

    if (event.data?.type !== "GG_COORDS") return;

    STATE.lastCoords = {
        lat: event.data.lat,
        lng: event.data.lng
    };
    onNewCoords(STATE.lastCoords);
});
function setUpNetworkSniffing() {
  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("page.js");

  script.onload = () => {
    script.remove();
  };

  script.onerror = (e) => {
    console.error("[GGTZ] Failed to load page.js", e);
  };

  (document.head || document.documentElement).appendChild(script);
}
/* ---------------------------------------------------------------------- */
/* 2. Timezone resolution                                                 */
/* ---------------------------------------------------------------------- */
const EUCLA_POLYGON = [
    [-32.26375420270194, 125.50124915704511],
    [-32.59867234235907, 125.4712857398562],
    [-32.0024417738378, 129.02978491361884],
    [-31.359962223182993, 128.99764415952785],
    [-31.674508756845196, 125.48659376066715],
];
async function lookupTimezone(coords) {
    if (!coords) return null;

    const result = await window.TZLookup.lookupTimezone(coords.lat, coords.lng);

    if (result.error) {
        return result;
    }

    result.label = formatUTC(result.gmtOffsetHours);
    if (pointInPolygon(coords, EUCLA_POLYGON)) {

        result.zoneName = "Australia/Eucla";
        result.label = "UTC+8:45";

    }
    return result;
}
function formatUTC(hours) {
    if (!Number.isFinite(hours)) return "UTC ?";

    const sign = hours >= 0 ? "+" : "-";
    const abs = Math.abs(hours);

    const whole = Math.floor(abs);
    const fraction = abs - whole;

    const minutes = Math.round(fraction * 60);

    if (minutes === 0) {
        return `UTC${sign}${whole}`;
    }

    return `UTC${sign}${whole}:${minutes.toString().padStart(2, "0")}`;
}
function pointInPolygon(point, polygon) {
    const { lat, lng } = point;

    let inside = false;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {

        const yi = polygon[i][0];
        const xi = polygon[i][1];

        const yj = polygon[j][0];
        const xj = polygon[j][1];

        const intersect =
            ((yi > lat) !== (yj > lat)) &&
            (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi);

        if (intersect)
            inside = !inside;
    }

    return inside;
}
/* ---------------------------------------------------------------------- */
/* 3. Overlay rendering                                                   */
/* ---------------------------------------------------------------------- */

function ensureOverlay() {
  if (STATE.overlayEl) return STATE.overlayEl;

  const el = document.createElement("div");
  el.id = "ggtz-overlay";
  el.textContent = "Timezone: --";
  document.body.appendChild(el);
  STATE.overlayEl = el;
  return el;
}

function removeOverlay() {
  if (STATE.overlayEl) {
    STATE.overlayEl.remove();
    STATE.overlayEl = null;
  }
}

function updateOverlay(label) {
  const el = ensureOverlay();
  el.textContent = label ? `Timezone: ${label}` : "Timezone: searching for location data...";
}
function monitorMinimap() {
    let minimapWasVisible = !!document.querySelector(
        '[class*="guess-map_canvasContainer"]'
    );

    const observer = new MutationObserver(() => {
        const minimapIsVisible = !!document.querySelector(
            '[class*="guess-map_canvasContainer"]'
        );

        // Minimap disappeared → round ended
        if (minimapWasVisible && !minimapIsVisible) {
            console.log("[GGTZ] Minimap disappeared — clearing timezone data");

            removeOverlay();
            PolygonRenderer.clearZone();
        }

        minimapWasVisible = minimapIsVisible;
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    console.log("[GGTZ] Minimap monitor started");
}
/* ---------------------------------------------------------------------- */
/* Main loop                                                              */
/* ---------------------------------------------------------------------- */
async function onNewCoords(coords) {

    const key = `${coords.lat.toFixed(5)},${coords.lng.toFixed(5)}`;

    if (key === STATE.lastLookupKey) {
        return;
    }

    STATE.lastLookupKey = key;

    const tz = await lookupTimezone(coords);
    updateOverlay(tz.label);
    await PolygonRenderer.showZoneForTimezone(tz.zoneName);
}
setUpNetworkSniffing();
monitorMinimap();
window.addEventListener("message", event => {

    if (event.source !== window)
        return;

    if (event.data.type === "GG_REMOVE_OVERLAY") {
        removeOverlay();
    }

});