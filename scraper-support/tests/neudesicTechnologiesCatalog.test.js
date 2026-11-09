import assert from 'node:assert/strict'
import test from 'node:test'
import { hydrateProviderCatalogEntry } from '../providers/index.js'
import { NEUDESIC_TECHNOLOGIES_CATALOG } from '../../scraper/neudesictechnologies/catalog.js'

test('Neudesic catalog points the provider at the verified active India Freshteam board', () => {
  const provider = hydrateProviderCatalogEntry(NEUDESIC_TECHNOLOGIES_CATALOG)
  assert.equal(provider.source, 'neudesictechnologies')
  assert.equal(provider.companyName, 'Neudesic Technologies')
  assert.equal(provider.companyCareerPage, 'https://careers.neudesic.in/jobs')
  assert.equal(provider.atsPlatform, 'freshteam')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'complete-public-board-with-department-count-validation')
  assert.match(provider.verifiedSurfaceSummary, /Neudesic Technologies Pvt\. Ltd\./)
  assert.match(provider.modulePath, /neudesictechnologies[\\/]script\.js$/)
})
