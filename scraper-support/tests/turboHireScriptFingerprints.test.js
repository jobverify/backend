import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import reviewedShell from '../../scraper/purplle/reviewedTurboHireShell.json' with { type: 'json' }
import { collectPurplleTurboHire, POST_URL, SHORT_URL, TINY_URL, BOARD_URL, ORIGIN as PURPLLE_ORIGIN } from '../../scraper/purplle/turboHire.js'
import { reviewed, surfaceAssets } from '../../scraper/ola/nativeContract.js'

const mapsURL = 'https://maps.googleapis.com/maps/api/js?key=synthetic-test-key&libraries=places'
const mapsFingerprint = 'sha256:d28cf2bd97ef6e19a9e8fbec7de7bd6eb9f022808c07667829c3fcdc50264d2a'
const fingerprint = /^sha256:[a-f0-9]{64}$/
const escapeAttribute = value => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;')
const scriptsHTML = urls => urls.map(url => `<script src="${escapeAttribute(url)}"></script>`).join('')

test('reviewed TurboHire snapshots retain fingerprints instead of raw Google API keys', () => {
  for (const [path, count] of [
    ['../../scraper/purplle/reviewedTurboHireShell.json', 1],
    ['../../scraper/ola/reviewedSurfaces.json', 3],
  ]) {
    const text = readFileSync(new URL(path, import.meta.url), 'utf8')
    assert.equal(/AIza[A-Za-z0-9_-]{35}/.test(text), false, `${path} contains a raw Google API key`)
    assert.equal((text.match(/sha256:[a-f0-9]{64}/g) || []).length, count)
  }
})

function purplleReplay(t, { src = mapsURL, attributes = 'async=""', hashed = true } = {}) {
  const original = structuredClone(reviewedShell)
  t.after(() => Object.assign(reviewedShell, original))
  reviewedShell.scripts = [{ src: hashed ? mapsFingerprint : mapsURL, async: '' }]
  reviewedShell.inlineSHA256 = []
  reviewedShell.styles = []
  const authorURL = 'https://www.linkedin.com/company/purplle-com'
  const post = `<html><head><script type="application/ld+json">${JSON.stringify({
    '@type': 'SocialMediaPosting', '@id': POST_URL,
    author: { '@type': 'Organization', name: 'Purplle.com', url: authorURL },
    datePublished: '2025-04-10T10:32:19.688Z',
    articleBody: `Our new Careers Page ${SHORT_URL} TurboHire`,
  })}</script></head><body><a data-tracking-control-name="public_post-text" href="https://www.linkedin.com/redir/redirect?url=${encodeURIComponent(SHORT_URL)}">Careers</a><a data-tracking-control-name="public_post_feed-actor-name" href="${authorURL}">Purplle.com</a></body></html>`
  const board = `<html><head><meta property="og:title" content="Purplle.com - Career Page"><meta property="og:site_name" content="Purplle.com"><meta property="og:description" content="Explore job opportunities at Purplle.com"><script src="${escapeAttribute(src)}" ${attributes}></script></head><body><div id="root"></div></body></html>`
  const stop = Error('Reached client download after validating the native shell')
  const packets = new Map([
    [POST_URL, { body: post }],
    [SHORT_URL, { body: `<a data-tracking-control-name="external_url_click" href="${TINY_URL}">Continue</a>` }],
    [TINY_URL, { body: 'Redirecting', status: 302, location: BOARD_URL }],
    [BOARD_URL, { body: board }],
  ])
  return {
    stop,
    run: () => collectPurplleTurboHire({
      now: '2026-11-06T07:00:00Z', signal: new AbortController().signal,
      retainedResponses: [], requestIntervalMs: 0,
      fetchImpl: async url => {
        if (url === PURPLLE_ORIGIN + '/runtime-main.a3801c5ec8c75a558b86.js') throw stop
        const packet = packets.get(url)
        assert.ok(packet, 'Unexpected request in synthetic replay')
        const response = new Response(packet.body, {
          status: packet.status || 200,
          headers: { 'content-type': 'text/html', ...(packet.location ? { location: packet.location } : {}) },
        })
        Object.defineProperty(response, 'url', { value: url })
        return response
      },
    }),
  }
}

for (const hashed of [true, false]) test(`Purplle accepts the exact ${hashed ? 'fingerprinted' : 'plain'} script reference`, async t => {
  const replay = purplleReplay(t, { hashed })
  await assert.rejects(replay.run(), error => error === replay.stop)
})

for (const [name, options] of [
  ['changed key', { src: mapsURL.replace('synthetic-test-key', 'different-test-key') }],
  ['changed query', { src: mapsURL + '&callback=unreviewed' }],
  ['literal fingerprint', { src: mapsFingerprint }],
  ['changed attributes', { attributes: 'async="" defer="defer"' }],
]) test(`Purplle rejects a fingerprinted script with ${name}`, async t => {
  await assert.rejects(purplleReplay(t, options).run(), /native public program declarations changed/)
})

function olaVersions(t) {
  const original = structuredClone({ surface: reviewed.surfaces.native, versions: reviewed.nativeClientVersions })
  t.after(() => {
    reviewed.surfaces.native = original.surface
    reviewed.nativeClientVersions = original.versions
  })
  const versions = [reviewed.surfaces.native, ...(reviewed.nativeClientVersions || [])]
  for (const version of versions) {
    version.externalScripts = version.externalScripts.map(url =>
      url.startsWith('https://maps.googleapis.com/maps/api/js?') || fingerprint.test(url) ? mapsFingerprint : url)
  }
  return versions.map(version => version.externalScripts.map(url => url === mapsFingerprint ? mapsURL : url))
}

const olaVersionCount = 1 + (reviewed.nativeClientVersions || []).length
for (let index = 0; index < olaVersionCount; index++) {
  test(`Ola accepts the fingerprinted Google Maps URL for native client version ${index + 1}`, t => {
    const urls = olaVersions(t)[index]
    assert.ok(surfaceAssets('ola', scriptsHTML(urls)).some(asset => asset.kind === 'js'))
  })
}

for (const [name, change] of [
  ['changed key', urls => urls.map(url => url === mapsURL ? url.replace('synthetic-test-key', 'different-test-key') : url)],
  ['changed host', urls => urls.map(url => url === mapsURL ? url.replace('maps.googleapis.com', 'unreviewed.invalid') : url)],
  ['changed query', urls => urls.map(url => url === mapsURL ? url + '&callback=unreviewed' : url)],
  ['literal fingerprint', urls => urls.map(url => url === mapsURL ? mapsFingerprint : url)],
  ['changed order', urls => [...urls].reverse()],
  ['missing script', urls => urls.slice(1)],
  ['additional script', urls => [...urls, 'https://unreviewed.invalid/script.js']],
]) test(`Ola rejects fingerprinted native declarations with ${name}`, t => {
  const urls = change(olaVersions(t)[0])
  assert.throws(() => surfaceAssets('ola', scriptsHTML(urls)), /native executable client changed or inert/)
})
