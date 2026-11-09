import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import test from 'node:test'
import { readNativeAttributeDocument as readNativeDocument } from '../utils/nativeHtmlAttributes.js'
import { discoverOfficialAtsBoards } from '../utils/officialAtsDiscovery.js'

const fixture = new URL('./fixtures/nativeHtmlAttributeBoundaries/', import.meta.url)
const receipt = JSON.parse(fs.readFileSync(new URL('manifest.json', fixture), 'utf8'))
const body = gunzipSync(fs.readFileSync(new URL(receipt.filename, fixture)))
assert.equal(createHash('sha256').update(body).digest('hex'), receipt.bodySHA256)
const html = body.toString('utf8')
const board = 'https://jobs.ashbyhq.com/actual-board'
const malformedLogo = '<a href="https://employer.test" class="logo aria-label="Employer Logo"><img alt="Logo"></a>'
const links = value => readNativeDocument(value).nodes(node => node.tag === 'a').map(node => node.attrs.href)

test('a malformed quoted logo cannot swallow the real Censys published native job list', () => {
  const nativeLinks = links(html).filter(url => /^https:\/\/job-boards\.greenhouse\.io\/censys\/jobs\/\d+$/.test(url || ''))
  assert.equal(nativeLinks.length, 26)
  assert.equal(new Set(nativeLinks).size, 26)
  assert.ok(nativeLinks.includes('https://job-boards.greenhouse.io/censys/jobs/8684280002'))
})

test('the real current Censys page establishes its advertised Greenhouse binding despite malformed logo attributes', async () => {
  const discovery = await discoverOfficialAtsBoards({ source: 'censys', companyName: 'Censys', companyDomain: 'censys.com',
    companyCareerPage: receipt.requestedURL }, { fetchPage: async url => {
      assert.equal(url, receipt.requestedURL)
      return { status: receipt.status, url: receipt.finalURL, html }
    } })
  assert.deepEqual(discovery.boards.map(row => [row.atsPlatform, row.boardToken]), [['greenhouse', 'censys']])
  assert.equal(discovery.boards[0].bindingEvidence.verified, true)
})

test('quotes inside malformed attribute names do not consume unrelated later tags', () => {
  const doc = readNativeDocument(malformedLogo + '<a href="' + board + '">Open jobs</a>')
  assert.deepEqual(doc.nodes(node => node.tag === 'a').map(node => node.attrs.href), ['https://employer.test', board])
  const logo = doc.nodes(node => node.tag === 'a')[0]
  assert.equal(logo.attrs.class, 'logo aria-label=')
  assert.equal(logo.attrs['aria-label'], undefined)
})

for (const tail of ['"junk', "'junk", '`junk', '=junk', '<junk', '\u00a0junk']) {
  test('unquoted attribute values preserve literal invalid URL suffix ' + JSON.stringify(tail), () => {
    const doc = readNativeDocument('<a href=' + board + tail + '>Open jobs</a>')
    const anchor = doc.nodes(node => node.tag === 'a')[0]
    assert.equal(anchor?.attrs.href, board + tail)
  })
}

test('an unterminated quoted value cannot activate embedded job links or manufacture visible description text', () => {
  const doc = readNativeDocument('<div>Visible prefix</div><a title="Unterminated><a href=' + board + '>Hidden jobs</a>')
  assert.deepEqual(doc.nodes(node => node.tag === 'a'), [])
  assert.equal(doc.text(doc.nodes(node => node.tag === 'root')[0]), 'Visible prefix')
})

test('quoted angle brackets and tag-like strings remain attribute data', () => {
  const doc = readNativeDocument('<div data-example="<a href=\'' + board + '\'>Example</a>">Text</div>')
  assert.equal(doc.nodes(node => node.tag === 'a').length, 0)
  assert.equal(doc.nodes(node => node.tag === 'div')[0].attrs['data-example'], "<a href='" + board + "'>Example</a>")
})

test('malformed presentation attributes cannot escape real hidden and template ancestors', () => {
  for (const wrapper of ['div hidden', 'div inert', 'template']) {
    const tag = wrapper.split(' ')[0]
    assert.deepEqual(links('<' + wrapper + '>' + malformedLogo + '<a href="' + board + '">Open jobs</a></' + tag + '>'), [])
  }
})

test('duplicate native identity metadata is still rejected while ordinary attributes retain their first value', () => {
  assert.throws(() => readNativeDocument('<meta name="description" NAME="robots" content="Jobs">'), /Duplicate native meta attribute/)
  const doc = readNativeDocument('<a href="' + board + '" href="https://jobs.ashbyhq.com/unrelated">Open jobs</a>')
  assert.equal(doc.nodes(node => node.tag === 'a')[0].attrs.href, board)
})
