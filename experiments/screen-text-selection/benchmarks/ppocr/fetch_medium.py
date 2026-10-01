"""Fetch only the official PP-OCRv6 medium inference archives into /tmp/opencode."""

import hashlib
import tarfile
from urllib.request import urlopen

from run import BASE, MODELS, ROOT


MAX_ARCHIVE_BYTES = 256 * 1024 * 1024
NAMES = ("PP-OCRv6_medium_det", "PP-OCRv6_medium_rec")


def fetch(name):
    ROOT.mkdir(parents=True, exist_ok=True)
    archive = ROOT / f"{name}_infer.tar"
    if archive.exists():
        digest = hashlib.sha256(archive.read_bytes()).hexdigest()
        return archive, digest

    url = BASE + archive.name
    temporary = ROOT / f"{name}_infer.tar.part"
    digest = hashlib.sha256()
    written = 0
    with urlopen(url, timeout=60) as response:
        if not response.geturl().startswith(BASE):
            raise ValueError("Unexpected model download host or path")
        length = response.headers.get("Content-Length")
        if length is not None and int(length) > MAX_ARCHIVE_BYTES:
            raise ValueError("Model archive exceeds size limit")
        with temporary.open("wb") as output:
            while block := response.read(1024 * 1024):
                written += len(block)
                if written > MAX_ARCHIVE_BYTES:
                    raise ValueError("Model archive exceeds size limit")
                output.write(block)
                digest.update(block)
    temporary.replace(archive)
    return archive, digest.hexdigest()


def verify_members(archive, name):
    expected = f"{name}_infer"
    (ROOT / "models").mkdir(parents=True, exist_ok=True)
    if (ROOT / "models" / expected).is_dir():
        return
    with tarfile.open(archive) as bundle:
        members = bundle.getmembers()
        if not members or any(
            not (member.name == expected or member.name.startswith(expected + "/"))
            or not (member.isfile() or member.isdir())
            for member in members
        ):
            raise ValueError("Model archive has unexpected entries")
        bundle.extractall(ROOT / "models", filter="data")


def main():
    for name in NAMES:
        archive, digest = fetch(name)
        if digest != MODELS[name]:
            raise ValueError(f"Unexpected {name} archive checksum")
        verify_members(archive, name)
        print(f"{name} bytes={archive.stat().st_size} sha256={digest}")


if __name__ == "__main__":
    main()
