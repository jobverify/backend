FROM ubuntu:24.04
# Build time has network access for trusted dependencies only. Candidate input is
# never part of this context, any layer, or a cache. Runtime has no network.
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl fontconfig \
    && rm -rf /var/lib/apt/lists/*
COPY compiler.json /opt/compiler.json
RUN curl --fail --location --retry 3 --max-time 180 \
    https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%400.17.0/tectonic-0.17.0-x86_64-unknown-linux-musl.tar.gz -o /tmp/tectonic.tar.gz \
    && echo '8533d07f9ccbd7a65824b9e0459041bca34af1eb33daba48f59215593753a3b7  /tmp/tectonic.tar.gz' | sha256sum -c - \
    && tar -xzf /tmp/tectonic.tar.gz -C /usr/local/bin tectonic && rm /tmp/tectonic.tar.gz
ENV TECTONIC_CACHE_DIR=/opt/tectonic-cache HOME=/tmp TECTONIC_UNTRUSTED_MODE=1
RUN --mount=type=bind,source=warmup.tex,target=/opt/warmup.tex,readonly \
    set -eu; for size in 10 11 12; do \
      sed "s/11pt,a4paper/${size}pt,a4paper/" /opt/warmup.tex > /tmp/warmup.tex; \
      tectonic --untrusted --bundle https://relay.fullyjustified.net/default_bundle_v33.tar --outdir /tmp /tmp/warmup.tex >/dev/null 2>&1; \
    done; \
    grep -R -q -x '6ffe055852f8faf66c0acbe1a7fb27f87b869a90bad1204f3bf4d9683f597c7c' /opt/tectonic-cache/bundles/hashes; \
    rm -f /tmp/warmup.*; \
    chmod -R a+rX /opt/tectonic-cache
COPY compile.sh /usr/local/bin/compile-resume
RUN chmod 555 /usr/local/bin/compile-resume
USER 10001:10001
WORKDIR /work
ENTRYPOINT ["/usr/local/bin/compile-resume"]
