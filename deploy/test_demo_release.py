import hashlib
import io
import json
from pathlib import Path
import shutil
import tarfile
import tempfile
import unittest
from unittest.mock import patch

import demo_release as demo


class DemoReleaseTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.source = self.root / "source"
        (self.source / "assets").mkdir(parents=True)
        (self.source / "assets/app.js").write_text("console.log('demo')")
        (self.source / "index.html").write_text(
            '<html><script src="/waveform-analysis/assets/app.js"></script></html>')
        self.sha = "a" * 40
        self.archive = demo.pack(self.source, self.root / "output", "v0.3.0", self.sha)
        self.digest = hashlib.sha256(self.archive.read_bytes()).hexdigest()
        self.deployment = self.root / "deployment"
        (self.deployment / "releases/old").mkdir(parents=True)
        (self.deployment / "releases/old/version.txt").write_text("b" * 40)
        demo.switch(self.deployment, "releases/old")
        self.release = {
            "tag_name": "v0.3.0", "draft": False, "prerelease": False,
            "assets": [{
                "name": self.archive.name,
                "browser_download_url": (
                    f"https://github.com/{demo.REPOSITORY}/releases/download/v0.3.0/"
                    + self.archive.name),
                "digest": "sha256:" + self.digest,
            }],
        }

    def download(self, arguments, **_kwargs):
        self.assertEqual(arguments[-2:], ["--sha256", self.digest])
        shutil.copyfile(self.archive, arguments[arguments.index("-o") + 1])

    def test_pack_roundtrip_has_exact_sha_and_assets(self):
        destination = self.root / "unpacked"
        destination.mkdir()
        self.assertEqual(demo.extract(self.archive, destination), self.sha)
        self.assertEqual((destination / "assets/app.js").read_bytes(),
                         (self.source / "assets/app.js").read_bytes())
        self.assertIn(self.digest, self.archive.with_name(self.archive.name + ".sha256").read_text())

    def test_pack_rejects_wrong_base(self):
        (self.source / "index.html").write_text('<html><script src="/assets/app.js"></script>')
        with self.assertRaisesRegex(ValueError, "DEMO_BASE_PATH"):
            demo.pack(self.source, self.root / "bad", "v0.3.0", self.sha)

    def test_rejects_path_traversal_and_symlinks_before_extraction(self):
        for name, kind in [("../escape", tarfile.REGTYPE), ("assets/link", tarfile.SYMTYPE)]:
            with self.subTest(name=name):
                unsafe = self.root / "unsafe.tar.gz"
                with tarfile.open(unsafe, "w:gz") as archive:
                    member = tarfile.TarInfo(name)
                    member.type, member.linkname = kind, "/etc/passwd"
                    archive.addfile(member, io.BytesIO())
                with self.assertRaisesRegex(ValueError, "Unsafe"):
                    demo.extract(unsafe, self.root / "unsafe")
                self.assertFalse((self.root / "escape").exists())

    def test_success_switches_and_second_sync_skips_download(self):
        def health(_url, sha):
            self.assertEqual(sha, self.sha)
            self.assertEqual((self.deployment / "current/version.txt").read_text().strip(), sha)
            return True

        with patch.object(demo, "read_url", return_value=json.dumps(self.release).encode()), \
                patch.object(demo.subprocess, "run", side_effect=self.download) as download, \
                patch.object(demo, "healthy", side_effect=health):
            demo.sync(self.deployment, "http://localhost/")
            demo.sync(self.deployment, "http://localhost/")
            self.assertEqual(download.call_count, 1)
        self.assertTrue((self.deployment / "releases/old/version.txt").exists())

    def test_failed_health_rolls_back(self):
        with patch.object(demo, "read_url", return_value=json.dumps(self.release).encode()), \
                patch.object(demo.subprocess, "run", side_effect=self.download), \
                patch.object(demo, "healthy", return_value=False):
            with self.assertRaisesRegex(RuntimeError, "health check"):
                demo.sync(self.deployment, "http://localhost/")
        self.assertEqual((self.deployment / "current").readlink(), Path("releases/old"))

    def test_corrupt_download_retains_current(self):
        def corrupt(arguments, **_kwargs):
            Path(arguments[arguments.index("-o") + 1]).write_bytes(b"corrupt")

        with patch.object(demo, "read_url", return_value=json.dumps(self.release).encode()), \
                patch.object(demo.subprocess, "run", side_effect=corrupt):
            with self.assertRaisesRegex(ValueError, "digest mismatch"):
                demo.sync(self.deployment, "http://localhost/")
        self.assertEqual((self.deployment / "current").readlink(), Path("releases/old"))

    def test_absent_asset_retains_current(self):
        self.release["assets"] = []
        with patch.object(demo, "read_url", return_value=json.dumps(self.release).encode()), \
                patch.object(demo.subprocess, "run") as download:
            demo.sync(self.deployment, "http://localhost/")
            download.assert_not_called()
        self.assertEqual((self.deployment / "current").readlink(), Path("releases/old"))

    def test_missing_api_digest_is_not_trusted(self):
        self.release["assets"][0]["digest"] = None
        with patch.object(demo, "read_url", return_value=json.dumps(self.release).encode()):
            with self.assertRaisesRegex(ValueError, "trusted SHA256"):
                demo.sync(self.deployment, "http://localhost/")


if __name__ == "__main__":
    unittest.main()
