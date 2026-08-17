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
const CLIPPERTON_POLYGON = [
    [10.318071993713488, -109.24413626464006],
    [10.283302720542558, -109.24236885867133],
    [10.288340425898467, -109.19112808606226],
    [10.322936878880887, -109.18847146374198]
]
const ROCAS_POLYGON = [
    [-3.852382058510987, -33.83633998628977],
    [-3.8819427423242985, -33.83093587689467],
    [-3.883427696612271, -33.77167362091957],
    [-3.847172382326517, -33.78024895238133],
  ];
async function lookupTimezone(coords) {
    if (!coords) return null;

    const result = await window.TZLookup.lookupTimezone(coords.lat, coords.lng);

    if (result.error) {
        return result;
    }

    result.label = formatUTC(result.gmtOffsetHours);
    if (pointInPolygon(coords, CLIPPERTON_POLYGON)){
        result.zoneName = "Pacific/Pitcairn";
        result.gmtOffsetHours = -8;
        result.label = "UTC-8";
    }
    if (pointInPolygon(coords, ROCAS_POLYGON)){
        result.zoneName = "Atlantic/Fernando_de_Noronha";
        result.gmtOffsetHours = -2;
        result.label = "UTC-2";
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
            removeOverlay();
            PolygonRenderer.clearZone();
        }

        minimapWasVisible = minimapIsVisible;
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
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
    await PolygonRenderer.showZoneForTimezone(tz.zoneName, tz.gmtOffsetHours);
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