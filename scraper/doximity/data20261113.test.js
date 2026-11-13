import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { own, board } from './data20261108.js'

const capture = () => JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/placeholder-title-20261113.json.gz', import.meta.url))))
const parse = (fixture = capture()) => own(fixture.ownHTML, fixture.listing, fixture.api, fixture.capturedAt)

test('Doximity reconciles the current Greenhouse placeholder head title with bound Open Graph role metadata', () => {
  const result = parse()
  assert.equal(result.model.title, 'Senior Product Counsel')
  assert.equal(result.model.company_name, 'Doximity')
  assert.match(result.description, /Our Hiring Process/)
  assert.equal(result.publication.qualified, true)
})

test('Doximity rejects placeholder pages whose published Open Graph role identity conflicts', () => {
  for (const mutate of [
    html => html.replace('property="og:title" content="Senior Product Counsel"', 'property="og:title" content="Another Counsel"'),
    html => html.replace('property="og:url" content="https://job-boards.greenhouse.io/doximity/jobs/8187353"', 'property="og:url" content="https://job-boards.greenhouse.io/doximity/jobs/9999999"'),
    html => html.replace('property="og:description" content="San Francisco, CA "', 'property="og:description" content="Bengaluru, India"'),
    html => html.replace('<title>page_title</title>', '<title>Other employer careers</title>'),
  ]) {
    const fixture = capture(); fixture.ownHTML = mutate(fixture.ownHTML)
    assert.throws(() => parse(fixture), /(?:head|metadata|publisher|title)/)
  }
})

const boardHTML = () => gunzipSync(readFileSync(new URL('./fixtures/board-placeholder-20261113.html.gz', import.meta.url))).toString('utf8')

test('Doximity reconciles the current embedded board placeholder title with its exact publisher and route', () => {
  const result = board(boardHTML())
  assert.equal(result.nativeBoardTotal, 14)
  assert.equal(result.records.length, 14)
  assert.ok(result.records.every(row => row.absolute_url.startsWith('https://job-boards.greenhouse.io/doximity/jobs/')))
})

test('Doximity rejects placeholder board Open Graph publisher or route conflicts', () => {
  for (const html of [
    boardHTML().replace('property="og:title" content="Doximity"', 'property="og:title" content="Other Employer"'),
    boardHTML().replace('property="og:url" content="http://job-boards.greenhouse.io/embed/job_board?for=doximity"', 'property="og:url" content="https://job-boards.greenhouse.io/embed/job_board?for=other"'),
  ]) assert.throws(() => board(html), /(?:head|metadata|publisher|route)/)
})
