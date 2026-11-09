import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
import test from 'node:test'
import { run } from './script.js'
import { createPhenomScraper } from '../../scraper-support/phenom/engine.js'

const fixture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/localized-country-20261031.json.gz', import.meta.url))))
for (const p of fixture.packets) assert.equal(createHash('sha256').update(p.body).digest('hex'), p.sha256)
const packet = id => fixture.packets.find(p => String(p.reqId) === id)
const controlledRun = async (id, { execute = run, alter = value => value } = {}) => {
  const p = packet(id), calls = []
  const jobs = await execute({ nativeDetailRecovery: false, detailEnrichmentBudgetMs: 10000, fetchText: async url => {
    calls.push(url)
    if (url.includes('/search-results')) return '<script>phApp.ddo = ' + JSON.stringify({ eagerLoadRefineSearch: {
      totalHits: 1, hits: 1, data: { jobs: [p.listing], aggregations: [{ field: 'country', value: { India: 1 } }] },
    } }) + '</script>'
    assert.equal(url, p.url, 'Only this exact retained native role can supply its detail')
    return alter(p.body)
  } })
  assert.equal(calls.length, 2)
  assert.equal(jobs.length, 1)
  return jobs[0]
}
const changeNativeCountryField = (body, field, country) => {
  for (const match of body.matchAll(/phApp\.ddo\s*=/g)) {
    const start = body.indexOf('{', match.index + match[0].length)
    let depth = 0, quoted = false, escaped = false
    for (let index = start; index < body.length; index++) {
      const char = body[index]
      if (quoted) { if (escaped) escaped = false; else if (char === '\\') escaped = true; else if (char === '"') quoted = false; continue }
      if (char === '"') { quoted = true; continue }
      if (char === '{') depth++
      if (char === '}' && --depth === 0) {
        let model
        try { model = JSON.parse(body.slice(start, index + 1)) } catch { break }
        const native = model?.jobDetail?.data?.job
        if (!native) break
        assert.equal(native[field], 'India')
        native[field] = country
        return body.slice(0, start) + JSON.stringify(model) + body.slice(index + 1)
      }
    }
  }
  throw new Error('Expected captured native structured role JSON')
}
test('actual HPE French country name qualifies one exact native role without changing native content', async () => {
  assert.equal(new Intl.DisplayNames(['fr'], { type: 'region' }).of('IN'), 'Inde')
  const job = await controlledRun('1215680')
  assert.equal(job.sourceDetailComplete, true)
  assert.equal(job.country, 'India')
  assert.ok(job.jobDescription.length > 1000)
  assert.equal(job.title, packet('1215680').listing.title)
  assert.deepEqual(job.sourceNativeCountryEvidence.nativeCountryNameMappings, [{ label: 'Inde', region: 'IN', locale: 'fr' }])
  assert.equal(job.sourceNativeCountryEvidence.ml_country, 'Inde')
})
test('the same recognized localized country does not qualify the actual different native title', async () => {
  const job = await controlledRun('1216876')
  assert.equal(job.sourceDetailComplete, false)
  assert.equal(job.sourceDetailFailureKind, 'identity-mismatch')
})
test('the other original genuine title conflict remains unqualified', async () => {
  const job = await controlledRun('1206610')
  assert.equal(job.sourceDetailComplete, false)
  assert.equal(job.sourceDetailFailureKind, 'identity-mismatch')
})
test('an unreviewed machine country name remains unqualified', async () => {
  const job = await controlledRun('1215680', { alter: body => {
    const altered = body.replace(/("ml_country"\s*:\s*)"Inde"/g, '$1"Inde-unreviewed"')
    assert.notEqual(altered, body)
    return altered
  } })
  assert.equal(job.sourceDetailComplete, false)
  assert.equal(job.sourceDetailFailureKind, 'identity-mismatch')
})
test('existing independent native-office corroboration for a known erroneous machine country remains unchanged', async () => {
  const job = await controlledRun('1215680', { alter: body => body.replace(/("ml_country"\s*:\s*)"Inde"/g, '$1"France"') })
  assert.equal(job.sourceDetailComplete, true)
  assert.equal(job.sourceNativeCountryEvidence.derivedCountryConflict, true)
  assert.equal(job.sourceNativeCountryEvidence.ml_country, 'France')
})
for (const country of ['United States', 'Inde / United States']) test('native primary country conflict remains unqualified: ' + country, async () => {
  const job = await controlledRun('1215680', { alter: body => {
    const altered = body.replace(/("country"\s*:\s*)"India"/g, '$1' + JSON.stringify(country))
    assert.notEqual(altered, body)
    return altered
  } })
  assert.equal(job.sourceDetailComplete, false)
  assert.equal(job.sourceDetailFailureKind, 'identity-mismatch')
})
test('Phenom sources without the explicit locale and region opt-in retain their country behavior', async () => {
  const other = createPhenomScraper({ companyName: 'HPE', source: 'hpe', baseUrl: 'https://careers.hpe.com',
    searchPath: '/us/en/search-results', scraperDir: path.dirname(fileURLToPath(import.meta.url)) })
  const job = await controlledRun('1215680', { execute: other.run })
  assert.equal(job.sourceDetailComplete, false)
})
test('changing only an authoritative native country field to mixed countries cannot qualify through unchanged India offices', async () => {
  for (const field of ['country', 'standardisedCountry']) for (const country of ['Inde / United States', 'India / United States']) {
    const job = await controlledRun('1215680', { alter: body => changeNativeCountryField(body, field, country) })
    assert.equal(job.sourceDetailComplete, false, field + ': ' + country)
    assert.equal(job.sourceDetailFailureKind, 'identity-mismatch')
  }
})
test('a returned translation receipt cannot change a later native result from the same source factory', async () => {
  const local = createPhenomScraper({ companyName: 'HPE', source: 'hpe', baseUrl: 'https://careers.hpe.com',
    searchPath: '/us/en/search-results', scraperDir: path.dirname(fileURLToPath(import.meta.url)),
    nativeLocalizedCountryNames: [{ locale: 'fr', region: 'IN' }] })
  const first = await controlledRun('1215680', { execute: local.run })
  const mapping = first.sourceNativeCountryEvidence.nativeCountryNameMappings[0]
  try { mapping.region = 'US' } catch {}
  const second = await controlledRun('1215680', { execute: local.run })
  assert.equal(second.sourceDetailComplete, true)
  assert.deepEqual(second.sourceNativeCountryEvidence.nativeCountryNameMappings, [{ label: 'Inde', region: 'IN', locale: 'fr' }])
  assert.notEqual(mapping, second.sourceNativeCountryEvidence.nativeCountryNameMappings[0])
})
