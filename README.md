# next-show-radar

![License](https://img.shields.io/badge/license-MIT-00d2ff?style=flat)
![Dependencies](https://img.shields.io/badge/dependencies-0-00d2ff?style=flat)
![Peer](https://img.shields.io/badge/peer-Leaflet%201.9-777BB4?style=flat)
![Size](https://img.shields.io/badge/radar.js-one%20file-777BB4?style=flat)

The geolocation-aware tour map from [The DJ Calendar](https://thedjcalendar.com),
extracted as a standalone, open-source widget. Give it a list of shows; it shows
the visitor the ones near them - and stays useful when they decline.

## What actually happens (the plain-English version)

When a page uses this widget, the browser itself pops up a small question near
the address bar:

> *"this-site.com wants to know your location. Allow / Block"*

That prompt is the whole game, and the widget is built around both answers:

**The visitor taps Allow.** The browser hands the page a latitude and
longitude. The radar draws a red "You are here" dot at that spot, measures the
real distance to every show pin, and zooms to fit the ones within 200 miles.
The caption under the map reads: *"4 shows within 200 miles."* The visitor
instantly knows the DJ is playing 20 minutes from them on June 6.

**The visitor taps Block.** The browser hands the page *nothing* - no
coordinates at all. This is where most map widgets fail: the code crashes, or
the map renders as a blank gray rectangle, or it just sits there. The radar
does none of that. It quietly falls back to the useful experience it always
had in it: every show pin on a global map, zoomed to fit, with the caption
*"Location not available - showing all 24 shows."*

That second case matters more than the first. A lot of people tap Block on
location prompts - they are right to be cautious. On most sites those visitors
get a broken or useless map. Here they get the same working map everyone else
does, minus only the personalization. **The map is never the hero. The shows
are - and no answer to the permission prompt ever breaks them.**

The [demo](demo/index.html) lets you see both experiences back to back: allow
the prompt once, then click "Reset location memory" and reload to be asked
again and block it.

## The design stance

Geolocation on most sites is a checkbox: a permission prompt bolted onto a map
that collapses when denied. The radar's stance is that **"no" is a first-class
answer.**

- **Grant** -> a red "You" marker, a fit over every show inside the radius, and
  a live announcement: "4 shows within 200 miles."
- **Zero pins in radius** -> centered on the visitor at the fallback zoom, so
  the map still shows *their* neighborhood.
- **Deny or unavailable** -> the full global view of every show, plus a calm
  announcement: "Location not available - showing all 24 shows."
- **Asked before, answered before** -> the widget caches the first result and
  never re-prompts. A visitor who said "no" once is never nagged again.

## Quick start

```html
<link rel="stylesheet" href="leaflet.css">
<link rel="stylesheet" href="src/radar.css">
<script src="src/radar.js" defer></script>

<div data-radar
     data-radar-points='[{"lat":40.759,"lng":-73.9845,"title":"Alan Walker","venue":"Marquee New York","city":"New York City, NY","date":"Jun 6","url":"https://..."}]'>
</div>
```

Dynamic markup? Call the manual API after insertion:

```js
NextShowRadar.init(container, { radius: 60, color: "#3fb950" });
```

## The data contract

One JSON array, injected into the page - server-rendered or set at runtime.
No fetch, no API keys, no backend contract beyond JSON:

```json
[
  {
    "lat": 40.759,
    "lng": -73.9845,
    "title": "Alan Walker",
    "venue": "Marquee New York",
    "city": "New York City, NY",
    "date": "Jun 6",
    "url": "https://example.com/tickets"
  }
]
```

Points without numeric `lat`/`lng` are silently omitted. An un-geocoded show
must never become a pin at 0,0 in the South Atlantic.

## Knobs

| Knob | data attribute | options key | Default |
|---|---|---|---|
| Nearby radius (miles) | `data-radar-radius` | `radius` | `200` |
| Fallback zoom (empty radius) | `data-radar-fallback-zoom` | `fallbackZoom` | `8` |
| Pin color | `data-radar-color` | `color` | `#00d2ff` |
| Tile URL template | `data-radar-tiles` | `tiles` | CARTO dark |

## Accessibility

The status caption is a real `role="status"` / `aria-live="polite"` region, and
it is visible - sighted users and screen readers get the same sentence, not a
hidden one-off transcript. Every outcome is announced: nearby count, empty
radius, denial, and no-data. `prefers-reduced-motion` turns off the pan/zoom
animations; the map simply arrives where it means to be.

## Race safety

The boot is guarded: a render flag prevents double-initialization, init retries
on `DOMContentLoaded` and `window.load`, and the engine polls briefly for the
Leaflet peer before rendering - and announces clearly if it never arrives.
The production version of this loader logic survived a real bug class -
duplicated library injection destroying an initialized map - which is
documented in its sibling repo,
[sri-lazy-loader](https://github.com/bryanhamiltondev/sri-lazy-loader).

## The pair

On The DJ Calendar, [sri-lazy-loader](https://github.com/bryanhamiltondev/sri-lazy-loader)
brings Leaflet in safely - one tag, SRI-verified, race-free - and
next-show-radar is the reason that loader needed to exist. Use them together,
or use this with any Leaflet you already trust.

## Requirements

- Leaflet 1.9+ as the one peer dependency (CSS + JS).
- Any browser from the last decade. No build step, no framework, no bundler.
- HTTPS or localhost: `navigator.geolocation` requires a secure context.

## Origin

Extracted from The DJ Calendar (https://thedjcalendar.com), where the radar
pattern centers the tour map on every visitor who opts in. Like everything
published under this account, it is a production-derived pattern: what ships
here is the idea, not the infrastructure.

## License

MIT
