import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'

const htcRedirectResponse = {
  status: 200,
  url: 'https://www.htcinc.com/',
  html: '<html><body><h1>HTC Global Services</h1></body></html>',
}

const unreachableResponse = (message) => ({
  status: null,
  url: null,
  html: '',
  error: new Error(message),
})

const loadProviderModule = async () => {
  try {
    return await import('../../scraper/cibersitesindia/provider.js')
  } catch {
    assert.fail('Expected CIBERsites India provider module at ../../scraper/cibersitesindia/provider.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/cibersitesindia/script.js')
  } catch {
    assert.fail('Expected CIBERsites India scraper module at ../../scraper/cibersitesindia/script.js')
  }
}

test('CIBERsites India exports the verified fail-closed redirect contract', async () => {
  const providerModule = await loadProviderModule()
  const scriptModule = await loadScriptModule()

  assert.deepEqual(providerModule.provider, {
    source: 'cibersitesindia',
    companyName: 'CIBERsites India',
    officialBrandName: 'CIBERsites India',
    adapter: 'script',
    modulePath: '../../scraper/cibersitesindia/script.js',
    homepageUrl: 'https://www.ciber.com/',
    companyCareerPage: 'https://www.ciber.com/careers',
    atsPlatform: 'exact-name-domain-redirects-to-acquirer-homepage',
    countryFilter: 'India',
    paginationStrategy: 'exact-name-homepage-and-careers-redirect-validation',
    extractionStrategy: 'verified-ciber-domain-redirect-to-htc+no-exact-name-public-careers+fail-closed-sentinel',
    parser: 'custom-script',
    normalizationProfile: 'engineering-default',
    companyDomain: 'ciber.com',
    verifiedOn: '2026-07-18',
    verifiedSurfaceSummary:
      'Verified on Saturday, July 18, 2026 that https://www.ciber.com/ and https://www.ciber.com/careers both redirected to https://www.htcinc.com/, while exact-name CIBERsites hosts such as https://www.cibersites.com/ and https://www.cibersitesindia.com/ were not publicly reachable. There is no trustworthy exact-name public careers surface for CIBERsites India on the verified date, so this provider remains fail-closed.',
    dryRunFile: 'cibersitesindia/jobs.json',
  })

  assert.equal(scriptModule.SOURCE, providerModule.provider.source)
  assert.equal(scriptModule.COMPANY, providerModule.provider.companyName)
  assert.equal(scriptModule.HOMEPAGE_URL, providerModule.provider.homepageUrl)
  assert.equal(scriptModule.CAREERS_URL, providerModule.provider.companyCareerPage)
  assert.deepEqual(scriptModule.PROVIDER_METADATA, providerModule.provider)

  const report = generateCompanyCoverageReport({
    csvText: 'CIBERsites India\n',
    catalog: [providerModule.provider],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})

test('CIBERsites India returns [] while the exact-name surface remains redirect-only and unreachable', async () => {
  const ciber = await loadScriptModule()

  assert.equal(ciber.isExpectedHtcRedirect(htcRedirectResponse), true)
  assert.equal(
    ciber.isExpectedUnreachableSurface(unreachableResponse('getaddrinfo ENOTFOUND www.cibersites.com')),
    true,
  )

  const jobs = await ciber.run({
    fetchPage: async (url) => {
      if (url === ciber.HOMEPAGE_URL || url === ciber.CAREERS_URL) {
        return htcRedirectResponse
      }

      if (url === ciber.EXACT_NAME_HOST_URL) {
        return unreachableResponse('connect ECONNREFUSED www.cibersites.com')
      }

      if (url === ciber.EXACT_NAME_INDIA_HOST_URL) {
        return unreachableResponse('getaddrinfo ENOTFOUND www.cibersitesindia.com')
      }

      throw new Error(`Unexpected CIBERsites URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
})

test('CIBERsites India fails closed when the verified redirect contract changes', async () => {
  const ciber = await loadScriptModule()

  await assert.rejects(
    ciber.run({
      fetchPage: async (url) => {
        if (url === ciber.HOMEPAGE_URL) {
          return { status: 200, url: 'https://www.ciber.com/careers', html: '<html></html>' }
        }

        throw new Error(`Unexpected CIBERsites URL: ${url}`)
      },
    }),
    /homepage redirect changed materially/i,
  )
})
