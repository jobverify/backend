import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry, getScraperCatalog, buildScrapers } from '../providers/index.js'
import { resolveZeroJobOutcome, buildCoverageGapResult } from '../runner.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
import { inventoryCleanupOptions } from '../utils/scraperOutcome.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/ravetechnologies/script.js')
const customProvidersPath = path.resolve(currentDir, '../providers/customProviders.json')

const SUCCESSOR_HOMEPAGE_HTML = `
<!doctype html>
<html lang="en-GB">
  <head><title>NEC Software Solutions - Orchestrating a Brighter World</title></head>
  <body>
    <a href="https://www.necsws.com/india/careers/">Careers</a>
  </body>
</html>
`

const SUCCESSOR_CAREERS_HTML = `
<!doctype html>
<html lang="en-GB">
  <head>
    <title>Careers - NEC Software Solutions</title>
  </head>
  <body>
    <a href="https://jobs.smartrecruiters.com/NECSWS/744000140869519-senior-software-engineer-oracle-pl-sql">
      Senior Software Engineer - Oracle PL SQL
    </a>
  </body>
</html>
`

const SMARTRECRUITERS_BOARD_HTML = `
<!doctype html>
<html lang="en" class="no-js">
  <head>
    <title>Careers at NECSWS</title>
    <script>
      window._jsErrorTrackerOptions = { application: 'career-site-ui' }
    </script>
  </head>
  <body>
    <div id="career-site">Join NECSWS</div>
  </body>
</html>
`

const SUCCESSOR_HOMEPAGE_INTERSTITIAL_HTML = `
<!doctype html>
<html>
  <head><title>You are being redirected...</title></head>
  <body>
    <noscript>Javascript is required. Please enable javascript before you are allowed to see this page.</noscript>
    <script>var sucuri_cloudproxy_js='enabled';</script>
  </body>
</html>
`

const smartRecruitersListingsPayload = {
  offset: 0,
  limit: 100,
  totalFound: 2,
  content: [
    {
      id: '744000140869519',
      name: 'Senior Software Engineer - Oracle PL SQL',
      refNumber: 'REF5100P',
      company: {
        identifier: 'NECSWS',
        name: 'NECSWS',
      },
      releasedDate: '2026-07-31T10:00:09.692Z',
      location: {
        city: 'Mumbai',
        region: 'MH',
        country: 'in',
        fullLocation: 'Mumbai, MH, India',
        remote: false,
        hybrid: true,
      },
      function: {
        label: 'Information Technology',
      },
      department: {
        label: 'GHH',
      },
      typeOfEmployment: {
        label: 'Full-time',
      },
      experienceLevel: {
        label: 'Mid-Senior Level',
      },
      visibility: 'PUBLIC',
      ref: 'https://api.smartrecruiters.com/v1/companies/NECSWS/postings/744000140869519',
    },
    {
      id: '744000140000000',
      name: 'Senior Product Designer',
      refNumber: 'REFUK1',
      company: {
        identifier: 'NECSWS',
        name: 'NECSWS',
      },
      location: {
        city: 'London',
        country: 'gb',
        fullLocation: 'London, England, United Kingdom',
      },
      function: {
        label: 'Design',
      },
      visibility: 'PUBLIC',
      ref: 'https://api.smartrecruiters.com/v1/companies/NECSWS/postings/744000140000000',
    },
  ],
}

const smartRecruitersDetailPayload = {
  company: { identifier: 'NECSWS' },
  location: { city: 'Mumbai', region: 'MH', country: 'in', fullLocation: 'Mumbai, MH, India', hybrid: true },
  id: '744000140869519',
  name: 'Senior Software Engineer - Oracle PL SQL',
  refNumber: 'REF5100P',
  releasedDate: '2026-07-31T10:00:09.692Z',
  postingUrl:
    'https://jobs.smartrecruiters.com/NECSWS/744000140869519-senior-software-engineer-oracle-pl-sql',
  applyUrl:
    'https://jobs.smartrecruiters.com/NECSWS/744000140869519-senior-software-engineer-oracle-pl-sql?oga=true',
  jobAd: {
    sections: {
      jobDescription: {
        text: '<p>Build and support Oracle PL SQL services.</p>',
      },
      qualifications: {
        text: '<p>Strong Oracle PL SQL and debugging experience.</p>',
      },
      additionalInformation: {
        text: '<p>Hybrid role aligned to the India delivery team.</p>',
      },
    },
  },
}

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/ravetechnologies/catalog.js')
  } catch {
    assert.fail('Expected Rave Technologies catalog module at ../../scraper/ravetechnologies/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/ravetechnologies/script.js')
  } catch {
    assert.fail('Expected Rave Technologies scraper module at ../../scraper/ravetechnologies/script.js')
  }
}

const buildProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

const readCustomProvider = () => {
  const providers = JSON.parse(fs.readFileSync(customProvidersPath, 'utf8'))
  return providers.find((provider) => provider.source === 'ravetechnologies')
}

test('Rave Technologies catalog tracks the NEC rename evidence, forbidden successor shells, and SmartRecruiters board', async () => {
  const { RAVE_TECHNOLOGIES_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const rave = await loadScriptModule()
  const provider = buildProvider(RAVE_TECHNOLOGIES_CATALOG)
  const customProvider = readCustomProvider()

  assert.equal(defaultCatalog, RAVE_TECHNOLOGIES_CATALOG)
  assert.ok(customProvider, 'Expected ravetechnologies provider in customProviders.json')

  assert.equal(provider.source, 'ravetechnologies')
  assert.equal(provider.companyName, 'Rave Technologies')
  assert.equal(provider.officialBrandName, 'Rave Technologies')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.rave-tech.com/')
  assert.equal(provider.companyCareerPage, 'https://www.necsws.com/careers/')
  assert.equal(provider.successorHomepageUrl, 'https://www.necsws.com/india/')
  assert.equal(
    provider.transitionEvidenceUrl,
    'https://www.nec.com/en/press/202107/global_20210701_03.html',
  )
  assert.equal(provider.atsPlatform, 'smartrecruiters-public-board')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'smartrecruiters-api-pages')
  assert.equal(
    provider.extractionStrategy,
    'verified-nec-brand-transition+first-party-careers-handoff+smartrecruiters-public-api',
  )
  assert.equal(provider.companyDomain, 'necsws.com')
  assert.equal(provider.verifiedOn, '2026-08-04')
  assert.equal(provider.smartRecruitersBoardUrl, 'https://jobs.smartrecruiters.com/NECSWS')
  assert.equal(provider.smartRecruitersCompanyIdentifier, 'NECSWS')
  assert.equal(
    provider.smartRecruitersListingApiUrl,
    'https://api.smartrecruiters.com/v1/companies/NECSWS/postings',
  )
  assert.equal(
    provider.smartRecruitersDetailApiUrlTemplate,
    'https://api.smartrecruiters.com/v1/companies/NECSWS/postings/{{jobId}}',
  )
  assert.match(provider.verifiedSurfaceSummary, /live NEC India homepage/i)
  assert.match(provider.verifiedSurfaceSummary, /public jobs API/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /ravetechnologies[\\/]jobs\.json$/i)

  assert.equal(customProvider.companyCareerPage, 'https://www.necsws.com/careers')
  assert.notEqual(customProvider.companyCareerPage, provider.companyCareerPage)
  assert.equal(customProvider.atsPlatform, provider.atsPlatform)
  assert.equal(customProvider.verifiedOn, provider.verifiedOn)
  assert.equal(customProvider.smartRecruitersBoardUrl, provider.smartRecruitersBoardUrl)
  assert.equal(customProvider.smartRecruitersCompanyIdentifier, provider.smartRecruitersCompanyIdentifier)

  assert.equal(rave.CAREERS_URL, provider.companyCareerPage)
  assert.equal(rave.TRANSITION_EVIDENCE_URL, provider.transitionEvidenceUrl)
})

test('Rave Technologies exact backlog row resolves from the updated local catalog', async () => {
  const { RAVE_TECHNOLOGIES_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Rave Technologies\n',
    catalog: [buildProvider(RAVE_TECHNOLOGIES_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})

test('Rave Technologies run validates the forbidden successor URLs and maps public India SmartRecruiters jobs', async () => {
  const rave = await loadScriptModule()
  const requestedUrls = []

  const jobs = await rave.createRaveTechnologiesScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === rave.SUCCESSOR_HOMEPAGE_URL) {
        return SUCCESSOR_HOMEPAGE_HTML
      }
      if (url === rave.CAREERS_URL) {
        return SUCCESSOR_CAREERS_HTML
      }
      if (url === rave.SMARTRECRUITERS_BOARD_URL) {
        return SMARTRECRUITERS_BOARD_HTML
      }

      throw new Error(`Unexpected Rave Technologies HTML fixture URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedUrls.push(url)
      if (
        url
        === 'https://api.smartrecruiters.com/v1/companies/NECSWS/postings?limit=100&country=in&offset=0'
      ) {
        return smartRecruitersListingsPayload
      }
      if (
        url
        === 'https://api.smartrecruiters.com/v1/companies/NECSWS/postings/744000140869519'
      ) {
        return smartRecruitersDetailPayload
      }

      throw new Error(`Unexpected Rave Technologies JSON fixture URL: ${url}`)
    },
    now: () => '2026-08-04T00:00:00.000Z',
  })

  assert.equal(rave.hasSuccessorHomepageSignal(SUCCESSOR_HOMEPAGE_HTML), true)
  assert.equal(rave.hasSuccessorCareersSignal(SUCCESSOR_CAREERS_HTML), true)
  assert.equal(rave.hasSmartRecruitersBoardSignal(SMARTRECRUITERS_BOARD_HTML), true)
  assert.deepEqual(requestedUrls, [
    rave.SUCCESSOR_HOMEPAGE_URL,
    rave.CAREERS_URL,
    rave.SMARTRECRUITERS_BOARD_URL,
    'https://api.smartrecruiters.com/v1/companies/NECSWS/postings?limit=100&country=in&offset=0',
    'https://api.smartrecruiters.com/v1/companies/NECSWS/postings/744000140869519',
    'https://api.smartrecruiters.com/v1/companies/NECSWS/postings?limit=100&country=in&offset=0',
  ])
  assert.ok(jobs.every(job=>job.sourceListingComplete===false&&job.sourceScopeComplete===false&&job.lifecycleCleanupAllowed===false))
  assert.deepEqual(jobs.map(({sourceListingComplete,sourceScopeComplete,lifecycleCleanupAllowed,nativeCollectionEvidence,...job})=>job), [
    {
      title: 'Senior Software Engineer - Oracle PL SQL',
      company: 'Rave Technologies',
      department: 'Information Technology',
      location: 'Mumbai, MH, India',
      city: 'Mumbai',
      country: 'India',
      link:
        'https://jobs.smartrecruiters.com/NECSWS/744000140869519-senior-software-engineer-oracle-pl-sql',
      applyUrl:
        'https://jobs.smartrecruiters.com/NECSWS/744000140869519-senior-software-engineer-oracle-pl-sql?oga=true',
      sourceUrl:
        'https://jobs.smartrecruiters.com/NECSWS/744000140869519-senior-software-engineer-oracle-pl-sql',
      source: 'ravetechnologies',
      jobId: '744000140869519',
      requisitionId: 'REF5100P',
      employmentType: 'Full-time',
      experienceRequired: null,
      experienceLevel: 'Mid-Senior Level',
      minimumQualification: 'Strong Oracle PL SQL and debugging experience.',
      preferredQualification: 'Hybrid role aligned to the India delivery team.',
      requiredSkills: [],
      postingDate: '2026-07-31T10:00:09.692Z',
      closingDate: null,
      jobDescription: 'Job Description\nBuild and support Oracle PL SQL services.\n\nQualifications\nStrong Oracle PL SQL and debugging experience.\n\nAdditional Information\nHybrid role aligned to the India delivery team.',
      remoteStatus: 'Hybrid',
      scrapedAt: '2026-08-04T00:00:00.000Z',
    },
  ])
})

test('Rave Technologies fails closed when the verified successor or SmartRecruiters contracts drift', async () => {
  const rave = await loadScriptModule()

  await assert.rejects(
    rave.createRaveTechnologiesScraper().run({
      fetchText: async (url) => {
        if (url === rave.SUCCESSOR_HOMEPAGE_URL) return '<html><body>OK</body></html>'
        if (url === rave.CAREERS_URL) return SUCCESSOR_CAREERS_HTML
        return SMARTRECRUITERS_BOARD_HTML
      },
      fetchJson: async () => smartRecruitersListingsPayload,
    }),
    /trusted NEC India surface/i,
  )

  await assert.rejects(
    rave.createRaveTechnologiesScraper().run({
      fetchText: async (url) => {
        if (url === rave.SUCCESSOR_HOMEPAGE_URL) {
          return SUCCESSOR_HOMEPAGE_HTML
        }
        if (url === rave.CAREERS_URL) {
          return '<html><head><title>Careers</title></head><body>Jobs</body></html>'
        }
        return SMARTRECRUITERS_BOARD_HTML
      },
      fetchJson: async () => smartRecruitersListingsPayload,
    }),
    /trusted SmartRecruiters handoff/i,
  )

  await assert.rejects(
    rave.createRaveTechnologiesScraper().run({
      fetchText: async (url) => {
        if (url === rave.SUCCESSOR_HOMEPAGE_URL) {
          return SUCCESSOR_HOMEPAGE_HTML
        }
        if (url === rave.CAREERS_URL) {
          return SUCCESSOR_CAREERS_HTML
        }
        return '<html><head><title>Careers</title></head><body>Board</body></html>'
      },
      fetchJson: async () => ({ ...smartRecruitersListingsPayload, totalFound: 0, content: [] }),
    }),
    /trusted public jobs surface/i,
  )

  await assert.rejects(
    rave.createRaveTechnologiesScraper().run({
      fetchText: async (url) => {
        if (url === rave.SUCCESSOR_HOMEPAGE_URL) {
          return SUCCESSOR_HOMEPAGE_HTML
        }
        if (url === rave.CAREERS_URL) {
          return SUCCESSOR_CAREERS_HTML
        }
        return SMARTRECRUITERS_BOARD_HTML
      },
      fetchJson: async () => ({ ...smartRecruitersListingsPayload, totalFound: 0, content: [] }),
    }),
    /no public India jobs/i,
  )
})

test('Rave Technologies tolerates the verified successor homepage interstitial when the careers handoff and SmartRecruiters board still match', async () => {
  const rave = await loadScriptModule()

  const successorHomepageBlocked = new Error(`HTTP 307 for ${rave.SUCCESSOR_HOMEPAGE_URL}`)
  successorHomepageBlocked.status = 307
  successorHomepageBlocked.responseBody = SUCCESSOR_HOMEPAGE_INTERSTITIAL_HTML

  const retryWrappedError = new Error(
    `[${rave.SOURCE}] All 3 attempts failed. Last error: HTTP 307 for ${rave.SUCCESSOR_HOMEPAGE_URL}`,
  )
  retryWrappedError.abortRetries = true
  retryWrappedError.cause = successorHomepageBlocked

  const jobs = await rave.createRaveTechnologiesScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      if (url === rave.SUCCESSOR_HOMEPAGE_URL) {
        throw retryWrappedError
      }
      if (url === rave.CAREERS_URL) {
        return SUCCESSOR_CAREERS_HTML
      }
      if (url === rave.SMARTRECRUITERS_BOARD_URL) {
        return SMARTRECRUITERS_BOARD_HTML
      }

      throw new Error(`Unexpected Rave Technologies HTML fixture URL: ${url}`)
    },
    fetchJson: async (url) => {
      if (
        url
        === 'https://api.smartrecruiters.com/v1/companies/NECSWS/postings?limit=100&country=in&offset=0'
      ) {
        return smartRecruitersListingsPayload
      }
      if (
        url
        === 'https://api.smartrecruiters.com/v1/companies/NECSWS/postings/744000140869519'
      ) {
        return smartRecruitersDetailPayload
      }

      throw new Error(`Unexpected Rave Technologies JSON fixture URL: ${url}`)
    },
    now: () => '2026-08-18T00:00:00.000Z',
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'ravetechnologies')
  assert.equal(jobs[0].jobId, '744000140869519')
})

test('Rave exact runtime and effective descriptor URLs remain separate and do not certify empty inventory', async () => {
  const rave = await loadScriptModule()
  const effective = getScraperCatalog().find(item => item.source === 'ravetechnologies')
  const scraper = buildScrapers().find(item => item.name === 'ravetechnologies')
  assert.equal(rave.CAREERS_URL, 'https://www.necsws.com/careers/')
  assert.equal(effective.companyCareerPage, 'https://www.necsws.com/careers')
  assert.notEqual(rave.CAREERS_URL, effective.companyCareerPage)
  assert.equal(effective.verifiedOn, '2026-08-04')
  assert.equal(effective.smartRecruitersCompanyIdentifier, 'NECSWS')
  assert.equal(effective.smartRecruitersBoardUrl, 'https://jobs.smartrecruiters.com/NECSWS')
  assert.equal(effective.zeroResultPolicy, 'evidence-required')
  const jobs = []
  assert.equal(readInventoryEvidence(jobs), null)
  assert.equal(resolveZeroJobOutcome(scraper, jobs, jobs), 'unverified-zero')
  assert.equal(buildCoverageGapResult(scraper.name, 'unverified-zero').success, false)
  assert.deepEqual(inventoryCleanupOptions({ success: true, zeroJobEvidence: 'unverified-zero', inventoryEvidence: null }), { replaceExisting: false })
})

test('Rave historical rename metadata cannot admit a foreign SmartRecruiters handoff', async () => {
  const rave = await loadScriptModule()
  let jsonCalls = 0
  await assert.rejects(rave.createRaveTechnologiesScraper().run({
    fetchText: async url => url === rave.SUCCESSOR_HOMEPAGE_URL ? SUCCESSOR_HOMEPAGE_HTML : SUCCESSOR_CAREERS_HTML.replaceAll('NECSWS', 'UNRELATED_EMPLOYER'),
    fetchJson: async () => { jsonCalls++; throw new Error('Foreign handoff must stop before listing') },
  }), /trusted SmartRecruiters handoff/i)
  assert.equal(jsonCalls, 0)
})
