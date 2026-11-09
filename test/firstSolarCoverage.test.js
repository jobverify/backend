import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../scraper-support/providers/companyCoverage.js'
import { getScraperCatalog } from '../scraper-support/providers/index.js'

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const extensionPath = path.join(backendDir, 'scraper-support/providers/providerExtensions/firstsolar.json')
const csvText = "company_name\nFirst Solar\n"

test('First Solar exact provider extension covers only the literal CSV company row', () => {
  assert.equal(existsSync(extensionPath), true)
  const provider = JSON.parse(readFileSync(extensionPath, 'utf8'))
  const report = generateCompanyCoverageReport({
    csvText: csvText,
    catalog: getScraperCatalog(),
  })
  const matches = report.matched.filter(({ companyName }) => companyName === 'First Solar')

  assert.equal(provider.companyName, 'First Solar')
  assert.equal(provider.exactCompanyMatchOnly, true)
  assert.equal(matches.length, 1)
  assert.equal(matches[0].source, 'firstsolar')
})
