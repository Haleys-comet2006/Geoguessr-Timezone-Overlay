const originalOpen = XMLHttpRequest.prototype.open;
const originalSend = XMLHttpRequest.prototype.send;

XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this._ggtzUrl = url;
    return originalOpen.call(this, method, url, ...rest);
};

XMLHttpRequest.prototype.send = function (body) {

    this.addEventListener("load", () => {

        try {

            if (this.status !== 200)
                return;

            const url = this._ggtzUrl || "";

            // ----------------------------
            // GetMetadata
            // ----------------------------
            if (url.includes("/GetMetadata")) {

                const json = JSON.parse(this.responseText);
                const coords = findCoords(json);

                if (coords) {

                    postCoords(coords);

                } 
                return;
            }

            // ----------------------------
            // SingleImageSearch
            // ----------------------------
            if (url.includes("/SingleImageSearch")) {

                const json = JSON.parse(this.responseText);
                const coords = findCoords(json);

                if (coords) {

                    postCoords(coords);

                } 
                return;
            }

        } catch (err) {

            console.error("[GGTZ]", err);

        }

    });

    return originalSend.call(this, body);
};

function postCoords(coords) {

    window.postMessage({
        type: "GG_COORDS",
        lat: coords.lat,
        lng: coords.lng
    }, "*");

}

function findCoords(node) {

    if (!node)
        return null;

    if (Array.isArray(node)) {

        // Look for [null, null, lat, lng]
        if (
            node.length >= 4 &&
            node[0] === null &&
            node[1] === null &&
            typeof node[2] === "number" &&
            typeof node[3] === "number" &&
            node[2] >= -90 &&
            node[2] <= 90 &&
            node[3] >= -180 &&
            node[3] <= 180
        ) {
            return {
                lat: node[2],
                lng: node[3]
            };
        }

        for (const child of node) {
            const found = findCoords(child);
            if (found) return found;
        }

    } else if (typeof node === "object") {

        for (const value of Object.values(node)) {
            const found = findCoords(value);
            if (found) return found;
        }

    }

    return null;
}
// ==============================
// Google Maps integration
// ==============================

window.__GGTZ_MAP = null;
window.__GGTZ_POLYGONS = [];

// Search the React fiber tree for the Google Maps instance
function findGoogleMap() {
    const container = document.querySelector(
        '[class*="guess-map_canvasContainer"]'
    );

    if (!container)
        return null;

    const fiberKey = Object.keys(container).find(k =>
        k.startsWith("__reactFiber$")
    );

    if (!fiberKey)
        return null;

    let fiber = container[fiberKey];

    while (fiber) {

        const props = fiber.memoizedProps;

        if (props) {

            for (const value of Object.values(props)) {

                if (
                    value &&
                    typeof value.getProjection === "function" &&
                    typeof value.getZoom === "function"
                ) {
                    return value;
                }

            }

        }

        fiber = fiber.return;
    }

    return null;
}

function waitForGoogleMap() {

    return new Promise(resolve => {

        const check = () => {

            if (!window.__GGTZ_MAP) {
                window.__GGTZ_MAP = findGoogleMap();
            }

            if (window.__GGTZ_MAP) {
                resolve(window.__GGTZ_MAP);
                return;
            }

            setTimeout(check, 100);

        };

        check();

    });

}

// ==========================================
// GeoJSON -> Google Maps paths
// ==========================================

function polygonToPaths(feature) {

    const { type, coordinates } = feature.geometry;

    if (type === "Polygon") {

        return coordinates.map(ring =>
            ring.map(([lng, lat]) => ({ lat, lng }))
        );

    }

    if (type === "MultiPolygon") {

        return coordinates.map(poly =>
            poly.map(ring =>
                ring.map(([lng, lat]) => ({ lat, lng }))
            )
        );

    }

    return [];

}

// ==========================================
// Drawing
// ==========================================

function clearPolygons() {

    for (const polygon of window.__GGTZ_POLYGONS) {
        polygon.setMap(null);
    }

    window.__GGTZ_POLYGONS = [];

}

async function drawPolygons(features) {

    const map = await waitForGoogleMap();

    clearPolygons();

    for (const feature of features) {

        const paths = polygonToPaths(feature);

        if (feature.geometry.type === "Polygon") {

            const polygon = new google.maps.Polygon({

                map,

                paths,

                strokeColor: "#ff0000",
                strokeOpacity: 1,
                strokeWeight: 2,

                fillColor: "#ff0000",
                fillOpacity: 0.25,

                clickable: false

            });

            window.__GGTZ_POLYGONS.push(polygon);

        }

        else if (feature.geometry.type === "MultiPolygon") {

            for (const poly of paths) {

                const polygon = new google.maps.Polygon({

                    map,

                    paths: poly,

                    strokeColor: "#ff0000",
                    strokeOpacity: 1,
                    strokeWeight: 2,

                    fillColor: "#ff0000",
                    fillOpacity: 0.25,

                    clickable: false

                });

                window.__GGTZ_POLYGONS.push(polygon);

            }

        }

    }

}

// ==========================================
// Listen for content.js
// ==========================================

window.addEventListener("message", event => {

    if (event.source !== window)
        return;

    switch (event.data.type) {

        case "GG_DRAW_ZONE":
            drawPolygons(event.data.features);
            break;

        case "GG_CLEAR_ZONE":
            clearPolygons();
            break;
    }

});