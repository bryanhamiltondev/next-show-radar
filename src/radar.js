/*!
 * next-show-radar - the geolocation-aware tour map
 * Vanilla JS. Leaflet is the one peer dependency (bring it in safely with
 * sri-lazy-loader). Respects prefers-reduced-motion. Zero dependencies.
 * https://github.com/bryanhamiltondev/next-show-radar
 * MIT licensed.
 */
(function () {
  "use strict";

  /*
   * Default tiles: Esri's keyless dark-gray canvas. This default is a
   * deliberate engineering decision, not a cosmetic one: CARTO's public
   * basemap CDN began gating keyless traffic in 2026, and a widget whose
   * default map silently breaks is a widget nobody can trust. Any provider
   * is one knob away via data-radar-tiles / options.tiles.
   */
  var DEFAULTS = {
    radius: 200,           /* miles - the nearby fit radius */
    fallbackZoom: 8,       /* zoom when zero pins are in radius */
    color: "#00d2ff",      /* pin color */
    tiles: "https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    attribution: 'Tiles &copy; <a href="https://www.esri.com">Esri</a>, HERE, Garmin, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, and the GIS user community',
    maxNativeZoom: 16      /* the default provider's native max; Leaflet upscales beyond */
  };

  var EARTH_RADIUS_MILES = 3958.8;
  var LEAFLET_WAIT_MS = 5000;
  var SINGLE_POINT_ZOOM = 11;

  var cachedCoords = null;
  var geoAsked = false;

  function getUserCoords() {
    return new Promise(function (resolve) {
      if (cachedCoords) { resolve(cachedCoords); return; }
      if (geoAsked || !navigator.geolocation) { resolve(null); return; }
      geoAsked = true;
      navigator.geolocation.getCurrentPosition(
        function (pos) {
          cachedCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          resolve(cachedCoords);
        },
        function () { resolve(null); },
        { timeout: 8000, maximumAge: 600000 }
      );
    });
  }

  function resetGeo() {
    cachedCoords = null;
    geoAsked = false;
  }

  function haversineMiles(a, b) {
    var rad = Math.PI / 180;
    var dLat = (b.lat - a.lat) * rad;
    var dLng = (b.lng - a.lng) * rad;
    var s = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(a.lat * rad) * Math.cos(b.lat * rad) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(s)));
  }

  function readKnobs(el, options) {
    var o = {};
    var k;
    for (k in DEFAULTS) { o[k] = DEFAULTS[k]; }
    if (options) {
      for (k in DEFAULTS) { if (options[k] !== undefined) { o[k] = options[k]; } }
    }
    var radius = el.getAttribute("data-radar-radius");
    var fallbackZoom = el.getAttribute("data-radar-fallback-zoom");
    var color = el.getAttribute("data-radar-color");
    var tiles = el.getAttribute("data-radar-tiles");
    var maxNativeZoom = el.getAttribute("data-radar-max-zoom");
    if (radius) { o.radius = parseFloat(radius) || o.radius; }
    if (fallbackZoom) { o.fallbackZoom = parseInt(fallbackZoom, 10) || o.fallbackZoom; }
    if (color) { o.color = color; }
    if (tiles) { o.tiles = tiles; }
    if (maxNativeZoom) { o.maxNativeZoom = parseInt(maxNativeZoom, 10) || o.maxNativeZoom; }
    return o;
  }

  function readPoints(el) {
    var raw = el.getAttribute("data-radar-points");
    if (!raw) { return []; }
    var pts;
    try { pts = JSON.parse(raw); } catch (e) { return []; }
    if (!Array.isArray(pts)) { return []; }
    return pts.filter(function (p) {
      return p && typeof p.lat === "number" && typeof p.lng === "number";
    });
  }

  function esc(value) {
    return String(value).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function popupHtml(p) {
    var html = "<strong>" + esc(p.title || "Show") + "</strong>";
    if (p.date) { html += "<br>" + esc(p.date); }
    if (p.venue) { html += "<br>" + esc(p.venue); }
    if (p.city) { html += (p.venue ? ", " : "<br>") + esc(p.city); }
    if (p.url) {
      html = '<a class="radar-popup-link" href="' + esc(p.url) + '" target="_blank" rel="noopener">' + html + "</a>";
    }
    return html;
  }

  function announce(el, msg) {
    var live = el.querySelector(".radar-live");
    if (!live) {
      live = document.createElement("p");
      live.className = "radar-live";
      live.setAttribute("role", "status");
      live.setAttribute("aria-live", "polite");
      el.appendChild(live);
    }
    live.textContent = msg;
  }

  function whenLeaflet(cb, fail, waited) {
    if (window.L) { cb(); return; }
    var w = (waited || 0) + 250;
    if (w > LEAFLET_WAIT_MS) { fail(); return; }
    setTimeout(function () { whenLeaflet(cb, fail, w); }, 250);
  }

  function render(el, options) {
    if (el.getAttribute("data-radar-ready")) { return; }
    el.setAttribute("data-radar-ready", "1");
    el.classList.add("radar");

    var knobs = readKnobs(el, options);
    var points = readPoints(el);
    var frame = document.createElement("div");
    frame.className = "radar-frame";
    el.insertBefore(frame, el.firstChild);
    announce(el, "Loading map...");

    whenLeaflet(
      function () { boot(el, frame, knobs, points); },
      function () { announce(el, "The map engine (Leaflet) did not load. Check that Leaflet CSS and JS are present."); }
    );
  }

  function fitPoints(map, points, motion) {
    if (points.length > 1) {
      var b = L.latLngBounds(points.map(function (p) { return [p.lat, p.lng]; }));
      map.fitBounds(b, Object.assign({ padding: [24, 24] }, motion));
    } else {
      map.setView([points[0].lat, points[0].lng], SINGLE_POINT_ZOOM, motion);
    }
  }

  function boot(el, frame, knobs, points) {
    var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var motion = { animate: !reduced };

    var map = L.map(frame, { scrollWheelZoom: false }).setView([25, 0], 2);
    L.tileLayer(knobs.tiles, {
      attribution: knobs.attribution,
      maxZoom: 18,
      maxNativeZoom: knobs.maxNativeZoom
    }).addTo(map);

    var pinIcon = L.divIcon({
      className: "radar-pin",
      html: '<span class="radar-pin-dot" style="background:' + esc(knobs.color) + '"></span>',
      iconSize: [18, 18],
      iconAnchor: [9, 9]
    });

    points.forEach(function (p) {
      L.marker([p.lat, p.lng], { icon: pinIcon })
        .bindPopup(popupHtml(p))
        .addTo(map);
    });

    if (!points.length) {
      announce(el, "No upcoming shows to map yet.");
      return;
    }

    getUserCoords().then(function (me) {
      if (!me) {
        fitPoints(map, points, motion);
        announce(el, "Location not available - showing all " + points.length + " shows.");
        return;
      }

      L.marker([me.lat, me.lng], {
        icon: L.divIcon({ className: "radar-you", html: '<span class="radar-you-dot"></span>', iconSize: [18, 18], iconAnchor: [9, 9] })
      }).addTo(map);

      var near = points.filter(function (p) { return haversineMiles(me, p) <= knobs.radius; });

      if (near.length) {
        var b = L.latLngBounds(near.map(function (p) { return [p.lat, p.lng]; }));
        b.extend([me.lat, me.lng]);
        map.fitBounds(b, Object.assign({ padding: [24, 24] }, motion));
        announce(el, near.length + (near.length === 1 ? " show" : " shows") + " within " + knobs.radius + " miles.");
      } else {
        map.setView([me.lat, me.lng], knobs.fallbackZoom, motion);
        announce(el, "No shows within " + knobs.radius + " miles - showing your area.");
      }
    });
  }

  function init(root, options) {
    var scope = root || document;
    if (scope.nodeType === 1 && scope.hasAttribute && scope.hasAttribute("data-radar")) {
      render(scope, options);
      return;
    }
    var nodes = scope.querySelectorAll("[data-radar]");
    for (var i = 0; i < nodes.length; i++) { render(nodes[i], options); }
  }

  var booted = false;
  function autoInit() {
    if (booted) { return; }
    booted = true;
    init();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoInit);
  } else {
    autoInit();
  }
  window.addEventListener("load", autoInit);

  window.NextShowRadar = { init: init, reset: resetGeo };
})();
