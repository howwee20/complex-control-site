#!/usr/bin/env python3
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import subprocess
import tarfile
from pathlib import Path

CAPSULE_FORMAT = "complex-control-frontend-v1"
BACKEND_API = "3"


def json_bytes(value: object) -> bytes:
    return json.dumps(value, separators=(",", ":"), sort_keys=True).encode("utf-8")


def add_bytes(archive: tarfile.TarFile, name: str, value: bytes, mtime: int) -> None:
    info = tarfile.TarInfo(name)
    info.size = len(value)
    info.mode = 0o644
    info.uid = 0
    info.gid = 0
    info.uname = "root"
    info.gname = "root"
    info.mtime = mtime
    archive.addfile(info, __import__("io").BytesIO(value))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dist", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--commit", required=True)
    parser.add_argument("--created-at", required=True)
    parser.add_argument("--source-epoch", type=int, required=True)
    parser.add_argument("--signing-key", type=Path, required=True)
    parser.add_argument("--base-url", default="https://mycomplexcontrol.com/field")
    args = parser.parse_args()

    if not (args.dist / "index.html").is_file():
        raise SystemExit("controller/dist/index.html is missing")
    short_commit = args.commit[:12]
    version = f"site-{short_commit}"
    release = {
        "format": CAPSULE_FORMAT,
        "version": version,
        "site_commit": args.commit,
        "backend_api": BACKEND_API,
        "created_at": args.created_at,
    }
    (args.dist / "field-release.json").write_bytes(json_bytes(release))

    files: dict[str, str] = {}
    for path in sorted(item for item in args.dist.rglob("*") if item.is_file()):
        name = f"dist/{path.relative_to(args.dist).as_posix()}"
        files[name] = hashlib.sha256(path.read_bytes()).hexdigest()
    manifest = {**release, "files": files}
    manifest_data = json_bytes(manifest)

    args.output.mkdir(parents=True, exist_ok=True)
    filename = f"complex-control-frontend-{short_commit}.tgz"
    capsule = args.output / filename
    with capsule.open("wb") as raw:
        with gzip.GzipFile(fileobj=raw, mode="wb", mtime=args.source_epoch) as compressed:
            with tarfile.open(fileobj=compressed, mode="w") as archive:
                add_bytes(archive, "manifest.json", manifest_data, args.source_epoch)
                for path in sorted(item for item in args.dist.rglob("*") if item.is_file()):
                    name = f"dist/{path.relative_to(args.dist).as_posix()}"
                    add_bytes(archive, name, path.read_bytes(), args.source_epoch)

    signature = args.output / f"{filename}.sig"
    subprocess.run(
        [
            "openssl",
            "pkeyutl",
            "-sign",
            "-inkey",
            str(args.signing_key),
            "-rawin",
            "-in",
            str(capsule),
            "-out",
            str(signature),
        ],
        check=True,
    )
    digest = hashlib.sha256(capsule.read_bytes()).hexdigest()
    latest = {
        **release,
        "filename": filename,
        "capsule_url": f"{args.base_url.rstrip('/')}/{filename}",
        "signature_url": f"{args.base_url.rstrip('/')}/{filename}.sig",
        "sha256": digest,
        "bytes": capsule.stat().st_size,
    }
    (args.output / "latest.json").write_bytes(json_bytes(latest))
    print(json.dumps(latest, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
