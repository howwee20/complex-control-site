# Complex Control production UI rules

- `controller/` is the canonical interface shipped to the Raspberry Pi and used with the real RFID reader, race API, operator PIN, and race database.
- Any request to change the race-day interface, the software Jake uses at the track, or the website shown by the Pi must be implemented in `controller/`. A root-level preview change alone does not satisfy that request.
- Root-level HTML, CSS, and JavaScript are a browser-only public demo. Never copy them over the Pi controller or describe their localStorage simulation as live timing.
- Preserve `field-update.html`, `field-update.js`, `field-update-sw.js`, and `field-controller-link.js`. They carry signed controller capsules from an Internet-connected phone to the offline Pi.
- Before merging a production controller change, run the controller tests, TypeScript check, and production build. The Pages workflow repeats those checks and publishes a signed capsule.
- Do not commit or expose the capsule signing private key. The repository contains only the public verification key through the private controller repository.
