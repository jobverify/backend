#!/bin/sh
set -eu
# Fixed wrapper; untrusted document bytes are only stdin, never shell code.
umask 077
# Tectonic may lock its dependency cache even on a cache hit. Each compile gets
# its own disposable copy; candidate input can never alter the trusted image.
if ! cp -R /opt/tectonic-cache /tmp/tectonic-cache 2>/dev/null; then
    printf '%s\n' 'RESUME_COMPILER_RESOURCE_LIMIT' >&2
    exit 1
fi
export TECTONIC_CACHE_DIR=/tmp/tectonic-cache
# The trusted LaTeX format is about 24 MB. Apply the untrusted output limit
# after copying dependencies, otherwise every compile fails during cache setup.
ulimit -f 10240
cat > /work/resume.tex
if ! tectonic "$@" --bundle https://relay.fullyjustified.net/default_bundle_v33.tar --outdir /work /work/resume.tex > /tmp/compiler.log 2>&1; then
    # Inspect diagnostics only inside the disposable container. Never send the
    # log (which can quote candidate text) to stdout, stderr, caches or artifacts.
    if grep -Eiq 'not found|not cached|could not find|cannot find|failed to find' /tmp/compiler.log; then
        printf '%s\n' 'RESUME_COMPILER_DEPENDENCY_MISSING' >&2
    else
        printf '%s\n' 'RESUME_COMPILER_FAILED' >&2
    fi
    exit 1
fi
cat /work/resume.pdf
