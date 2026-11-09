import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../providers/index.js'
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'

const retiredProviders = [
  ['bajajallianz', 'Bajaj Allianz'],
  ['bajajauto', 'Bajaj Auto'],
  ['bajajelectricals', 'Bajaj Electricals'],
  ['bajajfinserv', 'Bajaj Finserv'],
  ['bajajfinservhealth', 'Bajaj Finserv Health'],
  ['bajajhousingfinance', 'Bajaj Housing Finance'],
  ['bajajmarkets', 'Bajaj Markets'],
  ['cars24', 'Cars24'],
  ['delhivery', 'Delhivery'],
  ['drreddyslaboratories', "Dr. Reddy's Laboratories"],
  ['fortishealthcare', 'Fortis Healthcare'],
  ['godrejconsumerproducts', 'Godrej Consumer Products'],
  ['godrejenterprisesgroup', 'Godrej Enterprises Group', 'Godrej & Boyce'],
  ['godrejproperties', 'Godrej Properties'],
  ['johnsoncontrolsindia', 'Johnson Controls India'],
  ['karurvysyabank', 'Karur Vysya Bank'],
  ['legrand', 'Legrand'],
  ['tatamotors', 'Tata Motors'],
  ['tvsmotorcompany', 'TVS Motor Company'],
]
const retirementScript = readFileSync(new URL('../../scripts/purgeRetiredCompanyJobs.js', import.meta.url), 'utf8')
const retiredSources = new Set([...retirementScript.match(/const retiredSources = \[([\s\S]*?)\];/)[1]
  .matchAll(/"([^"]+)"/g)].map(match => match[1]))
const catalog = getScraperCatalog()
const scrapers = buildScrapers()

for (const [source, ...companyNames] of retiredProviders) {
  test(`${companyNames[0]} retired source cannot return through catalog, execution, or coverage`, () => {
    assert.ok(retiredSources.has(source), `${source} must remain explicitly retired`)
    assert.equal(existsSync(new URL(`../../scraper/${source}/script.js`, import.meta.url)), false)
    assert.equal(catalog.some(provider => provider.source === source), false)
    assert.equal(scrapers.some(scraper => scraper.name === source), false)

    for (const companyName of companyNames) {
      const report = generateCompanyCoverageReport({ csvText: `company_name\n${companyName}\n`, catalog })
      assert.equal(report.totalRows, 1)
      // A legitimate replacement may cover this company under its own source.
      assert.ok(report.matched.every(provider => !retiredSources.has(provider.source)), companyName)
    }
  })
}
