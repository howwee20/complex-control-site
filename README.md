# Complex Control website

Public website for [mycomplexcontrol.com](https://mycomplexcontrol.com).

This repository contains one shared Complex Control interface for the public website and Raspberry Pi race-day controller. It does not publish the reader adapter, race-control API, local database, or Raspberry Pi services.

The canonical interface lives in `controller/`. Every push to `main` builds it in public preview mode for `mycomplexcontrol.com` and in API-connected mode for a signed controller capsule under `/field/`. The live trackside build connects to the physical reader and race-control backend on the Pi.

After one-time phone setup, the operator walks within range of the powered Pi, opens `/field-update.html`, and taps **Update Pi**. The foreground page downloads the newest capsule over cellular while the phone uses the Pi's remembered `ComplexControl` Wi-Fi for the local transfer. The Pi verifies the signature and compatibility before replacing only the frontend.

## Deployment

Pushing to `main` deploys the site through GitHub Pages. The custom domain is configured as `mycomplexcontrol.com`.
