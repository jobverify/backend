import assert from 'node:assert/strict'
import test from 'node:test'

const ROOT_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <section>
        <h1>Careers@Media.Net</h1>
        <h2>Open Positions</h2>
        <article class="department-card">
          <h3>Data Science &amp; Analytics</h3>
          <a href="/data-science-analytics/">1 Position</a>
        </article>
        <article class="department-card">
          <h3>Engineering</h3>
          <a href="/engineering/">0 Position</a>
        </article>
        <article class="department-card">
          <h3>Business Development</h3>
          <a href="https://careers.media.net/business-development/">4 Positions</a>
        </article>
        <article class="department-card">
          <h3>Product Marketing</h3>
          <a href="/product-marketing/">1 Position</a>
        </article>
        <a href="https://www.media.net/privacy-policy">Privacy Policy</a>
      </section>
    </main>
  </body>
</html>
`

const DATA_SCIENCE_DEPARTMENT_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h2>Data Science &amp; Analytics</h2>
      <h3>Current Openings for Data Science &amp; Analytics</h3>
      <ul>
        <li>
          <a href="/data-science-analytics/analyst-senior-business-analyst-business-analytics/">
            Analyst / Senior Business Analyst - Business Analytics
          </a>
        </li>
      </ul>
    </main>
  </body>
</html>
`

const BUSINESS_DEVELOPMENT_DEPARTMENT_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h2>Business Development</h2>
      <h3>Current Openings for Business Development</h3>
      <ul>
        <li>
          <a href="/business-development/director-agency-partnerships-experience-based/">
            Director, Agency Partnerships (Experience based)
          </a>
        </li>
      </ul>
    </main>
  </body>
</html>
`

const PRODUCT_MARKETING_DEPARTMENT_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h2>Product Marketing</h2>
      <h3>Current Openings for Product Marketing</h3>
      <p>No openings at this time.</p>
    </main>
  </body>
</html>
`

const DATA_SCIENCE_DETAIL_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h2 id="jobProfile">Analyst / Senior Business Analyst - Business Analytics</h2>
      <button type="button">Apply Now</button>
      <div class="post-body">
      <p>Location: Mumbai, India</p>
      <p>Employment Type: Full-time</p>
      <h3>Job Summary</h3>
      <p>We are seeking a highly analytical and data-driven individual to join our dynamic mobile apps business.</p>
      <h3>Qualification and Experience</h3>
      <ul>
        <li>3+ years of proven experience as a Business Analyst or similar role.</li>
        <li>Proficiency in SQL and Python for data analysis.</li>
      </ul>
      </div>
    </main>
  </body>
</html>
`

const BUSINESS_DEVELOPMENT_DETAIL_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h2 id="jobProfile">Director, Agency Partnerships (Experience based)</h2>
      <button type="button">Apply Now</button>
      <div class="post-body">
      <p>Role: Director, Agency Partnerships (Experience based)</p>
      <p>Location: New York</p>
      <p>Function: Buyer Development</p>
      <h3>Overall Responsibility</h3>
      <p>The Director, Agency Partnerships is responsible for developing and nurturing account teams.</p>
      <h3>Basic Requirements</h3>
      <ul>
        <li>4 to 8 years experience in media buying or programmatic advertising.</li>
        <li>Exceptional writing and communication skills.</li>
      </ul>
      </div>
    </main>
  </body>
</html>
`

const loadMediaNetModule = async () => {
  try {
    return await import('../../scraper/medianet/script.js')
  } catch {
    assert.fail('Expected Media.net scraper module at ../../scraper/medianet/script.js')
  }
}

test('hasOfficialCareersSignal validates the verified Media.net careers surface', async () => {
  const medianet = await loadMediaNetModule()

  assert.equal(medianet.CAREERS_URL, 'https://careers.media.net/')
  assert.equal(medianet.hasOfficialCareersSignal(ROOT_HTML), true)
})

test('extractDepartmentUrls keeps only same-host Media.net department pages with active openings', async () => {
  const medianet = await loadMediaNetModule()

  const departmentUrls = medianet.extractDepartmentUrls(ROOT_HTML)

  assert.deepEqual(departmentUrls, [
    'https://careers.media.net/data-science-analytics/',
    'https://careers.media.net/business-development/',
    'https://careers.media.net/product-marketing/',
  ])
})

test('extractListings parses Media.net department pages into detail-page listings', async () => {
  const medianet = await loadMediaNetModule()

  const jobs = medianet.extractListings(DATA_SCIENCE_DEPARTMENT_HTML, {
    departmentUrl: 'https://careers.media.net/data-science-analytics/',
  })

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Analyst / Senior Business Analyst - Business Analytics',
    company: 'Media.net',
    department: 'Data Science & Analytics',
    location: null,
    city: null,
    country: null,
    jobId: null,
    requisitionId: null,
    nativeObservationKey: 'https://careers.media.net/data-science-analytics/analyst-senior-business-analyst-business-analytics/',
    nativeObservationKeyKind: 'published-role-URL-not-a-posting-id',
    sourceUrl: 'https://careers.media.net/data-science-analytics/analyst-senior-business-analyst-business-analytics/',
    applyUrl: 'https://careers.media.net/data-science-analytics/analyst-senior-business-analyst-business-analytics/',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: null,
    remoteStatus: null,
  })
})

test('extractJobDetail lifts Media.net detail fields while keeping the detail page as the apply surface', async () => {
  const medianet = await loadMediaNetModule()

  const listing = medianet.extractListings(BUSINESS_DEVELOPMENT_DEPARTMENT_HTML, {
    departmentUrl: 'https://careers.media.net/business-development/',
  })[0]

  const job = medianet.extractJobDetail(BUSINESS_DEVELOPMENT_DETAIL_HTML, listing)

  assert.equal(job.title, 'Director, Agency Partnerships (Experience based)')
  assert.equal(job.department, 'Business Development')
  assert.equal(job.location, 'New York')
  assert.equal(job.city, null)
  assert.equal(job.country, null, 'A city label alone cannot provide a country')
  assert.equal(job.applyUrl, 'https://careers.media.net/business-development/director-agency-partnerships-experience-based/')
  assert.match(job.jobDescription, /developing and nurturing account teams/i)
  assert.equal(job.minimumQualification, null)
  assert.equal(job.preferredQualification, null)
  assert.deepEqual(job.requiredSkills, [])
  assert.deepEqual(job.nativeRequirementItems, [
    '4 to 8 years experience in media buying or programmatic advertising.',
    'Exceptional writing and communication skills.',
  ])
})

test('run fetches the Media.net root page, active department pages, and detail pages, then decorates runner fields', async () => {
  const medianet = await loadMediaNetModule()
  const requestedUrls = []

  const jobs = await medianet.createMediaNetScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === 'https://careers.media.net/') return ROOT_HTML
      if (url === 'https://careers.media.net/data-science-analytics/') return DATA_SCIENCE_DEPARTMENT_HTML
      if (url === 'https://careers.media.net/business-development/') return BUSINESS_DEVELOPMENT_DEPARTMENT_HTML
      if (url === 'https://careers.media.net/product-marketing/') return PRODUCT_MARKETING_DEPARTMENT_HTML
      if (url === 'https://careers.media.net/data-science-analytics/analyst-senior-business-analyst-business-analytics/') {
        return DATA_SCIENCE_DETAIL_HTML
      }
      if (url === 'https://careers.media.net/business-development/director-agency-partnerships-experience-based/') {
        return BUSINESS_DEVELOPMENT_DETAIL_HTML
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
    now: () => '2026-07-10T12:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    'https://careers.media.net/',
    'https://careers.media.net/data-science-analytics/',
    'https://careers.media.net/data-science-analytics/analyst-senior-business-analyst-business-analytics/',
    'https://careers.media.net/business-development/',
    'https://careers.media.net/business-development/director-agency-partnerships-experience-based/',
    'https://careers.media.net/product-marketing/',
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'medianet')
  assert.equal(jobs[0].link, 'https://careers.media.net/data-science-analytics/analyst-senior-business-analyst-business-analytics/')
  assert.equal(jobs[0].scrapedAt, '2026-07-10T12:00:00.000Z')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[1].country, null)
  assert.ok(jobs.every(job => !job.sourceDetailComplete && !job.sourceScopeComplete && !job.lifecycleCleanupAllowed))
})

test('run fails closed when the Media.net careers surface changes', async () => {
  const medianet = await loadMediaNetModule()

  await assert.rejects(
    medianet.createMediaNetScraper().run({
      fetchText: async () => '<html><body>No public openings here</body></html>',
    }),
    /verified Media\.net careers surface/i,
  )
})
