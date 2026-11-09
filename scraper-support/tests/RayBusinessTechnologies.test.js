import assert from 'node:assert/strict'
import test from 'node:test'

const careersShellHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Ray Business Technologies Careers - Discover a World of Opportunities</title>
  </head>
  <body>
    <h4>Search Jobs</h4>
    <h1>Careers</h1>
    <a href="/about-us/careers/current-openings">Current Openings</a>
    <p>Ray Business Technologies Pvt. Ltd. is an equal opportunities employer.</p>
    <p>Working with us is not a job. It&#39;s a journey.</p>
    <div class="panel panel-default">
      <div class="panel-heading">
        <h4>Senior AI/ML Engineer<small>Experience: 5+ Years</small></h4>
      </div>
      <div class="panel-collapse collapse">
        <div class="panel-body circle-dot black-dot">
          <p>Location: Hyderabad, India</p>
          <p>Employment Type: Full-time</p>
          <p>Apply Online or Mail your CVs to [email&#160;protected]</p>
        </div>
      </div>
    </div>
    <div class="panel panel-default">
      <div class="panel-heading">
        <h4>Dotnet Developer<small>Experience: 4-7 Years</small></h4>
      </div>
      <div class="panel-collapse collapse">
        <div class="panel-body circle-dot black-dot">
          <p>Location: Indore (Work from Office)</p>
          <p>Employment Type: Full-time</p>
          <p>Apply Online or Mail your CVs to [email&#160;protected]</p>
        </div>
      </div>
    </div>
    <div class="panel panel-default">
      <div class="panel-heading">
        <h4>Software Developer<small>Experience: 5 Years</small></h4>
      </div>
      <div class="panel-collapse collapse">
        <div class="panel-body circle-dot black-dot">
          <p>Work Location: Plano, TX (and various unanticipated client locations throughout the U.S.)</p>
          <p>Employment Type: Full-time</p>
        </div>
      </div>
    </div>
  </body>
</html>
`

const loadProviderModule = async () => {
  try {
    return await import('../../scraper/raybusinesstechnologies/provider.js')
  } catch {
    assert.fail('Expected Ray Business Technologies provider module at ../../scraper/raybusinesstechnologies/provider.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/raybusinesstechnologies/script.js')
  } catch {
    assert.fail('Expected Ray Business Technologies scraper module at ../../scraper/raybusinesstechnologies/script.js')
  }
}

test('Ray Business Technologies exports the verified fail-closed exact-name contract', async () => {
  const providerModule = await loadProviderModule()
  const scriptModule = await loadScriptModule()

  assert.deepEqual(providerModule.provider, {
    source: 'raybusinesstechnologies',
    companyName: 'Ray Business Technologies',
    officialBrandName: 'Ray Business Technologies Pvt. Ltd.',
    adapter: 'script',
    modulePath: '../../scraper/raybusinesstechnologies/script.js',
    homepageUrl: 'https://raybiztech.com/',
    companyCareerPage: 'https://raybiztech.com/about-us/careers/current-openings',
    atsPlatform: 'official-company-careers',
    countryFilter: 'India',
    paginationStrategy: 'single-page-accordion-list',
    extractionStrategy: 'verified-first-party-careers-page+public-accordion-openings+india-location-filter',
    parser: 'custom-script',
    normalizationProfile: 'engineering-default',
    companyDomain: 'raybiztech.com',
    verifiedOn: '2026-08-04',
    verifiedSurfaceSummary:
      'Verified on Tuesday, August 4, 2026 that https://raybiztech.com/about-us/careers/current-openings is the live first-party Ray Business Technologies careers page and that its public accordion markup now exposes accessible opening titles and descriptions directly in the fetched HTML. The public surface includes current India openings such as Senior AI/ML Engineer, Dotnet Developer, HR Executive, and Boomi Developer, while also listing at least one explicit US-only role. This scraper validates the exact first-party page shell, extracts the public accordion openings, and returns only conservative India-eligible jobs.',
    dryRunFile: 'raybusinesstechnologies/jobs.json',
  })

  assert.equal(scriptModule.SOURCE, providerModule.provider.source)
  assert.equal(scriptModule.COMPANY, providerModule.provider.companyName)
  assert.equal(scriptModule.CAREERS_URL, providerModule.provider.companyCareerPage)
  assert.deepEqual(scriptModule.PROVIDER_METADATA, providerModule.provider)
})

test('Ray Business Technologies validates the verified careers shell and extracts public India openings', async () => {
  const ray = await loadScriptModule()

  assert.equal(ray.hasOfficialCareersShellSignal(careersShellHtml), true)
  assert.equal(ray.hasTrustworthyPublicJobsSignal(careersShellHtml), true)
  assert.deepEqual(
    ray.extractJobs(careersShellHtml).map((job) => [job.title, job.location, job.jobId, job.applyUrl]),
    [
      [
        'Senior AI/ML Engineer',
        'Hyderabad, India',
        'senior-ai-ml-engineer-hyderabad-india',
        'https://raybiztech.com/about-us/careers/apply-online',
      ],
      [
        'Dotnet Developer',
        'Indore, India',
        'dotnet-developer-indore-india',
        'https://raybiztech.com/about-us/careers/apply-online',
      ],
    ],
  )

  const jobs = await ray.run({
    fetchText: async (url) => {
      assert.equal(url, ray.CAREERS_URL)
      return careersShellHtml
    },
  })

  assert.equal(jobs.length, 2)
  assert.deepEqual(
    jobs.map((job) => [job.title, job.location, job.companyCareerPage, job.companyDomain, job.atsPlatform]),
    [
      [
        'Senior AI/ML Engineer',
        'Hyderabad, India',
        'https://raybiztech.com/about-us/careers/current-openings',
        'raybiztech.com',
        'official-company-careers',
      ],
      [
        'Dotnet Developer',
        'Indore, India',
        'https://raybiztech.com/about-us/careers/current-openings',
        'raybiztech.com',
        'official-company-careers',
      ],
    ],
  )
})

test('Ray Business Technologies fails closed if the verified shell drifts or openings disappear', async () => {
  const ray = await loadScriptModule()

  await assert.rejects(
    ray.run({
      fetchText: async () => '<html><body><h1>Jobs</h1></body></html>',
    }),
    /trusted first-party surface/i,
  )

  await assert.rejects(
    ray.run({
      fetchText: async () => `
        <!doctype html>
        <html>
          <head>
            <title>Ray Business Technologies Careers - Discover a World of Opportunities</title>
          </head>
          <body>
            <h4>Search Jobs</h4>
            <h1>Careers</h1>
            <a href="/about-us/careers/current-openings">Current Openings</a>
            <p>Working with us is not a job. It&#39;s a journey.</p>
          </body>
        </html>
      `,
    }),
    /public accordion openings/i,
  )
})
