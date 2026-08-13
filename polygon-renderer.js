(function (global) {
  /**
   * Look up the timezone's polygon features and tell page.js to draw them.
   *
   * @param {string} tzid IANA zone name, e.g. "Europe/Rome"
   * @param {number|null} offsetOverride Optional UTC offset override
   */
  async function showZoneForTimezone(
    tzid,
    offsetOverride = null
  ) {
    if (!tzid && offsetOverride === null) return;

    let features;

    try {
      features =
        await global.PolygonLoader.getFeaturesForZone(
          tzid,
          offsetOverride
        );
    } catch (err) {
      console.error(
        "[GGTZ] Failed to load polygon features:",
        err
      );
      return;
    }

    if (!features.length) {
      console.warn(
        "[GGTZ] No polygons found for timezone:",
        tzid,
        "offset:",
        offsetOverride
      );
      return;
    }

    window.postMessage(
      {
        type: "GG_DRAW_ZONE",
        features,
      },
      "*"
    );
  }

  /** Remove all zone polygons from the minimap. */
  function clearZone() {
    window.postMessage(
      { type: "GG_CLEAR_ZONE" },
      "*"
    );
  }

  global.PolygonRenderer = {
    showZoneForTimezone,
    clearZone,
  };
})(window);