import assert from 'node:assert/strict'
import test from 'node:test'

const loadProviderModule = async () => {
  try {
    return await import('../../scraper/volansys/provider.js')
  } catch {
    assert.fail('Expected Volansys Technologies provider module at ../../scraper/volansys/provider.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/volansys/script.js')
  } catch {
    assert.fail('Expected Volansys Technologies scraper module at ../../scraper/volansys/script.js')
  }
}

test('Volansys Technologies exports the verified fail-closed parent-careers contract', async () => {
  const providerModule = await loadProviderModule()
  const scriptModule = await loadScriptModule()

  assert.deepEqual(providerModule.provider, {
    source: 'volansys',
    companyName: 'Volansys Technologies',
    officialBrandName: 'VOLANSYS',
    adapter: 'script',
    modulePath: '../../scraper/volansys/script.js',
    homepageUrl: 'https://www.volansys.com/',
    companyCareerPage: 'https://www.volansys.com/be-vigilant/',
    parentCareersPage: 'https://recruitment.acldigital.com/Default.aspx',
    atsPlatform: 'generic-parent-company-careers-plus-blocked-official-domain',
    countryFilter: 'India',
    paginationStrategy: 'parent-careers-shell-plus-blocked-volansys-route-validation',
    extractionStrategy: 'verified-acl-digital-parent-careers+verified-volansys-routes-return-522+fail-closed-sentinel',
    parser: 'custom-script',
    normalizationProfile: 'engineering-default',
    companyDomain: 'volansys.com',
    verifiedOn: '2026-07-18',
    verifiedSurfaceSummary:
      'Verified on Saturday, July 18, 2026 that the official VOLANSYS route https://www.volansys.com/be-vigilant/ states all ACL Digital jobs are posted on https://recruitment.acldigital.com/Default.aspx, while direct VOLANSYS public job routes such as https://www.volansys.com/careers, https://www.volansys.com/jobs, and https://www.volansys.com/be-vigilant/ returned Cloudflare 522 responses during live checks. The reachable ACL Digital board is a generic parent-company careers surface, not a trustworthy VOLANSYS-specific public jobs source, so this provider remains fail-closed.',
    dryRunFile: 'volansys/jobs.json',
  })

  assert.equal(scriptModule.SOURCE, providerModule.provider.source)
  assert.equal(scriptModule.COMPANY, providerModule.provider.companyName)
  assert.equal(scriptModule.CAREERS_URL, providerModule.provider.companyCareerPage)
  assert.deepEqual(scriptModule.PROVIDER_METADATA, providerModule.provider)
})

test('Volansys Technologies validates the generic parent board and blocked official routes before returning []', async () => {
  const volansys = await loadScriptModule()

  const parentCareersHtml = `
    <html>
      <head><title>ACL Digital</title></head>
      <body>
        <h1>ACL Digital Job Portal</h1>
        <p>Search Jobs</p>
        <p>Job Seekers/ New Hire</p>
        <p>Looking for a job?</p>
      </body>
    </html>
  `

  assert.equal(volansys.hasAclDigitalRecruitmentSignal(parentCareersHtml), true)
  assert.equal(volansys.isBlockedVolansysResponse({ status: 522, html: 'error code: 522' }), true)

  const jobs = await volansys.run({
    fetchPage: async (url) => {
      if (url === volansys.PARENT_CAREERS_URL) {
        return { status: 200, url, html: parentCareersHtml }
      }

      return { status: 522, url, html: 'error code: 522' }
    },
  })

  assert.deepEqual(jobs, [])
})
