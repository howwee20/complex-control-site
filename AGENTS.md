# Complex Control production UI rules

- The root-level HTML, CSS, JavaScript, and assets are the public storefront served at `mycomplexcontrol.com`.
- `controller/` is the Raspberry Pi race-day interface. It is packaged as a signed field capsule and uses the real RFID reader, race API, operator PIN, and race database.
- Keep the public storefront and Pi controller separate. Never copy `controller/dist` over the Pages root.
- Public website and shop requests belong in the root-level site. Race-day controls and the interface shown by the Pi belong in `controller/`.
- Preserve `field-update.html`, `field-update.js`, `field-update-sw.js`, and `field-controller-link.js`. They carry signed controller capsules from an Internet-connected phone to the offline Pi.
- Before merging a production controller change, run the controller tests, TypeScript check, and production build. The Pages workflow repeats those checks and publishes a signed capsule.
- Do not commit or expose the capsule signing private key. The repository contains only the public verification key through the private controller repository.
- A push to `main` must publish the storefront at the root and a signed controller capsule under `/field/`. The operator should never need to locate deployment files or manually copy an interface onto the Pi.
