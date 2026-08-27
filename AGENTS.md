# Complex Control production UI rules

- `controller/` is the single canonical interface for both the public website preview and the Raspberry Pi. It is used with the real RFID reader, race API, operator PIN, and race database in field mode.
- Any request to change the race-day interface, the software Jake uses at the track, or the website shown by the Pi must be implemented in `controller/`. A root-level preview change alone does not satisfy that request.
- Root-level legacy HTML, CSS, and JavaScript are not the deployed main interface. Never make interface changes there; edit `controller/` so the website preview and signed Pi capsule stay identical.
- Preserve `field-update.html`, `field-update.js`, `field-update-sw.js`, and `field-controller-link.js`. They carry signed controller capsules from an Internet-connected phone to the offline Pi.
- Before merging a production controller change, run the controller tests, TypeScript check, and production build. The Pages workflow repeats those checks and publishes a signed capsule.
- Do not commit or expose the capsule signing private key. The repository contains only the public verification key through the private controller repository.
