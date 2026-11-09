import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-17T10:45:00.000Z'

const careersPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career with TransformHub | Award Winning Digital Solutions Company</title>
  </head>
  <body>
    <main>
      <h1>Careers</h1>
      <p>If You Can Understand Accountability , Join Us!</p>
      <h2>Transforming Careers</h2>
      <p>
        If you are a curious, creative, and solution-driven individual, look through our
        current hiring positions that best match your skills and interest.
      </p>
      <h2>Current Openings</h2>

      <h3>DEVSECOPS - SENIOR ENGINEER</h3>
      <p>Location: Vietnam &amp; Pan India</p>
      <p>Responsibilities: Lead DevSecOps initiatives and secure delivery pipelines.</p>
      <p>Skills: Kubernetes, CI/CD, cloud security.</p>
      <a href="#apply-now-devsecops">Apply Now</a>

      <h3>DATA ANALYST</h3>
      <p>Location: Vietnam</p>
      <p>Responsibilities: Build dashboards and analyze program trends.</p>
      <p>Skills: SQL, BI tools.</p>
      <a href="#apply-now-data-analyst">Apply Now</a>

      <h3>ZOHO DEVELOPER</h3>
      <p>Location: Navi Mumbai</p>
      <p>Responsibilities: Deliver Zoho platform customizations for enterprise workflows.</p>
      <p>Skills: Deluge, Zoho Creator, CRM integrations.</p>
      <a href="#apply-now-zoho-developer">Apply Now</a>
      <h2>Benefits of Working at TransformHub</h2>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/transformhub/script.js')
  } catch {
    assert.fail('Expected TransformHub scraper module at ../../scraper/transformhub/script.js')
  }
}

test('TransformHub helpers stay pinned to the verified first-party inline openings contract from Friday, July 17, 2026', async () => {
  const transformHub = await loadModule()

  assert.equal(transformHub.SOURCE, 'transformhub')
  assert.equal(transformHub.COMPANY, 'TransformHub')
  assert.equal(transformHub.HOMEPAGE_URL, 'https://www.transformhub.com/')
  assert.equal(transformHub.CAREERS_URL, 'https://www.transformhub.com/career')
  assert.equal(transformHub.VERIFIED_ON, '2026-07-17')
  assert.match(transformHub.VERIFIED_SURFACE_SUMMARY, /Current Openings/i)
  assert.equal(transformHub.hasOfficialCareersPageSignal(careersPageHtml), true)
})

test('TransformHub extracts India-relevant inline job sections from the verified first-party careers page', async () => {
  const transformHub = await loadModule()
  const jobs = transformHub.extractInlineJobs(careersPageHtml, {
    scrapedAt: FIXED_SCRAPED_AT,
  })

  assert.deepEqual(jobs, [
    {
      title: 'DEVSECOPS - SENIOR ENGINEER',
      company: 'TransformHub',
      department: null,
      location: 'Vietnam & Pan India',
      city: 'Pan India',
      country: 'India',
      link: 'https://www.transformhub.com/career',
      applyUrl: 'https://www.transformhub.com/career',
      sourceUrl: 'https://www.transformhub.com/career',
      source: 'transformhub',
      jobId: 'devsecops-senior-engineer-vietnam-pan-india',
      requisitionId: null,
      employmentType: null,
      experienceRequired: null,
      jobDescription:
        'Responsibilities: Lead DevSecOps initiatives and secure delivery pipelines. Skills: Kubernetes, CI/CD, cloud security. Apply Now',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      remoteStatus: null,
      scrapedAt: FIXED_SCRAPED_AT,
    },
    {
      title: 'ZOHO DEVELOPER',
      company: 'TransformHub',
      department: null,
      location: 'Navi Mumbai, India',
      city: 'Navi Mumbai',
      country: 'India',
      link: 'https://www.transformhub.com/career',
      applyUrl: 'https://www.transformhub.com/career',
      sourceUrl: 'https://www.transformhub.com/career',
      source: 'transformhub',
      jobId: 'zoho-developer-navi-mumbai-india',
      requisitionId: null,
      employmentType: null,
      experienceRequired: null,
      jobDescription:
        'Responsibilities: Deliver Zoho platform customizations for enterprise workflows. Skills: Deluge, Zoho Creator, CRM integrations. Apply Now',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      remoteStatus: null,
      scrapedAt: FIXED_SCRAPED_AT,
    },
  ])
})

test('TransformHub run validates the official careers page and returns normalized inline India jobs', async () => {
  const transformHub = await loadModule()
  const requestedUrls = []

  const jobs = await transformHub.createTransformHubScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === transformHub.CAREERS_URL) {
        return careersPageHtml
      }

      throw new Error(`Unexpected TransformHub text URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [transformHub.CAREERS_URL])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].title, 'DEVSECOPS - SENIOR ENGINEER')
  assert.equal(jobs[1].title, 'ZOHO DEVELOPER')
  assert.equal(jobs[1].companyDomain, 'transformhub.com')
  assert.equal(jobs[1].companyCareerPage, 'https://www.transformhub.com/career')
  assert.equal(jobs[1].atsPlatform, 'official-company-careers')
})

test('TransformHub fails closed when the verified careers shell drifts or stops exposing India-relevant inline jobs', async () => {
  const transformHub = await loadModule()

  await assert.rejects(
    transformHub.createTransformHubScraper().run({
      fetchText: async () => '<html><body><h1>Careers</h1></body></html>',
    }),
    /verified TransformHub careers page/i,
  )

  await assert.rejects(
    transformHub.createTransformHubScraper().run({
      fetchText: async () => `
        <!doctype html>
        <html>
          <head>
            <title>Career with TransformHub | Award Winning Digital Solutions Company</title>
          </head>
          <body>
            <main>
              <h1>Careers</h1>
              <p>If You Can Understand Accountability , Join Us!</p>
              <h2>Transforming Careers</h2>
              <h2>Current Openings</h2>
              <h3>DATA ANALYST</h3>
              <p>Location: Vietnam</p>
              <a href="#apply-now-data-analyst">Apply Now</a>
              <h2>Benefits of Working at TransformHub</h2>
            </main>
          </body>
        </html>
      `,
    }),
    /no longer exposes normalized inline india jobs/i,
  )
})
