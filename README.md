# Complex Control website

Public website for [mycomplexcontrol.com](https://mycomplexcontrol.com).

This repository contains the Complex Control public storefront and the source for the Raspberry Pi race-day interface. It does not publish the reader adapter, race-control API, local database, or Raspberry Pi services.

The root-level site is deployed at `mycomplexcontrol.com`. The live trackside installation serves the controller from the Pi and connects it to the physical reader and race-control backend. That field interface lives in `controller/`. Every push to `main` publishes the storefront and builds an API-connected signed controller capsule under `/field/` for the phone-carried updater.

After one-time phone setup, the operator walks within range of the powered Pi, opens `/field-update.html`, and taps **Update Pi**. The foreground page downloads the newest capsule over cellular while the phone uses the Pi's remembered `ComplexControl` Wi-Fi for the local transfer. The Pi verifies the signature and compatibility before replacing only the frontend.

## Deployment

Pushing to `main` deploys the site through GitHub Pages. The custom domain is configured as `mycomplexcontrol.com`.
