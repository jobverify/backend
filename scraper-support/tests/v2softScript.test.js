import assert from 'node:assert/strict'
import test from 'node:test'

const CURRENT_CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Explore Career Possibility in India</h1>
      <p>RESTART YOUR CAREER AT V2SOFT!</p>
      <p>JOB OPENINGS</p>
      <h3 class="elementor-heading-title elementor-size-medium">Hadoop + Java</h3>
      <a href="https://marketing.v2soft.com/india-careers/hadoop-java-jobs/">View Job</a>
    </main>
  </body>
</html>
`

const CURRENT_DETAIL_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Hadoop &amp; Java Jobs in Bangalore, India |</title>
  </head>
  <body>
    <main>
      <p>Job#: </p>
      <p>Location: Bangalore, KA</p>
      <p>Job Type: Full Time</p>
      <p>Experience Required: 7+ Years</p>
      <p>Qualification: Bachelor&apos;s Degree in computer science or equivalent</p>
      <p>Skills Required: ETL, Java, Hadoop</p>
      <p>Job Description Design and development of data ingestion pipelines.</p>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/v2soft/script.js')
  } catch {
    assert.fail('Expected V2Soft scraper module at ../../scraper/v2soft/script.js')
  }
}

test('V2Soft extracts the current India careers links from the refreshed listing layout', async () => {
  const v2soft = await loadModule()

  assert.equal(v2soft.SOURCE, 'v2soft')
  assert.equal(v2soft.COMPANY, 'V2soft')
  assert.equal(v2soft.CAREERS_URL, 'https://marketing.v2soft.com/india-careers/')
  assert.equal(v2soft.hasOfficialCareersSignal(CURRENT_CAREERS_HTML), true)
  assert.deepEqual(v2soft.extractJobCards(CURRENT_CAREERS_HTML), [
    {
      title: 'Hadoop + Java',
      location: null,
      detailUrl: 'https://marketing.v2soft.com/india-careers/hadoop-java-jobs/',
    },
  ])
})

test('V2Soft detail parsing falls back to the current slug-based id and text description shell', async () => {
  const v2soft = await loadModule()

  const detail = v2soft.createV2softScraper().run
  assert.equal(typeof detail, 'function')

  const jobs = await v2soft.createV2softScraper({
    now: () => '2026-07-25T12:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      if (url === v2soft.CAREERS_URL) return CURRENT_CAREERS_HTML
      if (url === 'https://marketing.v2soft.com/india-careers/hadoop-java-jobs/') return CURRENT_DETAIL_HTML
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Hadoop & Java Jobs in Bangalore, India',
    company: 'V2soft',
    department: null,
    location: 'Bangalore, KA, India',
    city: 'Bangalore',
    state: 'KA',
    country: 'India',
    jobId: 'hadoop-java-jobs',
    requisitionId: 'hadoop-java-jobs',
    sourceUrl: 'https://marketing.v2soft.com/india-careers/hadoop-java-jobs/',
    applyUrl: 'https://marketing.v2soft.com/india-careers/hadoop-java-jobs/',
    employmentType: 'Full Time',
    experienceRequired: '7+ Years',
    minimumQualification: "Bachelor's Degree in computer science or equivalent",
    preferredQualification: null,
    requiredSkills: ['ETL', 'Java', 'Hadoop'],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Design and development of data ingestion pipelines.',
    source: 'v2soft',
    link: 'https://marketing.v2soft.com/india-careers/hadoop-java-jobs/',
    scrapedAt: '2026-07-25T12:00:00.000Z',
    companyCareerPage: 'https://marketing.v2soft.com/india-careers/',
    companyDomain: 'v2soft.com',
    atsPlatform: 'official-company-careers-inline-listing-and-detail-pages',
  })
})
