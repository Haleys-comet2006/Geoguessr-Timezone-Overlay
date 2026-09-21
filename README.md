# GeoGuessr Timezone Overlay

A browser extension that displays the current UTC offset and highlights all regions on the GeoGuessr minimap that currently share the same UTC offset as the Street View location.

Unlike similar tools, this extension supports **30-minute** and **45-minute** time zones, including locations such as the Chatham Islands, Lord Howe Island, South Australia, Northern Territory, Eucla, Myanmar, Cocos (Keeling) Islands, Nepal, India, Sri Lanka, Afghanistan, Iran, Newfoundland, and the Marquesas Islands.

This makes it useful as a learning and practice tool for understanding real-world time zones and UTC offsets.

## Features

* Displays the current UTC offset of the Street View location.
* Draws all matching timezone regions directly on the GeoGuessr minimap.
* Correctly handles half-hour and quarter-hour offsets.
* Automatically handles Daylight Saving Time according to the IANA timezone rules.
* Uses **tzf-wasm** for fast, local coordinate-to-timezone lookups without requiring an external API.
* Includes a bundled copy of **IANA timezone data** for calculating current UTC offsets independently of the browser's timezone database.
* Supports 30-minute and 45-minute UTC offsets.
* Works automatically during gameplay.
* Includes handling for locations that are missing from or incorrectly represented by the standard geographic timezone datasets.

## How it works

The extension intercepts GeoGuessr's Street View metadata to determine the location of the current round.

It then:

1. Uses **tzf-wasm** to determine the IANA timezone corresponding to the location.
2. Uses the bundled IANA timezone data to calculate the current UTC offset for that timezone, including applicable Daylight Saving Time rules.
3. Looks up all timezone polygons with the same current UTC offset.
4. Draws those polygons directly on the in-game minimap.

The timezone lookup and offset calculation are performed locally using data bundled with the extension. **No external timezone API or API key is required.**

Timezone boundaries are based on the excellent **timezone-boundary-builder** project.

## Timezone data

The extension uses several sources of timezone data, each for a different purpose.

### IANA tzdata

The extension bundles IANA timezone data and interprets its timezone rules directly.

This data is used to determine the current UTC offset for a timezone, including:

* Standard UTC offsets
* Daylight Saving Time
* 30-minute and 45-minute offsets
* DST transition dates and times
* Recent timezone rule changes

The bundled IANA data allows the extension to update its timezone rules independently of the browser's built-in timezone database.

IANA timezone data:

https://www.iana.org/time-zones

### tzf-wasm

**tzf-wasm** is used to determine the IANA timezone for a given latitude and longitude.

https://github.com/ringsaturn/tzf-wasm

The geographic lookup data is bundled with the extension, so coordinate lookups do not require an external API.

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

The extension is now ready to use when playing GeoGuessr.

No API key or additional configuration is required.

## Browser compatibility

The extension is built using the standard WebExtension API and should work in Chromium-based browsers such as:

* Google Chrome
* Microsoft Edge
* Brave
* Opera
* Vivaldi

Support for Firefox should require only minor changes.

## Updating timezone data

Timezone rules occasionally change due to government legislation or other changes to the official IANA timezone database.

The extension uses independently maintained data sources for different parts of the timezone system:

* **IANA tzdata** — used to calculate UTC offsets and Daylight Saving Time rules.
* **tzf-wasm** — used for coordinate-to-timezone lookups.
* **timezone-boundary-builder** — used for timezone polygons.

When a new IANA timezone database release becomes available, the bundled `tzdata` package can be updated without changing the timezone rule interpreter itself.

Likewise, updates to `tzf-wasm` or `timezone-boundary-builder` can be incorporated when their underlying geographic data is updated.

Keeping these sources up to date helps ensure that recently announced timezone changes are reflected correctly.

## Notes

Timezone data is complicated and occasionally changes due to government legislation. Different timezone datasets may also be updated at different times.

The extension therefore keeps **timezone rule calculation separate from geographic timezone lookup**. This allows updated IANA timezone rules to be used even when another component of the timezone data ecosystem has not yet caught up.

There are also a small number of geographic edge cases that are not represented correctly by the standard datasets used by the extension. The extension contains specific handling for locations such as **Clipperton Island** and **Rocas Atoll** where necessary.

These are geographic corrections rather than replacements for the general IANA timezone rules.

## Disclaimer

This project is an independent fan-made tool and is not affiliated with or endorsed by GeoGuessr.

Using this extension in ranked duels or tournaments will give you an unfair advantage over your opponent and constitutes cheating. Only use it for fun in party mode or in single-player games to practice specific countries and regions.

I personally find it particularly useful for practicing Russia.
