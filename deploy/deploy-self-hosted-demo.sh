#!/usr/bin/env bash
set -euo pipefail

tag=${1:?tag is required}
sha=${2:?commit SHA is required}

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
cd "$script_dir/.."

[[ "$tag" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "Invalid release tag: $tag" >&2; exit 64; }
[[ "$sha" =~ ^[0-9a-f]{40}$ ]] || { echo "Invalid commit SHA" >&2; exit 64; }

project=waveform-analysis
release_image="${project}-demo:${tag}"
project_root="/srv/project-deployments/${project}"
artifact_dir=$(mktemp -d)
build_container=
release_container=
previous_release=

cleanup() {
  [ -z "$build_container" ] || docker rm -f "$build_container" >/dev/null 2>&1 || true
  [ -z "$release_container" ] || docker rm -f "$release_container" >/dev/null 2>&1 || true
  rm -rf "$artifact_dir"
}
trap cleanup EXIT

docker build --pull=false -f deploy/Dockerfile.demo -t "$release_image" .
build_container=$(docker create "$release_image")
docker cp "${build_container}:/app/dist-demo/." "$artifact_dir"
test -f "$artifact_dir/index.html"

release_container=$(docker create --volume "${project_root}:/project" alpine:3.20 sleep 600)
docker start "$release_container" >/dev/null
previous_release=$(docker exec "$release_container" sh -eu -c 'readlink current || true')

docker exec "$release_container" sh -eu -c "
  test ! -e '/project/releases/${tag}'
  test ! -e '/project/.staging/${tag}'
  mkdir -p '/project/.staging/${tag}'
"
docker cp "$artifact_dir/." "${release_container}:/project/.staging/${tag}/"
docker exec "$release_container" sh -eu -c "
  test -f '/project/.staging/${tag}/index.html'
  chown -R 991:986 '/project/.staging/${tag}'
  chmod -R a+rX '/project/.staging/${tag}'
  mv '/project/.staging/${tag}' '/project/releases/${tag}'
  printf '{\"sha\":\"%s\",\"deployedAt\":\"%s\"}\n' '${sha}' \"\$(date -u +%Y-%m-%dT%H:%M:%SZ)\" > '/project/releases/${tag}/metadata.json'
  ln -s 'releases/${tag}' '/project/current.next'
  mv -Tf '/project/current.next' '/project/current'
"

for _ in $(seq 1 30); do
  if curl --fail --silent --show-error --location --connect-timeout 10 --max-time 30 \
    'https://lqycustomsite.online/waveform-analysis/' \
    | grep -q '<title>D3 波形分析</title>'; then
    echo "Deployment succeeded: ${tag} (${sha})"
    exit 0
  fi
  sleep 2
done

if [ -n "$previous_release" ]; then
  docker exec "$release_container" sh -eu -c "
    test -d '/project/${previous_release}'
    ln -s '${previous_release}' '/project/current.next'
    mv -Tf '/project/current.next' '/project/current'
  "
fi
echo "Deployment health check failed; restored ${previous_release:-no previous release}" >&2
exit 1
