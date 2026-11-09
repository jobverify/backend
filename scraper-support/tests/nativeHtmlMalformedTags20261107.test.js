import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import test from 'node:test'
import { normalizeNativeAttributeBoundaries, readNativeAttributeDocument } from '../utils/nativeHtmlAttributes.js'

const fixture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/nativeHtmlMalformedTags20261107/current-pages.json.gz', import.meta.url))))
const hash = value => createHash('sha256').update(value).digest('hex')
const original = url => {
  const packet = fixture.responses.find(row => row.url === url)
  assert.ok(packet)
  assert.equal(hash(packet.body), packet.bodySHA256)
  return packet.body
}
const anchors = html => readNativeAttributeDocument(html).nodes(node => node.tag === 'a').map(node => node.attrs.href)
const board = 'https://jobs.ashbyhq.com/actual-employer'
const other = 'https://jobs.ashbyhq.com/unqualified-employer'

test('four current corporate responses retain their exact original bytes and status', () => {
  assert.equal(fixture.responses.length, 4)
  for (const packet of fixture.responses) {
    assert.equal(packet.status, 200)
    assert.equal(Buffer.byteLength(packet.body), packet.bodyBytes)
    assert.equal(hash(packet.body), packet.bodySHA256)
  }
})

test('the actual Alma malformed SVG end tag does not reject its qualified head', () => {
  const html = original('https://helloalma.com/careers')
  assert.ok(html.includes('</g</g>'), 'The regression must retain the actual malformed footer')
  const doc = readNativeAttributeDocument(html)
  assert.deepEqual(doc.nodes(node => node.tag === 'title').map(node => node.raw), ['Careers at Alma: Help Expand Access to Mental Health Care — Alma'])
  assert.equal(anchors(html).length, 0, 'An inaccessible rendered role list does not become an invented handoff')
})

test('the actual Endeavour malformed video button does not discard nine real anchors to three native roles', () => {
  const html = original('https://endeavourgroupcareers.com.au/')
  assert.ok(html.includes('<button=""'))
  const links = anchors(html).filter(url => url?.startsWith('/job/'))
  assert.equal(links.length, 9)
  assert.deepEqual([...new Set(links.map(url => url.match(/-jid-(\d+)$/)?.[1]))], ['14643', '12928', '14642'])
  const doc = readNativeAttributeDocument(html), root = doc.nodes(node => node.tag === 'root')[0]
  const unqualified = []
  const walk = node => {
    if (node.nativeTagUnqualified) unqualified.push(node)
    for (const child of node.children) if (typeof child !== 'string') walk(child)
  }
  walk(root)
  assert.ok(unqualified.some(node => node.tag === 'button=""' && node.inert === true))
})

for (const name of ['a@foreign', 'a=foreign', 'a<foreign', 'meta"foreign', 'script?foreign', 'div\u0000foreign']) {
  test('unqualified whole spelling ' + JSON.stringify(name) + ' cannot publish its nested anchor', () => {
    const html = `<${name}><a href="${other}">Unqualified jobs</a></${name}><a href="${board}">Current jobs</a>`
    assert.deepEqual(anchors(html), [board])
    const normalized = normalizeNativeAttributeBoundaries(html)
    assert.ok(normalized.startsWith('<' + name + '>'), 'Do not shorten or relabel an unqualified tag')
  })
}

for (const name of ['div@foreign', 'div=foreign', 'div<foreign']) {
  test('an unqualified closing ' + name + ' cannot escape a known hidden ancestor', () => {
    const html = `<div hidden></${name}><a href="${other}">Hidden jobs</a></div><a href="${board}">Current jobs</a>`
    assert.deepEqual(anchors(html), [board])
  })
}

test('malformed tag-like bytes in raw programs and comments remain opaque original content', () => {
  const program = 'const sample="<a@foreign href=example>"; const closing="</g</g>";'
  const html = `<!-- <a@foreign href="${other}"> -->` + `<script>${program}</script><a href="${board}">Current jobs</a>`
  assert.deepEqual(anchors(html), [board])
  assert.equal(readNativeAttributeDocument(html).nodes(node => node.tag === 'script')[0].raw, program)
})

test('qualified duplicate identity metadata still rejects after an unrelated unqualified tag', () => {
  assert.throws(() => readNativeAttributeDocument('<span@foreign></span@foreign><meta name="description" NAME="robots" content="Jobs">'), /Duplicate native meta attribute/)
})

test('a non-ASCII Kelvin sign cannot turn an unqualified tag into a canonical link', () => {
  const html = `<lin\u212A rel="canonical" href="${other}"><a href="${other}">Unqualified jobs</a></lin\u212A><a href="${board}">Current jobs</a>`
  const document = readNativeAttributeDocument(html)
  assert.equal(document.nodes(node => node.tag === 'link').length, 0)
  assert.deepEqual(anchors(html), [board])
  assert.ok(normalizeNativeAttributeBoundaries(html).startsWith('<lin\u212A '))
})
