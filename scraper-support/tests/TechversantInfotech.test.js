import assert from 'node:assert/strict'
import test from 'node:test'

const loadProviderModule = async () => {
  try {
    return await import('../../scraper/techversantinfotech/provider.js')
  } catch {
    assert.fail('Expected Techversant Infotech provider module at ../../scraper/techversantinfotech/provider.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/techversantinfotech/script.js')
  } catch {
    assert.fail('Expected Techversant Infotech scraper module at ../../scraper/techversantinfotech/script.js')
  }
}

const pageOneHtml = `
  <html>
    <head>
      <title>Job Openings - Techversant Infotech</title>
      <link rel="canonical" href="https://techversantinfotech.com/jobs/" />
      <link rel="next" href="https://techversantinfotech.com/jobs/page/2/" />
    </head>
    <body>
      <div class="isotope-item">
        <article class="awsm_job_openings job-type-full-time job-location-kochi job-location-trivandrum">
          <div class="entry-content">
            <h4 class="entry-title"><a href="https://techversantinfotech.com/jobs/technical-lead-java/">Technical Lead - Java</a></h4>
            <div class="mascot-post-excerpt">We are seeking a strong technical leader who can drive architecture.</div>
          </div>
        </article>
      </div>
      <div class="isotope-item">
        <article class="awsm_job_openings job-type-full-time job-location-kochi">
          <div class="entry-content">
            <h4 class="entry-title"><a href="https://techversantinfotech.com/jobs/data-engineer/">Data Engineer</a></h4>
            <div class="mascot-post-excerpt">We are looking for a skilled and experienced Data Engineer.</div>
          </div>
        </article>
      </div>
      <ul class="pagination">
        <li class="page-item active"><span class="page-link">1</span></li>
        <li class="page-item"><a class="page-link" href="https://techversantinfotech.com/jobs/page/2/">2</a></li>
      </ul>
    </body>
  </html>
`

const pageTwoHtml = `
  <html>
    <head>
      <title>Job Openings - Techversant Infotech</title>
      <link rel="canonical" href="https://techversantinfotech.com/jobs/page/2/" />
    </head>
    <body>
      <div class="isotope-item">
        <article class="awsm_job_openings job-type-full-time job-location-trivandrum">
          <div class="entry-content">
            <h4 class="entry-title"><a href="https://techversantinfotech.com/jobs/team-lead-coldfusion/">Team Lead - ColdFusion</a></h4>
            <div class="mascot-post-excerpt">We are looking for an experienced Senior Full Stack ColdFusion Lead.</div>
          </div>
        </article>
      </div>
    </body>
  </html>
`

test('Techversant Infotech exports local provider metadata for the verified first-party jobs archive', async () => {
  const providerModule = await loadProviderModule()
  const scriptModule = await loadScriptModule()

  assert.deepEqual(providerModule.provider, {
    source: 'techversantinfotech',
    companyName: 'Techversant Infotech',
    officialBrandName: 'Techversant Infotech',
    adapter: 'script',
    modulePath: '../../scraper/techversantinfotech/script.js',
    homepageUrl: 'https://techversantinfotech.com/',
    companyCareerPage: 'https://techversantinfotech.com/jobs/',
    atsPlatform: 'wordpress-job-openings',
    countryFilter: 'India',
    paginationStrategy: 'first-party-jobs-archive-pagination',
    extractionStrategy: 'verified-first-party-jobs-archive+paginated-public-opening-cards',
    parser: 'custom-script',
    normalizationProfile: 'engineering-default',
    companyDomain: 'techversantinfotech.com',
    verifiedOn: '2026-07-18',
    verifiedSurfaceSummary:
      'Verified on Saturday, July 18, 2026 that https://techversantinfotech.com/jobs/ is the live first-party Techversant Infotech jobs archive, that it exposes paginated public opening cards with detail links on the same domain, and that page 1 includes roles such as Technical Lead - Java and Data Engineer.',
    dryRunFile: 'techversantinfotech/jobs.json',
  })

  assert.equal(scriptModule.SOURCE, providerModule.provider.source)
  assert.equal(scriptModule.COMPANY, providerModule.provider.companyName)
  assert.equal(scriptModule.CAREERS_URL, providerModule.provider.companyCareerPage)
  assert.deepEqual(scriptModule.PROVIDER_METADATA, providerModule.provider)
})

test('Techversant Infotech parses paginated first-party opening cards', async () => {
  const techversant = await loadScriptModule()

  assert.equal(techversant.hasOfficialJobsArchiveSignal(pageOneHtml), true)
  assert.deepEqual(
    techversant.extractArchivePageUrls(pageOneHtml),
    [
      'https://techversantinfotech.com/jobs/',
      'https://techversantinfotech.com/jobs/page/2/',
    ],
  )
  assert.equal(techversant.extractJobCards(pageOneHtml).length, 2)

  const jobs = await techversant.run({
    fetchText: async (url) => {
      if (url === techversant.CAREERS_URL) return pageOneHtml
      if (url === 'https://techversantinfotech.com/jobs/page/2/') return pageTwoHtml
      throw new Error(`Unexpected Techversant URL: ${url}`)
    },
  })

  assert.equal(jobs.length, 3)
  assert.deepEqual(
    jobs.map((job) => job.title),
    ['Technical Lead - Java', 'Data Engineer', 'Team Lead - ColdFusion'],
  )
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].source, 'techversantinfotech')
})
