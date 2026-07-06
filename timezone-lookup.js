/**
 * timezone-lookup.js
 *
 * Real timezone resolution via the TimeZoneDB API
 * (https://timezonedb.com/api). Returns the actual IANA zone name
 * (e.g. "Asia/Kolkata"), not a longitude-based guess.
 *
 * Requires a free API key from https://timezonedb.com/register.
 * The key is stored in chrome.storage.local via the options page,
 * not hardcoded here.
 *
 * Includes a small in-memory cache so we don't refire a network
 * request every poll tick for the same coordinates -- the free tier
 * has a request-per-second/day limit.
 */

(function (global) {
  const CACHE = new Map(); // "lat,lng" (rounded) -> result
  const CACHE_PRECISION = 2; // round to ~1km to dedupe near-identical fetches

  function cacheKey(lat, lng) {
    return `${lat.toFixed(CACHE_PRECISION)},${lng.toFixed(CACHE_PRECISION)}`;
  }

  function getApiKey() {
    return new Promise((resolve) => {
      chrome.storage.local.get(["timezonedbApiKey"], (result) => {
        resolve(result.timezonedbApiKey || null);
      });
    });
  }

  /**
   * Look up the real timezone for a lat/lng pair.
   * @returns {Promise<{ zoneName: string, gmtOffsetHours: number, source: "api"|"cache" } | { error: string }>}
   */
  async function lookupTimezone(lat, lng) {
    const key = cacheKey(lat, lng);
    if (CACHE.has(key)) {
      return { ...CACHE.get(key), source: "cache" };
    }

    const apiKey = await getApiKey();
    if (!apiKey) {
      return { error: "no_api_key" };
    }

    const url = `https://api.timezonedb.com/v2.1/get-time-zone?key=${encodeURIComponent(
      apiKey
    )}&format=json&by=position&lat=${lat}&lng=${lng}`;

    try {
      const res = await fetch(url);
      if (!res.ok) {
        return { error: `http_${res.status}` };
      }
      const data = await res.json();

      if (data.status !== "OK") {
        return { error: data.message || "api_error" };
      }

      const result = {
        zoneName: data.zoneName, // e.g. "Europe/Rome"
        gmtOffsetHours: data.gmtOffset / 3600,
        source: "api",
      };
      CACHE.set(key, result);
      return result;
    } catch (err) {
      return { error: "network_error" };
    }
  }

  global.TZLookup = {
    lookupTimezone,
  };
})(window);
