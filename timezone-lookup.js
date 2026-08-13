(function (global) {
const CACHE = new Map();
const CACHE_PRECISION = 2;

let finderPromise = null;

function cacheKey(lat, lng) {
return `${lat.toFixed(CACHE_PRECISION)},${lng.toFixed(CACHE_PRECISION)}`;
}

/**

* Load tzf-wasm once and reuse one WasmFinder instance.
  */
  async function getFinder() {
  if (!finderPromise) {
  finderPromise = (async () => {
  const moduleUrl = chrome.runtime.getURL(
  "vendor/tzf-wasm/tzf_wasm.js"
  );

  const { default: init, WasmFinder } = await import(moduleUrl);

  // Automatically loads tzf_wasm_bg.wasm from the same folder.
  await init();

  const finder = new WasmFinder();
  return finder;
  })();
  }

return finderPromise;

}

/**

* Get the current UTC offset for an IANA timezone.
*
* Examples:
* Asia/Tokyo       -> 9
* Asia/Kolkata     -> 5.5
* Australia/Eucla  -> 8.75
* America/Coyhaique -> -3
  */
function getCurrentOffsetHours(zoneName) {
  const now = new Date();

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zoneName,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);

  const values = {};

  for (const part of parts) {
    if (part.type !== "literal") {
      values[part.type] = Number(part.value);
    }
  }

  const utcEquivalent = Date.UTC(
    values.year,
    values.month - 1,
    values.day,
    values.hour,
    values.minute,
    values.second
  );

  return Math.round(
  ((utcEquivalent - now.getTime()) / 3_600_000) * 60) / 60;
}

/**

* Look up the timezone for a latitude/longitude pair.
*
* The public interface remains compatible with the old TimeZoneDB version.
  */
  async function lookupTimezone(lat, lng) {
  const key = cacheKey(lat, lng);


if (CACHE.has(key)) {
  return {
    ...CACHE.get(key),
    source: "cache",
  };
}

try {
  const finder = await getFinder();

  // IMPORTANT: tzf-wasm uses longitude first, latitude second.
  const zoneName = finder.get_tz_name(lng, lat);

  if (!zoneName) {
    console.warn(
      "[GGTZ] tzf-wasm found no timezone:",
      lat,
      lng
    );

    return { error: "timezone_not_found" };
  }

  const result = {
    zoneName,
    gmtOffsetHours: getCurrentOffsetHours(zoneName),
    source: "tzf",
  };

  CACHE.set(key, result);
  return result;

} catch (err) {
  console.error("[GGTZ] tzf-wasm lookup failed");
}
}
global.TZLookup = {
lookupTimezone,
};
})(window);
