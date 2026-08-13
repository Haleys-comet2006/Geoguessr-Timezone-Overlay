(function (global) {
  let geoJson = null;
  let polygonIndex = null; // Map<offsetHours, Feature[]>
  let loadPromise = null;

  // Manually added polygon for Clipperton Island (UTC-8)
  const CLIPPERTON_POLYGON = [
    [10.318071993713488, -109.24413626464006],
    [10.283302720542558, -109.24236885867133],
    [10.288340425898467, -109.19112808606226],
    [10.322936878880887, -109.18847146374198],
  ];
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

    // --------------------------------------------------
    // Manual polygons
    // --------------------------------------------------

    const clippertonFeature = {
      type: "Feature",
      properties: {
        tzid: "Clipperton",
        manual: true,
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          CLIPPERTON_POLYGON.map(([lat, lng]) => [lng, lat]),
        ],
      },
    };

    if (!polygonIndex.has(-8)) {
      polygonIndex.set(-8, []);
    }

    polygonIndex.get(-8).push(clippertonFeature);
  }

  function getCurrentOffsetHours(tzid) {
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: tzid,
        timeZoneName: "longOffset",
      }).formatToParts(new Date());

      const value = parts.find(
        (p) => p.type === "timeZoneName"
      )?.value;

      // e.g. "GMT+09:00" or "GMT-05:30"
      const match = value?.match(
        /GMT([+-])(\d{2})(?::(\d{2}))?/
      );

      if (!match) return 0;

      const sign = match[1] === "+" ? 1 : -1;
      const hours = Number(match[2]);
      const minutes = Number(match[3] ?? 0);

      return sign * (hours + minutes / 60);
    } catch (_) {
      return 0;
    }
  }

  async function getFeaturesForZone(
    tzid,
    offsetOverride = null
  ) {
    if (!loadPromise) {
      loadPromise = loadTimezoneData();
    }

    await loadPromise;

    const offset =
      offsetOverride !== null
        ? offsetOverride
        : getCurrentOffsetHours(tzid);

    return polygonIndex.get(offset) ?? [];
  }

  global.PolygonLoader = {
    getFeaturesForZone,
  };
})(window);