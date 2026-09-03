# Complex Control website

Public website for [mycomplexcontrol.com](https://mycomplexcontrol.com).

This repository contains the public, frontend-only preview of the Complex Control operator interface. It does not publish the reader adapter, race-control API, local database, or Raspberry Pi services.

The live trackside installation serves the real controller from the Pi and connects it to the physical reader and race-control backend. The canonical website and field UI both live in `controller/`. Jake must make production race-interface changes there. Every push to `main` builds that one source twice: a public preview for `mycomplexcontrol.com`, and an API-connected signed frontend capsule under `/field/` for the phone-carried updater. Root-level legacy preview files are not the production interface and are not deployed as the main site.

After one-time phone setup, Jake walks within range of the powered Pi, opens `/field-update.html`, and taps **Update Pi**. The foreground page downloads the newest capsule over cellular while the phone uses the Pi's remembered `ComplexControl` Wi-Fi for the local transfer. The Pi verifies the signature and compatibility before replacing only the frontend.

## Deployment

Pushing to `main` deploys the site through GitHub Pages. The custom domain is configured as `mycomplexcontrol.com`.
