import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import { parse } from 'acorn'
import { readEightfoldLocationScope } from '../apiPortal/eightfoldLocations.js'
import { createMicronTechnologyIndiaScraper, OFFICIAL_CAREERS_URL, buildListingApiUrl, buildDetailApiUrl } from '../../scraper/microntechnologyindia/script.js'

const fixture = name => JSON.parse(gunzipSync(readFileSync(new URL(
  `../../scraper/microntechnologyindia/native-captures/${name}.json.gz`, import.meta.url))))
const inventory = fixture('2026-11-03-location-inventory')
const pair = fixture('2026-11-03-gujarat-pair')

test('Micron all 316 captured location records accept explicit native regional/country pairs', () => {
  assert.equal(inventory.records.length, 316)
  assert.ok(inventory.reportedCounts.every(value => value === 316))
  assert.equal(inventory.records.filter(record => record.standardizedLocations.some(value => value.split(',').length === 2)).length, 65)
  for (const record of inventory.records) {
    const result = readEightfoldLocationScope(record)
    assert.equal(result.country, 'India')
    assert.equal(result.unresolved, false)
    assert.deepEqual(result.nativeLocations, record.locations)
    assert.deepEqual(result.standardizedLocations, record.standardizedLocations)
  }
})

test('Micron actual state-wide location is retained as a state-wide label', () => {
  assert.deepEqual(pair.listing.locations, ['Gujarat, India'])
  assert.deepEqual(pair.listing.standardizedLocations, ['GJ,IN'])
  const scope = readEightfoldLocationScope(pair.listing)
  assert.equal(scope.location, 'Gujarat, India')
  assert.deepEqual(scope.indiaLocations, ['Gujarat, India'])
})

for (const [name, locations, standardizedLocations] of [
  ['bare state', ['Gujarat'], ['GJ,IN']],
  ['bare city', ['Ahmedabad'], ['GJ,IN']],
  ['ambiguous US state label', ['Indianapolis, IN'], ['IN,US']],
  ['conflicting country', ['Gujarat, India'], ['GJ,US']],
  ['unknown country', ['Gujarat, India'], ['GJ,ZZ']],
  ['empty region', ['Gujarat, India'], [',IN']],
  ['empty country', ['Gujarat, India'], ['GJ,']],
]) test(`Micron two-component variant rejects ${name}`, () => {
  assert.throws(() => readEightfoldLocationScope({ locations, standardizedLocations }), error => error.incompleteScope === true)
})

test('Micron actual state-wide listing/detail pair survives strict native identity hydration', async () => {
  // This is a synthetic bounded one-record cohort, not a claim that the native
  // feed reported one role or that all 316 public job details were inspected.
  const ast = parse(readFileSync(new URL('./micronTechnologyIndiaScript.test.js', import.meta.url), 'utf8'), { sourceType: 'module', ecmaVersion: 'latest' })
  const declaration = ast.body.filter(node => node.type === 'VariableDeclaration')
    .flatMap(node => node.declarations).find(node => node.id.name === 'OFFICIAL_CAREERS_HTML')
  assert.equal(declaration.init.type, 'TemplateLiteral')
  assert.equal(declaration.init.expressions.length, 0)
  const official = declaration.init.quasis[0].value.cooked
  const requests = []
  const jobs = await createMicronTechnologyIndiaScraper().run({
    fetchText: async url => { requests.push(url); assert.equal(url, OFFICIAL_CAREERS_URL); return official },
    fetchJson: async url => {
      requests.push(url)
      if (url === buildListingApiUrl()) return { status: 200, error: null, data: { positions: [structuredClone(pair.listing)], count: 1 } }
      assert.equal(url, buildDetailApiUrl(pair.listing.id))
      return structuredClone(pair.detail)
    },
  })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, pair.listing.id)
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].location, 'Gujarat, India')
  assert.equal(jobs[0].jobDescription, pair.detail.data.jobDescription)
  assert.deepEqual(jobs[0].sourceNativeLocations, pair.listing.locations)
  assert.deepEqual(jobs[0].sourceStandardizedLocations, pair.listing.standardizedLocations)
  assert.equal(requests.length, 3)
})
