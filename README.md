# Complex Control website

Public website for [mycomplexcontrol.com](https://mycomplexcontrol.com).

This repository contains the public, frontend-only preview of the Complex Control operator interface. It does not publish the reader adapter, race-control API, local database, or Raspberry Pi services.

The live trackside installation serves the real controller from the Pi and connects it to the physical reader and race-control backend. The canonical field UI lives in `controller/`. Jake must make production race-interface changes there. Approved changes are tested, built into a signed frontend-only capsule, and published under `/field/` for the phone-carried updater. Root-level preview files remain a browser-only product/demo surface and are never installed over the RFID backend.

Before a race, open `/field-update.html` with cellular Internet, allow the newest capsule to cache, join the Pi's `ComplexControl` Wi-Fi, and return to the page to install it. The Pi verifies the signature and compatibility before replacing only the frontend.

## Deployment

Pushing to `main` deploys the site through GitHub Pages. The custom domain is configured as `mycomplexcontrol.com`.
