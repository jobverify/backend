import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { gunzipSync } from 'node:zlib'
import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { qualifyEverstageClient } from './nativeClientProfiles20261107.js'

const fixture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-client-20261115.json.gz', import.meta.url))))

for (const kind of ['role', 'apply']) {
  const packet = fixture[kind]
  test(`Everstage accepts the current complete ${kind} client and its observed declaration context`, () => {
    assert.equal(qualifyEverstageClient(readNativeDocument(packet.html), packet.url, packet.body, kind), '2026-11-15')
  })

  for (const [label, mutate] of [
    ['another application dependency', html => html.replace('_app-906b68baa5ff46c1.js', '_app-e4ddd0e6f708a095.js')],
    ['an unobserved extra program', html => html.replace('</head>', '<script src="https://ats.us1.rippling.com/_next/static/chunks/unknown.js"></script></head>')],
    ['a duplicate program', html => html.replace('</head>', `<script src="${packet.url}"></script></head>`)],
  ]) test(`Everstage current ${kind} client rejects ${label}`, () => {
    assert.throws(() => qualifyEverstageClient(readNativeDocument(mutate(packet.html)), packet.url, packet.body, kind), /client.*(?:context|declaration)/i)
  })

  test(`Everstage current ${kind} client rejects changed executable bytes`, () => {
    assert.throws(() => qualifyEverstageClient(readNativeDocument(packet.html), packet.url, packet.body + '/* different */', kind), /executable client contract changed/)
  })
}
