(function (global) {
  let geoJson = null;
  let polygonIndex = null; // Map<offsetHours, Feature[]>
  let loadPromise = null;
 
  async function loadTimezoneData() {
    if (polygonIndex) return;
 
    const url = chrome.runtime.getURL("combined-now.json");
    const response = await fetch(url);
    geoJson = await response.json();
    polygonIndex = new Map();
 
    for (const feature of geoJson.features) {
      const tzid = feature.properties?.tzid;
      if (!tzid) continue;
 
      const offset = getCurrentOffsetHours(tzid);
 
      if (!polygonIndex.has(offset)) {
        polygonIndex.set(offset, []);
      }
      polygonIndex.get(offset).push(feature);
    }
  }
 
  function getCurrentOffsetHours(tzid) {
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: tzid,
        timeZoneName: "longOffset",
      }).formatToParts(new Date());
 
      const value = parts.find((p) => p.type === "timeZoneName")?.value;
      // e.g. "GMT+09:00" or "GMT-05:30"
      const match = value?.match(/GMT([+-])(\d{2})(?::(\d{2}))?/);
      if (!match) return 0;
 
      const sign = match[1] === "+" ? 1 : -1;
      const hours = Number(match[2]);
      const minutes = Number(match[3] ?? 0);
      return sign * (hours + minutes / 60);
    } catch (_) {
      return 0;
    }
  }
 
  /**
   * Returns all GeoJSON features whose current UTC offset matches the given
   * IANA zone name's current offset. Falls back to an empty array.
   *
   * @param {string} tzid  e.g. "Asia/Kolkata"
   * @returns {Promise<GeoJSON.Feature[]>}
   */
  async function getFeaturesForZone(tzid) {
    if (!loadPromise) {
      loadPromise = loadTimezoneData();
    }
    await loadPromise;
 
    const offset = getCurrentOffsetHours(tzid);
    return polygonIndex.get(offset) ?? [];
  }
 
  global.PolygonLoader = { getFeaturesForZone };
})(window);