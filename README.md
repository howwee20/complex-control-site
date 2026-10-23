# Complex Control website

Public website for [mycomplexcontrol.com](https://mycomplexcontrol.com).

This repository contains one shared Complex Control interface for the public website and Raspberry Pi race-day controller. It does not publish the reader adapter, race-control API, local database, or Raspberry Pi services.

The canonical interface lives in `controller/`. Every push to `main` builds it in public preview mode for `mycomplexcontrol.com` and in API-connected mode for a signed controller capsule under `/field/`. The live trackside build connects to the physical reader and race-control backend on the Pi.

Race Control opens the connection screen at `/?view=connect`. It offers the controller over its Wi-Fi access point, an Ethernet router, or a direct laptop cable. Controllers open in a separate tab so connection help and website navigation remain available. Local controllers open the Race Hub by default; `/?view=profiles` opens their saved roster after operator sign-in.

The public preview stores demo profiles only in that browser. Real profiles are stored in the Pi database. An empty preview never means a controller's roster is gone.

### Updates travel with the phone

While the phone has internet, the connection screen caches the newest signed controller capsule (the same cache `/field-update.html` uses). Tapping **Open Race Control** opens the controller's receiver page in that tap. A receiver that reports protocol 2 runs controller software (backend 0.7.0+, howwee20/complex-control#7) that saves the capsule durably and installs it only while no race is running, then continues straight to Race Control. Older receivers belong to software that ended active races to update, so nothing is sent to them; they are simply opened.

Capsules now declare backend API `4`. Controllers older than 0.7.0 accept only API `3`, so they reject these capsules before taking any action. They receive new interfaces after their one-time system update.

Browser limits: the website tab must stay in the foreground until the controller page appears. A locked or closed phone cannot carry an update, and racing always continues on the installed version. A controller wired to an internet router downloads capsules itself between races.

`/field-update.html` remains the explicit way to update a controller and follows the same rules.

## Deployment

Pushing to `main` deploys the site through GitHub Pages. The custom domain is configured as `mycomplexcontrol.com`.
