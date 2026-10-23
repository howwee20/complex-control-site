# Complex Control website

Public website for [mycomplexcontrol.com](https://mycomplexcontrol.com).

This repository contains one shared Complex Control interface for the public website and Raspberry Pi race-day controller. It does not publish the reader adapter, race-control API, local database, or Raspberry Pi services.

The canonical interface lives in `controller/`. Every push to `main` builds it in public preview mode for `mycomplexcontrol.com` and in API-connected mode for a signed controller capsule under `/field/`. The live trackside build connects to the physical reader and race-control backend on the Pi.

Race Control opens the connection screen at `/?view=connect`. It provides direct links to the controller over its Wi-Fi or a shared Ethernet/local network, without initiating an update. Controller links open in a separate tab so connection help and website navigation remain available. Local controllers open the Race Hub by default; `/?view=profiles` opens their saved roster after operator sign-in.

The public preview stores demo profiles only in that browser. Real profiles are stored in the Pi database. These are separate stores and there is no cloud account or profile synchronization yet. Preview screens identify this distinction and do not offer physical tag scanning.

Automatic browser-carried updates are a separate follow-up: the current Pi update endpoints finish active races and restart the backend. Safe deferred installation must be implemented on the Pi before a normal connection is allowed to trigger an update. This navigation change deliberately sends no update request.

After one-time phone setup, the operator walks within range of the powered Pi, opens `/field-update.html`, and taps **Update Pi**. The foreground page downloads the newest capsule over cellular while the phone uses the Pi's remembered `ComplexControl` Wi-Fi for the local transfer. The Pi verifies the signature and compatibility before replacing only the frontend.

## Deployment

Pushing to `main` deploys the site through GitHub Pages. The custom domain is configured as `mycomplexcontrol.com`.
