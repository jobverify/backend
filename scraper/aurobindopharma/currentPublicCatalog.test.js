import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {getScraperCatalog} from '../../scraper-support/providers/index.js'

const sources = ['avasoft', 'aurobindopharma', 'byjus', 'affordmed']
test('current public source overrides win without stale verified totals or company cleanup authority', () => {
  const catalog = getScraperCatalog()
  for (const source of sources) {
    const row = catalog.find(item => item.source === source)
    assert.equal(row.sourceCurrentPublicContractReviewedOn, '2026-11-03')
    assert.ok(row.modulePath.replaceAll('\\', '/').endsWith('/scraper/' + source + '/script.js'))
    for (const key of ['verifiedAt', 'verifiedOn', 'verifiedPublicJobCount', 'verifiedIndiaJobCount', 'verifiedPublicPostingCount', 'verifiedIndiaRoleCount']) assert.equal(row[key], null, source + ':' + key)
    for (const key of ['sourceScopeComplete', 'sourceCompanyWideScopeComplete', 'lifecycleCleanupAllowed']) assert.equal(row[key], false, source + ':' + key)
  }
})

test('current source-owned public fixtures preserve the original captured entity hashes', () => {
  for (const source of sources) {
    const fixture = JSON.parse(gunzipSync(fs.readFileSync(new URL('../' + source + '/test-data/current-public-20261103.json.gz', import.meta.url))))
    for (const row of fixture.responses || fixture.packets) {
      const bytes = row.bodyBase64 ? Buffer.from(row.bodyBase64, 'base64') : Buffer.from(row.body)
      assert.equal(createHash('sha256').update(bytes).digest('hex'), row.sha256, source + ':' + row.url)
    }
  }
})
