import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog, hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

test('HolidayIQ exact CSV row resolves to the native discovery provider', async () => {
  const { HOLIDAYIQ_CATALOG } = await import('../../scraper/holidayiq/catalog.js')
  const provider = hydrateProviderCatalogEntry(HOLIDAYIQ_CATALOG)
  const report = generateCompanyCoverageReport({
    csvText: 'HolidayIQ\n',
    catalog: [provider],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.equal(report.matched[0].source, 'holidayiq')
  assert.equal(provider.companyName, 'HolidayIQ')
  assert.equal(provider.companyCareerPage, 'https://www.holidayiq.com/')
  assert.equal(provider.verifiedPublicJobCount, null)
  assert.equal(provider.modulePath, path.resolve(currentDir, '../../scraper/holidayiq/script.js'))
})

test('HolidayIQ is registered and returns no fabricated jobs', async () => {
  const provider = getScraperCatalog().find((item) => item.source === 'holidayiq')
  const scraper = buildScrapers().find((item) => item.name === 'holidayiq')
  const holidayiq = await import('../../scraper/holidayiq/script.js')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(scraper.provider.companyName, 'HolidayIQ')
  assert.equal(holidayiq.PROVIDER_METADATA.atsPlatform, 'first-party-recruiting-discovery-blocked')
  const rows=['official-pages','linkedin-pages'].flatMap(name=>JSON.parse(gunzipSync(fs.readFileSync(new URL('../../scraper/holidayiq/fixtures/'+name+'.json.gz',import.meta.url)))))
  const fetchImpl=async url=>{const row=rows.find(r=>r.url===url);assert.ok(row);const response=new Response(row.body,{status:row.status});Object.defineProperty(response,'url',{value:row.finalUrl});return response}
  await assert.rejects(holidayiq.createHolidayIQScraper({fetchImpl}).run(),{code:'HOLIDAYIQ_COVERAGE_GAP'})
  await assert.rejects(scraper.run({fetchImpl}),{code:'HOLIDAYIQ_COVERAGE_GAP'})
})
