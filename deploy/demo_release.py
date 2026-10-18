#!/usr/bin/env python3
"""Pack a built Demo, or deploy its public GitHub Release asset with rollback."""
import argparse
import fcntl
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import re
import subprocess
import tarfile
import tempfile
import time
from urllib.request import Request, urlopen

REPOSITORY = "liqiyuan-152/waveform-analysis"
BASE = "/waveform-analysis/"


def read_url(url):
    request = Request(url, headers={"User-Agent": "waveform-demo-deploy"})
    with urlopen(request, timeout=30) as response:
        return response.read()


def stable_tag(value):
    if not re.fullmatch(r"v\d+\.\d+\.\d+", value):
        raise ValueError("Expected a stable vX.Y.Z tag")
    return value


def pack(source, output, tag, sha):
    stable_tag(tag)
    if not re.fullmatch(r"[0-9a-f]{40}", sha):
        raise ValueError("Expected a full commit SHA")
    index = (source / "index.html").read_text()
    if f'{BASE}assets/' not in index or '"/assets/' in index:
        raise ValueError("Build the Demo with DEMO_BASE_PATH=/waveform-analysis/")
    output.mkdir(parents=True, exist_ok=True)
    target = output / f"waveform-demo-{tag[1:]}.tar.gz"
    with tarfile.open(target, "w:gz") as archive:
        for path in sorted(source.rglob("*")):
            if path.is_symlink():
                raise ValueError("Demo output must not contain symlinks")
            if path.is_file() and path.name != "version.txt":
                archive.add(path, arcname=str(path.relative_to(source)), recursive=False)
        version = (sha + "\n").encode()
        info = tarfile.TarInfo("version.txt")
        info.size, info.mode = len(version), 0o644
        archive.addfile(info, io.BytesIO(version))
    digest = hashlib.sha256(target.read_bytes()).hexdigest()
    target.with_name(target.name + ".sha256").write_text(f"{digest}  {target.name}\n")
    print(f"Packed {target}: {digest}", flush=True)
    return target


def extract(archive_path, destination):
    with tarfile.open(archive_path, "r:gz") as archive:
        members = archive.getmembers()
        if sum(member.size for member in members) > 100 * 1024 * 1024:
            raise ValueError("Demo archive exceeds 100 MiB")
        names = set()
        for member in members:
            path = PurePosixPath(member.name)
            if (path.is_absolute() or ".." in path.parts or not path.parts
                    or not (member.isfile() or member.isdir()) or member.name in names):
                raise ValueError("Unsafe or duplicate Demo archive entry")
            names.add(member.name)
        # Extract regular files only, without trusting archive ownership or permissions.
        for member in members:
            target = destination / member.name
            if member.isdir():
                target.mkdir(parents=True, exist_ok=True)
            else:
                target.parent.mkdir(parents=True, exist_ok=True)
                with archive.extractfile(member) as source, target.open("xb") as output:
                    output.write(source.read())
                target.chmod(0o644)
    sha = (destination / "version.txt").read_text().strip()
    if not re.fullmatch(r"[0-9a-f]{40}", sha):
        raise ValueError("Archive has no valid version.txt")
    index = (destination / "index.html").read_text()
    if f"{BASE}assets/" not in index:
        raise ValueError("Archive uses the wrong Demo base path")
    for asset in re.findall(r'(?:src|href)="(/waveform-analysis/assets/[^"?#]+)', index):
        if not (destination / asset.removeprefix(BASE)).is_file():
            raise ValueError(f"Archive is missing {asset}")
    return sha


def switch(root, relative):
    pending = root / "current.next"
    pending.unlink(missing_ok=True)
    pending.symlink_to(relative)
    pending.replace(root / "current")


def healthy(url, sha):
    for attempt in range(6):
        try:
            if (read_url(url + "version.txt").decode().strip() == sha
                    and b"<html" in read_url(url)):
                return True
        except (OSError, ValueError):
            pass
        if attempt < 5:
            time.sleep(2)
    return False


def sync(root, health_url, tag=None, downloader="/usr/local/bin/gh-download"):
    endpoint = "tags/" + stable_tag(tag) if tag else "latest"
    release = json.loads(read_url(f"https://api.github.com/repos/{REPOSITORY}/releases/{endpoint}"))
    tag = stable_tag(release["tag_name"])
    if release.get("draft") or release.get("prerelease"):
        raise ValueError("Only public stable releases can be deployed")
    filename = f"waveform-demo-{tag[1:]}.tar.gz"
    asset = next((a for a in release["assets"] if a["name"] == filename), None)
    if asset is None:
        print(f"{tag} has no Demo asset yet; retaining the current deployment", flush=True)
        return
    url = f"https://github.com/{REPOSITORY}/releases/download/{tag}/{filename}"
    if asset["browser_download_url"] != url or not re.fullmatch(
            r"sha256:[0-9a-f]{64}", asset.get("digest") or ""):
        raise ValueError("GitHub API did not provide a trusted SHA256 digest")
    digest = asset["digest"].split(":")[1]
    relative = f"releases/{tag}-{digest[:12]}"
    current = root / "current"
    previous = os.readlink(current) if current.is_symlink() else None
    if previous == relative:
        print(f"Already deployed {tag}", flush=True)
        return
    with tempfile.TemporaryDirectory(prefix=".download-", dir=root) as work:
        work = Path(work)
        archive = work / filename
        subprocess.run([downloader, url, "-o", str(archive), "--sha256", digest], check=True)
        if hashlib.sha256(archive.read_bytes()).hexdigest() != digest:
            raise ValueError("Downloaded Demo digest mismatch")
        staging = work / "site"
        staging.mkdir(mode=0o755)
        sha = extract(archive, staging)
        destination = root / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        # An interrupted previous deployment may have left a complete release directory.
        if not destination.exists():
            staging.rename(destination)
        switch(root, relative)
        try:
            if not healthy(health_url, sha):
                raise RuntimeError("Demo version/HTML health check failed")
        except BaseException:
            if previous:
                switch(root, previous)
            else:
                current.unlink(missing_ok=True)
            raise
    print(f"Deployed {tag} at {sha}", flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    packing = commands.add_parser("pack")
    packing.add_argument("--source", type=Path, default=Path("dist-demo"))
    packing.add_argument("--output", type=Path, default=Path("release-assets"))
    packing.add_argument("--tag", required=True)
    packing.add_argument("--sha", required=True)
    syncing = commands.add_parser("sync")
    syncing.add_argument("--root", type=Path, default=Path("/srv/waveform-demo"))
    syncing.add_argument("--health-url", default="http://127.0.0.1:18089/current/")
    syncing.add_argument("--tag")
    args = parser.parse_args()
    if args.command == "pack":
        pack(args.source, args.output, args.tag, args.sha)
    else:
        args.root.mkdir(parents=True, exist_ok=True)
        with (args.root / ".deploy.lock").open("w") as lock:
            try:
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                print("A Demo deployment is already running", flush=True)
                return
            sync(args.root, args.health_url, args.tag)


if __name__ == "__main__":
    main()
