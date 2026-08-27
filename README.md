# Complex Control website

Public website for [mycomplexcontrol.com](https://mycomplexcontrol.com).

This repository contains the public, frontend-only preview of the Complex Control operator interface. It does not publish the reader adapter, race-control API, local database, or Raspberry Pi services.

The live trackside installation serves the real controller from the Pi and connects it to the physical reader and race-control backend. The canonical website and field UI both live in `controller/`. Jake must make production race-interface changes there. Every push to `main` builds that one source twice: a public preview for `mycomplexcontrol.com`, and an API-connected signed frontend capsule under `/field/` for the phone-carried updater. Root-level legacy preview files are not the production interface and are not deployed as the main site.

Before a race, open `/field-update.html` with cellular Internet, allow the newest capsule to cache, join the Pi's `ComplexControl` Wi-Fi, and return to the page to install it. The Pi verifies the signature and compatibility before replacing only the frontend.

## Deployment

Pushing to `main` deploys the site through GitHub Pages. The custom domain is configured as `mycomplexcontrol.com`.
