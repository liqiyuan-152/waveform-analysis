# Showcase Static Image

The Showcase release workflow builds this repository's Demo as an immutable
`linux/amd64` Nginx image. It only runs for a published stable GitHub Release
or an explicitly selected stable Release through `workflow_dispatch`; existing
tag-based Demo deployment and package publishing workflows remain separate.

The image serves the Demo at `/` and expects `SHOWCASE_ORIGIN` at runtime. The
production Compose stack supplies this as the HTTPS showcase hostname. Nginx
uses it only in `frame-ancestors`, so the Demo can be embedded by the showcase
but not by arbitrary origins. The `/health` endpoint is available for container
health checks.

The workflow produces one digest-pinned service entry for this component only.
It sends that structured manifest to the restricted SSH deployment account; it
cannot request a shell command, MySQL credentials, Beszel credentials, or
updates to another service.
