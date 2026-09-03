# Complex Control production UI rules

- `controller/` is the canonical interface source for both `mycomplexcontrol.com` and the Raspberry Pi. Home, Shop, racer profiles, and race-control changes belong there so the website preview and field capsule cannot drift apart.
- The Pages workflow builds `controller/` twice: public preview mode for the website and API-connected mode for the signed Raspberry Pi capsule. The Pi build uses the real RFID reader, race API, operator PIN, and race database.
- The root-level legacy HTML, CSS, JavaScript, and compiled assets are retained only as historical references. Do not edit them for production interface changes.
- Preserve `field-update.html`, `field-update.js`, `field-update-sw.js`, and `field-controller-link.js`. They carry signed controller capsules from an Internet-connected phone to the offline Pi.
- Before merging a production controller change, run the controller tests, TypeScript check, and production build. The Pages workflow repeats those checks and publishes a signed capsule.
- Do not commit or expose the capsule signing private key. The repository contains only the public verification key through the private controller repository.
- A push to `main` must publish the shared interface at the root and the same revision as a signed controller capsule under `/field/`. The operator should never need to locate deployment files or manually copy an interface onto the Pi.
