# Complex Control website

Public website for [mycomplexcontrol.com](https://mycomplexcontrol.com).

This repository contains the public, frontend-only preview of the Complex Control operator interface. It does not publish the reader adapter, race-control API, local database, or Raspberry Pi services.

The live trackside installation serves the same interface from the Pi and connects it to the physical reader and race-control backend. The public preview never claims a reader connection and requires the trackside controller before an event can be created.

## Deployment

Pushing to `main` deploys the site through GitHub Pages. The custom domain is configured as `mycomplexcontrol.com`.
