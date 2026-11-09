import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-08-14T00:00:00.000Z'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Sanghvi Movers | Join Asia&#039;s Largest Crane Leader</title>
  </head>
  <body>
    <main>
      <h1>Join Our Team</h1>

      <section class="job-card">
        <h2>Lead Engineers Civil (Solar)</h2>
        <p>Job ID :</p>
        <p>Job Title : Lead Engineers Civil (Solar)</p>
        <p>Job Description : As the Lead Engineer – Civil in the solar division, should be responsible for overseeing the civil engineering aspects of solar energy projects from conception to completion.</p>
        <p>Key Skills :</p>
        <ol>
          <li>Proficiency in computer-aided design (CAD) software.</li>
          <li>Strong understanding of structural engineering principles.</li>
        </ol>
        <p>Job Location : PAN India</p>
        <p>No. of Positions : 2</p>
        <a href="#apply-solar">Apply Now</a>
      </section>

      <section class="job-card">
        <h2>Area Operations Manager</h2>
        <p>Job ID :</p>
        <p>Job Title : Area Operations Manager</p>
        <p>Key Skills :</p>
        <ol>
          <li>Leadership and motivation.</li>
          <li>Analytical and problem solving.</li>
        </ol>
        <p>Work Experience (Min & Max in years) : 3-7 yrs</p>
        <p>Qualification : Degree in Civil Engineering (Four Years Full time)</p>
        <p>No. of Positions : 5</p>
        <a href="#apply-operations">Apply Now</a>
      </section>

      <section class="job-card">
        <h2>WTG Installation Engineer</h2>
        <p>Job ID :</p>
        <p>Job Title : WTG Installation Engineer</p>
        <p>Roles & Responsibilities :</p>
        <ol>
          <li>Supervise the installation works and on-site QA.</li>
          <li>Provide support for installation manager.</li>
        </ol>
        <p>Work Experience (Min & Max in years) : 3 to 7 yrs</p>
        <p>Job Location : PAN India</p>
        <p>No. of Positions : 6</p>
        <a href="#apply-wtg">Apply Now</a>
      </section>
    </main>
  </body>
</html>
`

const noJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Sanghvi Movers | Join Asia&#039;s Largest Crane Leader</title>
  </head>
  <body>
    <main>
      <h1>Join Our Team</h1>
      <p>Life at Sanghvi Movers Limited</p>
    </main>
  </body>
</html>
`

const loadSanghviMoversModule = async () => {
  try {
    return await import('../../scraper/sanghvimovers/script.js')
  } catch {
    assert.fail('Expected Sanghvi Movers scraper module at ../../scraper/sanghvimovers/script.js')
  }
}

test('Sanghvi Movers pins the verified first-party static careers page contract', async () => {
  const sanghviMovers = await loadSanghviMoversModule()

  assert.equal(sanghviMovers.SOURCE, 'sanghvimovers')
  assert.equal(sanghviMovers.COMPANY, 'Sanghvi Movers')
  assert.equal(sanghviMovers.CAREERS_URL, 'https://sanghvicranes.com/careers/')
  assert.equal(sanghviMovers.VERIFIED_ON, '2026-08-14')
  assert.equal(sanghviMovers.hasVerifiedCareersPageSignal(careersHtml), true)
  assert.equal(sanghviMovers.hasPublicJobSignals(careersHtml), true)
  assert.equal(sanghviMovers.hasPublicJobSignals(noJobsHtml), false)

  const jobs = sanghviMovers.extractStaticJobs(careersHtml, {
    scrapedAt: FIXED_SCRAPED_AT,
  })

  assert.deepEqual(jobs, [
    {
      title: 'Lead Engineers Civil (Solar)',
      company: 'Sanghvi Movers',
      department: null,
      location: 'PAN India',
      city: null,
      state: null,
      country: 'India',
      workplaceType: null,
      jobId: 'lead-engineers-civil-solar-pan-india',
      requisitionId: 'lead-engineers-civil-solar-pan-india',
      sourceUrl: 'https://sanghvicranes.com/careers/',
      applyUrl: 'https://sanghvicranes.com/careers/',
      link: 'https://sanghvicranes.com/careers/',
      source: 'sanghvimovers',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [
        'Proficiency in computer-aided design (CAD) software.',
        'Strong understanding of structural engineering principles.',
      ],
      postingDate: null,
      closingDate: null,
      jobDescription: 'As the Lead Engineer – Civil in the solar division, should be responsible for overseeing the civil engineering aspects of solar energy projects from conception to completion.',
      scrapedAt: FIXED_SCRAPED_AT,
    },
    {
      title: 'Area Operations Manager',
      company: 'Sanghvi Movers',
      department: null,
      location: 'India',
      city: null,
      state: null,
      country: 'India',
      workplaceType: null,
      jobId: 'area-operations-manager-india',
      requisitionId: 'area-operations-manager-india',
      sourceUrl: 'https://sanghvicranes.com/careers/',
      applyUrl: 'https://sanghvicranes.com/careers/',
      link: 'https://sanghvicranes.com/careers/',
      source: 'sanghvimovers',
      employmentType: null,
      experienceRequired: '3-7 yrs',
      minimumQualification: 'Degree in Civil Engineering (Four Years Full time)',
      preferredQualification: null,
      requiredSkills: [
        'Leadership and motivation.',
        'Analytical and problem solving.',
      ],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      scrapedAt: FIXED_SCRAPED_AT,
    },
    {
      title: 'WTG Installation Engineer',
      company: 'Sanghvi Movers',
      department: null,
      location: 'PAN India',
      city: null,
      state: null,
      country: 'India',
      workplaceType: null,
      jobId: 'wtg-installation-engineer-pan-india',
      requisitionId: 'wtg-installation-engineer-pan-india',
      sourceUrl: 'https://sanghvicranes.com/careers/',
      applyUrl: 'https://sanghvicranes.com/careers/',
      link: 'https://sanghvicranes.com/careers/',
      source: 'sanghvimovers',
      employmentType: null,
      experienceRequired: '3 to 7 yrs',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [
        'Supervise the installation works and on-site QA.',
        'Provide support for installation manager.',
      ],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      scrapedAt: FIXED_SCRAPED_AT,
    },
  ])
})

test('Sanghvi Movers run validates the official careers page and returns normalized static jobs', async () => {
  const sanghviMovers = await loadSanghviMoversModule()
  const requestedUrls = []

  const jobs = await sanghviMovers.createSanghviMoversScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === sanghviMovers.CAREERS_URL) return careersHtml
      throw new Error(`Unexpected Sanghvi Movers URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [sanghviMovers.CAREERS_URL])
  assert.equal(jobs.length, 3)
  assert.equal(jobs[0].source, 'sanghvimovers')
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
})

test('Sanghvi Movers default fetch falls back to lenient HTTPS on certificate failures', async () => {
  const sanghviMovers = await loadSanghviMoversModule()
  const certificateError = new TypeError('fetch failed')
  certificateError.cause = new Error('unable to verify the first certificate')
  certificateError.cause.code = 'UNABLE_TO_VERIFY_LEAF_SIGNATURE'

  const html = await sanghviMovers.defaultFetchText(sanghviMovers.CAREERS_URL, {
    fetchImpl: async () => {
      throw certificateError
    },
    lenientFetchText: async (url, { timeoutMs }) => {
      assert.equal(url, sanghviMovers.CAREERS_URL)
      assert.equal(timeoutMs, 15000)
      return careersHtml
    },
  })

  assert.equal(html, careersHtml)
})

test('Sanghvi Movers fails closed when the verified careers surface drifts or stops exposing public jobs', async () => {
  const sanghviMovers = await loadSanghviMoversModule()

  await assert.rejects(
    sanghviMovers.createSanghviMoversScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
    }),
    /verified sanghvi movers careers page/i,
  )

  await assert.rejects(
    sanghviMovers.createSanghviMoversScraper().run({
      fetchText: async () => noJobsHtml,
    }),
    /public jobs surface/i,
  )
})
