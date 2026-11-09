#!/usr/bin/env bash
set -euo pipefail

# This helper is run by GitHub Actions on Linux, never by local application startup.
[[ "$(uname -s)" == Linux && "$(uname -m)" == x86_64 ]] || {
  echo 'The portable rewrite runtime requires Linux x86_64.' >&2
  exit 1
}

rewrite_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
runtime_dir="$rewrite_root/.cache/description-rewriter-avx2"
source_revision='7fe450e19305b828c199d602c23a8337aaa1f03b'
runtime_tag='b11146'
runtime_profile='portable-avx2-v1'
configured_tag="$(node -p "require(process.argv[1]).runtimeTag" "$rewrite_root/rewriting/model.json")"
[[ "$configured_tag" == "$runtime_tag" ]] || {
  echo 'Update the portable runtime source pin when changing the model runtime tag.' >&2
  exit 1
}

case "${1:-}" in
  build)
    : "${RUNNER_TEMP:?The build must run in GitHub Actions}"
    source_dir="$rewrite_root/.cache/description-rewriter-source"
    [[ "$(git -C "$source_dir" rev-parse HEAD)" == "$source_revision" ]] || {
      echo 'Portable runtime source revision mismatch.' >&2
      exit 1
    }
    build_dir="$RUNNER_TEMP/description-runtime-avx2-build"
    cmake -S "$source_dir" -B "$build_dir" \
      -DCMAKE_BUILD_TYPE=RelWithDebInfo \
      -DCMAKE_C_COMPILER=gcc-13 -DCMAKE_CXX_COMPILER=g++-13 \
      -DCMAKE_C_FLAGS='-march=x86-64 -mtune=generic' \
      -DCMAKE_CXX_FLAGS='-march=x86-64 -mtune=generic' \
      -DBUILD_SHARED_LIBS=OFF -DGGML_BACKEND_DL=OFF \
      -DGGML_CPU=ON -DGGML_CPU_ALL_VARIANTS=OFF -DGGML_NATIVE=OFF \
      -DGGML_SSE42=ON -DGGML_AVX=ON -DGGML_AVX2=ON \
      -DGGML_FMA=ON -DGGML_F16C=ON -DGGML_BMI2=ON \
      -DGGML_AVX_VNNI=OFF -DGGML_AVX512=OFF \
      -DGGML_AVX512_VBMI=OFF -DGGML_AVX512_VNNI=OFF -DGGML_AVX512_BF16=OFF \
      -DGGML_AMX_TILE=OFF -DGGML_AMX_INT8=OFF -DGGML_AMX_BF16=OFF \
      -DGGML_LLAMAFILE=OFF -DGGML_BLAS=OFF \
      -DLLAMA_BUILD_TESTS=OFF -DLLAMA_BUILD_EXAMPLES=OFF -DLLAMA_BUILD_APP=OFF \
      -DLLAMA_BUILD_SERVER=ON -DLLAMA_OPENSSL=OFF \
      -DLLAMA_BUILD_NUMBER=11146 -DLLAMA_BUILD_COMMIT="$source_revision"
    cmake --build "$build_dir" --target llama-server --parallel 4
    mkdir -p "$runtime_dir"
    install -m 755 "$build_dir/bin/llama-server" "$runtime_dir/llama-server"
    cp "$build_dir/CMakeCache.txt" "$runtime_dir/CMakeCache.txt"
    (
      cd -- "$runtime_dir"
      sha256sum --binary llama-server > llama-server.sha256
    )
    node --input-type=module - "$runtime_dir" "$source_revision" "$runtime_profile" "$runtime_tag" <<'NODE'
import fs from 'node:fs';
import path from 'node:path';
const [directory, sourceRevision, profile, runtimeTag] = process.argv.slice(2);
const binarySha256 = fs.readFileSync(path.join(directory, 'llama-server.sha256'), 'utf8').split(/\s+/)[0];
fs.writeFileSync(path.join(directory, 'build-info.json'), JSON.stringify({
  profile, runtimeTag, sourceRevision, platform: 'linux', arch: 'x64',
  buildType: 'RelWithDebInfo', binarySha256,
}, null, 2) + '\n');
NODE
    ;;
  activate)
    : "${GITHUB_ENV:?Activation must run in GitHub Actions}"
    (
      cd -- "$runtime_dir"
      sha256sum --check --strict llama-server.sha256
    )
    read -r binary_sha _ < "$runtime_dir/llama-server.sha256"
    node --input-type=module - "$runtime_dir" "$source_revision" "$runtime_profile" "$runtime_tag" "$binary_sha" <<'NODE'
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const [directory, revision, profile, tag, binarySha256] = process.argv.slice(2);
assert.match(binarySha256, /^[a-f0-9]{64}$/);
const info = JSON.parse(fs.readFileSync(path.join(directory, 'build-info.json'), 'utf8'));
for (const [key, expected] of Object.entries({
  sourceRevision: revision, profile, runtimeTag: tag, platform: process.platform, arch: process.arch, binarySha256,
})) assert.equal(info[key], expected, `Portable runtime ${key} mismatch`);
const flags = new Set(fs.readFileSync('/proc/cpuinfo', 'utf8').match(/^flags\s*:\s*(.*)$/m)?.[1].split(/\s+/));
for (const flag of ['sse4_2', 'avx', 'avx2', 'fma', 'f16c', 'bmi2']) assert.ok(flags.has(flag), `CPU is missing ${flag}`);
console.log(JSON.stringify(info));
NODE
    # Artifact downloads do not retain the executable bit.
    chmod u+x "$runtime_dir/llama-server"
    "$runtime_dir/llama-server" --version
    {
      printf 'JOB_DESCRIPTION_REWRITE_BINARY=%s\n' "$runtime_dir/llama-server"
      printf 'JOB_DESCRIPTION_REWRITE_BINARY_SHA256=%s\n' "$binary_sha"
      printf 'JOB_DESCRIPTION_REWRITE_RUNTIME_PROFILE=%s\n' "$runtime_profile"
      printf 'JOB_DESCRIPTION_REWRITE_RUNTIME_SOURCE_REVISION=%s\n' "$source_revision"
    } >> "$GITHUB_ENV"
    ;;
  *)
    echo 'Usage: bash scripts/portableRewriteRuntime.sh build|activate' >&2
    exit 1
    ;;
esac
