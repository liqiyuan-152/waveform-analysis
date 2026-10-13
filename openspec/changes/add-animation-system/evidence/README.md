# Evidence included in this commit

This directory commits the final acceptance reports, full production FPS/physical-memory data,
coverage summary, package size comparison and representative desktop/native Safari screenshots.
Historical logs, raw heap/native profiles and rejected experiment outputs remain in the local
workspace. `artifact-inventory.json` records their paths, sizes and hashes; `includedInCommit`
identifies the retained evidence. References in historical implementation records or
`verification.json` may point to these local-only artifacts.

The final source fingerprint and acceptance scope are in `final-acceptance-verification.json`.
The original memory and gzip goals were not achieved; the user authorized revised acceptance.
Native mobile verification was explicitly excluded. No release was performed.
