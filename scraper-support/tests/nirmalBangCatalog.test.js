import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const nirmalBangModulePath = path.resolve(currentDir, '../../scraper/nirmalbang/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/nirmalbang/catalog.js')
  } catch {
    assert.fail('Expected Nirmal Bang catalog module at ../../scraper/nirmalbang/catalog.js')
  }
}

const loadNirmalBangModule = async () => {
  try {
    return await import('../../scraper/nirmalbang/script.js')
  } catch {
    assert.fail('Expected Nirmal Bang scraper module at ../../scraper/nirmalbang/script.js')
  }
}

test('Nirmal Bang local catalog captures the verified first-party careers page and public Ajax openings contract', async () => {
  const { NIRMAL_BANG_CATALOG } = await loadCatalogModule()
  const nirmalBang = await loadNirmalBangModule()
  const provider = hydrateProviderCatalogEntry(NIRMAL_BANG_CATALOG)

  assert.equal(provider.source, 'nirmalbang')
  assert.equal(provider.companyName, 'Nirmal Bang')
  assert.equal(provider.officialBrandName, 'Nirmal Bang')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.nirmalbang.com/')
  assert.equal(provider.companyCareerPage, 'https://www.nirmalbang.com/static/career.aspx')
  assert.equal(provider.officialCareersLandingUrl, 'https://www.nirmalbang.com/static/career.aspx')
  assert.equal(
    provider.jobListingsAjaxUrl,
    'https://www.nirmalbang.com/Ajaxpages/Ajax_fillcareers.aspx?pg=0',
  )
  assert.equal(
    provider.jobDetailsBaseUrl,
    'https://www.nirmalbang.com/Ajaxpages/Ajax_fillcareerspop.aspx?Cid=',
  )
  assert.equal(provider.atsPlatform, 'nirmalbang-first-party-ajax')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'first-party-careers-page-plus-public-ajax-listings-until-empty-page',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+ajax-fillcareers-list+ajax-fillcareerspop-detail',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'nirmalbang.com')
  assert.equal(provider.verifiedOn, '2026-07-16')
  assert.match(provider.dryRunFile, /nirmalbang[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Thursday, July 16, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.nirmalbang\.com\/static\/career\.aspx/i)
  assert.match(provider.verifiedSurfaceSummary, /Ajaxpages\/Ajax_fillcareers\.aspx\?pg=0/i)
  assert.match(provider.verifiedSurfaceSummary, /Ajaxpages\/Ajax_fillcareerspop\.aspx\?Cid=1216/i)
  assert.match(provider.verifiedSurfaceSummary, /Administration Manager/i)
  assert.match(provider.verifiedSurfaceSummary, /Commodity Dealer/i)
  assert.equal(provider.modulePath, nirmalBangModulePath)

  assert.equal(nirmalBang.PROVIDER_METADATA.source, NIRMAL_BANG_CATALOG.source)
  assert.equal(nirmalBang.PROVIDER_METADATA.companyName, NIRMAL_BANG_CATALOG.companyName)
  assert.equal(
    nirmalBang.PROVIDER_METADATA.jobListingsAjaxUrl,
    NIRMAL_BANG_CATALOG.jobListingsAjaxUrl,
  )
})
