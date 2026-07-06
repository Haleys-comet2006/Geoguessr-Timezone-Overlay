(function (global) {
  /**
   * Look up the timezone's polygon features and tell page.js to draw them.
   *
   * @param {string} tzid  IANA zone name, e.g. "Europe/Rome"
   */
  async function showZoneForTimezone(tzid) {
    if (!tzid) return;
 
    let features;
    try {
      features = await global.PolygonLoader.getFeaturesForZone(tzid);
    } catch (err) {
      console.error("[GGTZ] Failed to load polygon features:", err);
      return;
    }
 
    if (!features.length) {
      console.warn("[GGTZ] No polygons found for timezone:", tzid);
      return;
    }
 
    window.postMessage(
      { type: "GG_DRAW_ZONE", features },
      "*"
    );
  }
 
  /** Remove all zone polygons from the minimap. */
  function clearZone() {
    window.postMessage({ type: "GG_CLEAR_ZONE" }, "*");
  }
 
  global.PolygonRenderer = { showZoneForTimezone, clearZone };
})(window);