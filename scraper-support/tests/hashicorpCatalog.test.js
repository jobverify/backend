import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport, getCompanyAliasMap } from '../providers/companyCoverage.js'
import { getScraperCatalog } from '../providers/index.js'

test('getScraperCatalog includes HashiCorp on its official careers overview page', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'hashicorp')

  assert.ok(provider)
  assert.equal(provider.companyName, 'HashiCorp')
  assert.equal(provider.officialBrandName, 'HashiCorp')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers-plus-ibm-search-handoff')
  assert.match(provider.companyCareerPage, /hashicorp\.com\/en\/careers/i)
  assert.match(provider.officialOpenPositionsUrl, /ibm\.com\/careers\/search\?q=hashicorp/i)
  assert.equal(provider.companyDomain, 'hashicorp.com')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'verified-first-party-careers-overview-plus-ibm-search-api')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-overview+official-ibm-open-positions-handoff+ibm-search-api+india-filter',
  )
  assert.equal(provider.verifiedIndiaScopedPostingCount, 0)
  assert.equal(provider.verifiedOn, '2026-07-25')
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 25, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.hashicorp\.com\/en\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.ibm\.com\/careers\/search\?q=hashicorp/i)
  assert.match(provider.verifiedSurfaceSummary, /Terraform, Vault, Consul, and Packer/i)
  assert.match(provider.verifiedSurfaceSummary, /returned 0 India-scoped jobs/i)
  assert.match(provider.modulePath, /hashicorp[\\/]script\.js$/i)
})

test('Terraform and related HashiCorp product backlog names resolve through the shared HashiCorp provider', () => {
  const aliases = getCompanyAliasMap()
  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nTerraform\nVault\nConsul\nPacker\n',
    catalog: getScraperCatalog(),
    aliasMap: companyAliases,
  })

  assert.equal(aliases.Terraform, 'hashicorp')
  assert.equal(aliases.Vault, 'hashicorp')
  assert.equal(aliases.Consul, 'hashicorp')
  assert.equal(aliases.Packer, 'hashicorp')

  assert.equal(report.matchedCount, 4)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [
      ['Terraform', 'hashicorp', 'HashiCorp'],
      ['Vault', 'hashicorp', 'HashiCorp'],
      ['Consul', 'hashicorp', 'HashiCorp'],
      ['Packer', 'hashicorp', 'HashiCorp'],
    ],
  )
})
