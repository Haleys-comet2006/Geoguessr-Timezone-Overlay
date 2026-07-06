# GeoGuessr Timezone Overlay

A browser extension that displays the current UTC offset and highlights all regions on the GeoGuessr minimap that currently share the same UTC offset as the Street View location.

Unlike similar tools, this extension correctly supports **30-minute** and **45-minute** time zones (Chatham Islands, South Australia, Northern Territory, Eucla, Myanmar, Cocos Keeling Islands, Nepal, India, Sri Lanka, Afghanistan, Iran, Newfoundland, Marquesas Islands), making it a more accurate learning and practice tool.

## Features

* Displays the current UTC offset of the Street View location.
* Draws all matching timezone regions directly on the GeoGuessr minimap.
* Correctly handles half-hour and quarter-hour offsets.
* Automatically follows Daylight Saving Time using the browser's timezone database.
* Lightweight and works automatically during gameplay.
* Includes support for custom timezone overrides when official timezone databases lag behind government changes.

## How it works

The extension intercepts GeoGuessr's Street View metadata to determine the location of the current round.

It then:

1. Determines the current UTC offset for that location.
2. Looks up all timezone polygons with the same current offset.
3. Draws those polygons directly on the in-game minimap.

Timezone boundaries are based on the excellent **timezone-boundary-builder** project.

## TimeZoneDB API

This extension requires a free API key from **TimeZoneDB** to determine the IANA time zone of each Street View location.

You can create a free account and obtain an API key at:

https://timezonedb.com/

The key is stored locally in your browser and is only used to query the TimeZoneDB API while the extension is running.
The free API key has a rate limit of one request per second, which is sufficient for Geoguessr.

## Installation

1. Clone or download this repository.
2. Open your browser's **Extensions** page.
3. Enable **Developer Mode**.
4. Select **Load unpacked** and choose the project folder.
5. Obtain a free API key from **TimeZoneDB**.
6. Open the extension's **Options** page and enter your API key.
7. Save the settings.

The extension is now ready to use when playing GeoGuessr.
## Browser compatibility

The extension is built using the standard WebExtension API and should work in Chromium-based browsers such as:

* Google Chrome
* Microsoft Edge
* Brave
* Opera
* Vivaldi

Support for Firefox should require only minor changes.

## Data source

Timezone polygons are derived from:

https://github.com/evansiroky/timezone-boundary-builder

This project would not be possible without their work.

## Notes

Because timezone rules occasionally change due to government legislation, there may be brief periods where recently announced changes are not yet reflected in the browser's timezone database or the polygon dataset. The extension includes a mechanism for custom overrides when necessary.

## Disclaimer

This project is an independent fan-made tool and is not affiliated with or endorsed by GeoGuessr. Using this extension in ranked duels or tournaments will result in you having an unfair advantage over your opponent and constitutes cheating. Only use it to have fun in party mode or in single player to practice a specific country (I personally find it very useful for practicing Russia)
