(function (global) {
  let geoJson = null;
  let polygonIndex = null; // Map<offsetHours, Feature[]>
  let loadPromise = null;

  // --------------------------------------------------
  // Manual polygons
  // Coordinates are stored as [latitude, longitude]
  // --------------------------------------------------
  // Known inconsistency: Trindade Island is also grouped with UTC-3, but it is actually UTC-2.
  // The polygon for Trindade is not included here, as it currently does not have any panos.
  // It will be added in the future if any photospheres get uploaded from the island.
  // Clipperton Island (UTC-8)
  const CLIPPERTON_POLYGON = [
    [10.318071993713488, -109.24413626464006],
    [10.283302720542558, -109.24236885867133],
    [10.288340425898467, -109.19112808606226],
    [10.322936878880887, -109.18847146374198],
  ];

  // Rocas Atoll (UTC-2)
  const ROCAS_POLYGON = [
    [-3.852382058510987, -33.83633998628977],
    [-3.8819427423242985, -33.83093587689467],
    [-3.883427696612271, -33.77167362091957],
    [-3.847172382326517, -33.78024895238133],
  ];

  // A point known to be inside Rocas Atoll.
  // Used to find and remove the incorrectly classified polygon
  // from combined-now.json.
  const ROCAS_POINT = {
    lat: -3.862,
    lng: -33.805,
  };

  // --------------------------------------------------
  // GeoJSON helpers
  // --------------------------------------------------

  // GeoJSON coordinates are [longitude, latitude].
  function pointInRing(point, ring) {
    const { lat, lng } = point;
    let inside = false;

    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0];
      const yi = ring[i][1];

      const xj = ring[j][0];
      const yj = ring[j][1];

      const intersect =
        ((yi > lat) !== (yj > lat)) &&
        (
          lng <
          ((xj - xi) * (lat - yi)) /
            (yj - yi) +
            xi
        );

      if (intersect) {
        inside = !inside;
      }
    }

    return inside;
  }

  // Returns true if a point is inside a GeoJSON Polygon,
  // taking holes into account.
  function pointInPolygonGeometry(point, coordinates) {
    if (!coordinates?.length) return false;

    // Must be inside the outer ring.
    if (!pointInRing(point, coordinates[0])) {
      return false;
    }

    // Must not be inside any hole.
    for (let i = 1; i < coordinates.length; i++) {
      if (pointInRing(point, coordinates[i])) {
        return false;
      }
    }

    return true;
  }

  /**
   * Removes the polygon containing `point` from a feature.
   *
   * Returns:
   *   - a corrected copy of the feature
   *   - null if the whole feature was the Rocas polygon
   *   - the original feature if Rocas was not found
   */
  function removePolygonContainingPoint(feature, point) {
    const geometry = feature.geometry;

    if (!geometry) return feature;

    // Simple Polygon
    if (geometry.type === "Polygon") {
      if (
        pointInPolygonGeometry(
          point,
          geometry.coordinates
        )
      ) {
        // The entire feature is the Rocas polygon.
        return null;
      }

      return feature;
    }

    // MultiPolygon
    if (geometry.type === "MultiPolygon") {
      const polygonIndex = geometry.coordinates.findIndex(
        (polygon) =>
          pointInPolygonGeometry(point, polygon)
      );

      if (polygonIndex === -1) {
        return feature;
      }
      // Don't mutate the original GeoJSON.
      const correctedFeature = structuredClone(feature);

      correctedFeature.geometry.coordinates.splice(
        polygonIndex,
        1
      );

      // If Rocas was somehow the only polygon, discard it.
      if (
        correctedFeature.geometry.coordinates.length === 0
      ) {
        return null;
      }

      return correctedFeature;
    }

    return feature;
  }

  async function loadTimezoneData() {
    if (polygonIndex) return;

    const url = chrome.runtime.getURL("combined-now.json");
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `Failed to load timezone polygons: ${response.status}`
      );
    }

    geoJson = await response.json();
    polygonIndex = new Map();

    for (const feature of geoJson.features) {
      const tzid = feature.properties?.tzid;
      if (!tzid) continue;

      const offset = getCurrentOffsetHours(tzid);

      // Remove the incorrectly classified Rocas polygon before
      // adding the feature to its offset bucket.
      const correctedFeature =
        removePolygonContainingPoint(
          feature,
          ROCAS_POINT
        );

      // If the entire feature was Rocas, don't add it.
      if (!correctedFeature) {
        continue;
      }

      if (!polygonIndex.has(offset)) {
        polygonIndex.set(offset, []);
      }

      polygonIndex
        .get(offset)
        .push(correctedFeature);
    }

    // --------------------------------------------------
    // Add manual polygons
    // --------------------------------------------------

    // Clipperton Island (UTC-8)
    const clippertonFeature = {
      type: "Feature",
      properties: {
        tzid: "Clipperton",
        manual: true,
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          CLIPPERTON_POLYGON.map(
            ([lat, lng]) => [lng, lat]
          ),
        ],
      },
    };

    if (!polygonIndex.has(-8)) {
      polygonIndex.set(-8, []);
    }

    polygonIndex.get(-8).push(clippertonFeature);

    // Rocas Atoll (UTC-2)
    const rocasFeature = {
      type: "Feature",
      properties: {
        tzid: "America/Noronha",
        manual: true,
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          ROCAS_POLYGON.map(
            ([lat, lng]) => [lng, lat]
          ),
        ],
      },
    };

    if (!polygonIndex.has(-2)) {
      polygonIndex.set(-2, []);
    }

    polygonIndex.get(-2).push(rocasFeature);
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

      const match = value?.match(
        /GMT([+-])(\d{2})(?::(\d{2}))?/
      );

      if (!match) return 0;

      const sign = match[1] === "+" ? 1 : -1;
      const hours = Number(match[2]);
      const minutes = Number(match[3] ?? 0);

      return sign * (
        hours + minutes / 60
      );
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