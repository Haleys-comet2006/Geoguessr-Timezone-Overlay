# GeoGuessr Timezone Overlay

A browser extension that displays the current UTC offset and highlights all regions on the GeoGuessr minimap that currently share the same UTC offset as the Street View location.

Unlike similar tools, this extension correctly supports **30-minute** and **45-minute** time zones (Chatham Islands, South Australia, Northern Territory, Eucla, Myanmar, Cocos Keeling Islands, Nepal, India, Sri Lanka, Afghanistan, Iran, Newfoundland, Marquesas Islands), making it a more accurate learning and practice tool.

## Features

* Displays the current UTC offset of the Street View location.
* Draws all matching timezone regions directly on the GeoGuessr minimap.
* Correctly handles half-hour and quarter-hour offsets.
* Automatically follows Daylight Saving Time using the browser's timezone database.
* Uses **tzf-wasm** for fast, local coordinate-to-timezone lookups without requiring an external API.
* Lightweight and works automatically during gameplay.
* Includes support for custom timezone overrides when official timezone databases lag behind government changes or when a location is missing from the polygon dataset.

## How it works

The extension intercepts GeoGuessr's Street View metadata to determine the location of the current round.

It then:

1. Uses **tzf-wasm** to determine the IANA timezone corresponding to the location.
2. Uses the browser's timezone database to determine the current UTC offset for that timezone.
3. Looks up all timezone polygons with the same current UTC offset.
4. Draws those polygons directly on the in-game minimap.

The timezone lookup is performed locally using the timezone data bundled with the extension, so no external timezone API or API key is required.

Timezone boundaries are based on the excellent **timezone-boundary-builder** project.

## Timezone data

The extension uses two main timezone data sources:

### tzf-wasm

**tzf-wasm** is used to determine the IANA timezone for a given latitude and longitude.

https://github.com/ringsaturn/tzf-wasm

The timezone data is bundled with the extension, so coordinate lookups do not require an external API.

The currently bundled timezone data version can be seen in the browser console when the extension initializes.

### timezone-boundary-builder

Timezone polygons are derived from:

https://github.com/evansiroky/timezone-boundary-builder

The polygons are grouped by their current UTC offset and displayed on the GeoGuessr minimap.

This project would not be possible without their work.

## Installation

1. Clone or download this repository.
2. Open your browser's **Extensions** page.
3. Enable **Developer Mode**.
4. Select **Load unpacked** and choose the project folder.

The extension is now ready to use when playing GeoGuessr. No API key or additional configuration is required.

## Browser compatibility

The extension is built using the standard WebExtension API and should work in Chromium-based browsers such as:

* Google Chrome
* Microsoft Edge
* Brave
* Opera
* Vivaldi

Support for Firefox should require only minor changes.

## Updating timezone data

Timezone data occasionally changes due to government legislation.

The extension uses two separately maintained sources of timezone data:

* **tzf-wasm** — used for coordinate-to-timezone lookups.
* **timezone-boundary-builder** — used for timezone polygons.

If a new timezone change is not reflected correctly, check both projects for updated releases or timezone data.

The browser's own timezone database is used to determine the current UTC offset and Daylight Saving Time status. This data is updated through browser/Chromium updates.

## Notes

Because timezone rules occasionally change due to government legislation, there may be brief periods where recently announced changes are not yet reflected in one or more of the timezone databases used by the extension.

The extension includes a mechanism for custom overrides when necessary. For example, special handling is currently included for locations such as **Clipperton Island** and **Rocas Atoll** where the standard data does not fully match the timezone interpretation used by the extension.

## Disclaimer

This project is an independent fan-made tool and is not affiliated with or endorsed by GeoGuessr. Using this extension in ranked duels or tournaments will result in you having an unfair advantage over your opponent and constitutes cheating. Only use it to have fun in party mode or in single player to practice a specific country (I personally find it very useful for practicing Russia).
