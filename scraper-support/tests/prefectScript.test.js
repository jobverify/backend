import { fixture, replay } from '../native-sources/declaredJobFeeds/fixtureReplay.js'
import { createCatalogScraper, getScraperCatalog } from '../providers/index.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-25T00:00:00.000Z'

const companyHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>About Prefect - Company & Mission</title>
  </head>
  <body>
    <main>
      <h1>We are Prefect</h1>
      <p>Defining automation for the context era.</p>
      <section>
        <h2>Join the team defining the future of workflow automation</h2>
        <a href="https://jobs.ashbyhq.com/prefect">Careers</a>
        <a href="/careers">See Open Roles</a>
      </section>
    </main>
  </body>
</html>
`

const companyHtmlViaFirstPartyCareers = `
<!doctype html>
<html lang="en">
  <head>
    <title>About Prefect - Company & Mission</title>
  </head>
  <body>
    <main>
      <h1>We are Prefect</h1>
      <p>Defining automation for the context era.</p>
      <section>
        <h2>Join the team defining the future of workflow automation</h2>
        <a href="/careers">See Open Roles</a>
      </section>
    </main>
  </body>
</html>
`

const careersHtmlWithEmbeddedBoard = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Prefect - Open Roles</title>
    <meta
      name="description"
      content="See every open role at Prefect. We're remote first and have carefully created a supportive, high-performance culture."
    />
  </head>
  <body>
    <main>
      <section>
        <h1>Join the team defining the future of workflow automation</h1>
        <p>We're remote first and have carefully created a supportive, high-performance culture.</p>
        <h2>Open roles</h2>
        <p>Loading open roles…</p>
      </section>
      <script>
        self.__next_f.push([
          1,
          "customCssUrl":"https://www.prefect.io/ashby-job-board.css"
        ])
      </script>
    </main>
  </body>
</html>
`

const ashbyPayload = {
  jobs: [
    {
      id: 'platform-engineer-india',
      title: 'Platform Engineer',
      department: 'Engineering',
      team: 'Cloud',
      employmentType: 'FullTime',
      location: 'Remote',
      secondaryLocations: [
        {
          location: 'Remote India',
          address: {
            postalAddress: {
              addressCountry: 'India',
              addressLocality: 'Bengaluru',
              addressRegion: 'Karnataka',
            },
          },
        },
      ],
      publishedAt: '2026-07-24T10:00:00.000Z',
      isListed: true,
      isRemote: true,
      workplaceType: 'Remote',
      address: {
        postalAddress: {
          addressCountry: 'United States',
        },
      },
      jobUrl: 'https://jobs.ashbyhq.com/prefect/platform-engineer-india',
      applyUrl: 'https://jobs.ashbyhq.com/prefect/platform-engineer-india/application',
      descriptionPlain: 'Build and operate Prefect platform infrastructure.',
    },
    {
      id: 'product-engineer-us',
      title: 'Product Engineer (Fullstack, Cloud)',
      department: 'Engineering',
      team: 'Cloud',
      employmentType: 'FullTime',
      location: 'Remote',
      secondaryLocations: [],
      publishedAt: '2026-07-24T11:00:00.000Z',
      isListed: true,
      isRemote: true,
      workplaceType: 'Remote',
      address: {
        postalAddress: {
          addressCountry: 'United States',
        },
      },
      jobUrl: 'https://jobs.ashbyhq.com/prefect/product-engineer-us',
      applyUrl: 'https://jobs.ashbyhq.com/prefect/product-engineer-us/application',
      descriptionPlain: 'Build product experiences for Prefect Cloud.',
    },
    {
      id: 'ignore-me',
      title: 'Unlisted Role',
      department: 'Operations',
      employmentType: 'Contract',
      location: 'India',
      secondaryLocations: [],
      publishedAt: '2026-07-20T00:00:00.000Z',
      isListed: false,
      isRemote: false,
      workplaceType: 'OnSite',
      address: {
        postalAddress: {
          addressCountry: 'India',
        },
      },
      jobUrl: 'https://jobs.ashbyhq.com/prefect/ignore-me',
      applyUrl: 'https://jobs.ashbyhq.com/prefect/ignore-me/application',
      descriptionPlain: 'This role should be ignored.',
    },
  ],
}

const nonIndiaPayload = {
  jobs: ashbyPayload.jobs.filter((job) => job.id !== 'platform-engineer-india'),
}

const loadPrefectModule = async () => {
  try {
    return await import('../../scraper/prefect/script.js')
  } catch {
    assert.fail('Expected Prefect scraper module at ../../scraper/prefect/script.js')
  }
}

test('Prefect pins the verified first-party company page and Ashby endpoints', async () => {
  const prefect = await loadPrefectModule()

  assert.equal(prefect.SOURCE, 'prefect')
  assert.equal(prefect.COMPANY, 'Prefect')
  assert.equal(prefect.COMPANY_PAGE_URL, 'https://www.prefect.io/company')
  assert.equal(prefect.CAREERS_PAGE_URL, 'https://www.prefect.io/careers')
  assert.equal(prefect.ASHBY_PUBLIC_BOARD_URL, 'https://jobs.ashbyhq.com/prefect')
  assert.equal(
    prefect.ASHBY_JOB_BOARD_URL,
    'https://api.ashbyhq.com/posting-api/job-board/prefect',
  )
  assert.equal(prefect.hasVerifiedCompanyPageSignal(companyHtml), true)
  assert.equal(
    prefect.extractVerifiedAshbyPublicBoardUrl(companyHtml),
    'https://jobs.ashbyhq.com/prefect',
  )
  assert.equal(
    prefect.buildAshbyJobBoardUrl('https://jobs.ashbyhq.com/prefect'),
    'https://api.ashbyhq.com/posting-api/job-board/prefect',
  )
})

test('Prefect extracts only listed India jobs from the verified Ashby payload', async () => {
  const prefect = await loadPrefectModule()
  const jobs = prefect.extractAshbyJobs(ashbyPayload)

  assert.deepEqual(jobs, [
    {
      title: 'Platform Engineer',
      company: 'Prefect',
      department: 'Engineering',
      location: 'Remote India',
      city: 'Bengaluru',
      state: 'Karnataka',
      country: 'India',
      jobId: 'platform-engineer-india',
      requisitionId: 'platform-engineer-india',
      sourceUrl: 'https://jobs.ashbyhq.com/prefect/platform-engineer-india',
      applyUrl: 'https://jobs.ashbyhq.com/prefect/platform-engineer-india/application',
      employmentType: 'Full Time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-24T10:00:00.000Z',
      closingDate: null,
      jobDescription: 'Build and operate Prefect platform infrastructure.',
      remoteStatus: 'Remote',
    },
  ])
})

test('Prefect original public replay now verifies configured board scope while retaining company scope limits',async()=>{
  const mock=replay(),provider=getScraperCatalog().find(row=>row.source==='prefect')
  const jobs=await createCatalogScraper(provider).run(mock.options),audit=mock.audits[0]
  assert.equal(mock.audits.length,1)
  assert.equal(readInventoryEvidence(jobs).listingComplete,true)
  assert.equal(readInventoryEvidence(jobs).reportedTotal,fixture.oracle.prefect.records.length)
  assert.equal(audit.sourceScopeComplete,false)
  assert.equal(audit.authoritativeSourceTotal,null)
  for(const expected of fixture.oracle.prefect.records){
    const row=audit.observations.find(row=>row.jobId===expected.id)
    assert.deepEqual(row.sourceNativeListingRecord,expected.originalFeedRecord)
    assert.ok(row.jobDescription.includes(expected.bodyText))
    assert.equal(row.sourceDetailComplete,true)
    assert.equal(row.lifecycleCleanupAllowed,false)
  }
})

test('Prefect original closing corporate failure withholds candidates and complete inventory',async()=>{
  const url=fixture.profiles.prefect.primaryURL
  const mock=replay((target,page,visit)=>target===url&&visit===2?{...page,status:502}:page)
  const provider=getScraperCatalog().find(row=>row.source==='prefect')
  const jobs=await createCatalogScraper(provider).run(mock.options)
  assert.equal(jobs.length,0)
  assert.equal(readInventoryEvidence(jobs).listingComplete,false)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount,null)
})
