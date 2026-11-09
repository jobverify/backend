import assert from 'node:assert/strict'
import test from 'node:test'

const loadSenecaModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Seneca Global IT Services scraper module at ./script.js')
  }
}

const careersHtml = `
<!DOCTYPE html>
<html lang="en-US">
  <head>
    <title>India Careers - Seneca Global</title>
  </head>
  <body>
    <main>
      <h1>India-Based Career Opportunities</h1>
      <p>Be part of a winning team. Discover your new career at SenecaGlobal.</p>
      <h2>Open positions</h2>
      <div class="career-item">
        <h2 class="h3 career-title">
          <a href='https://www.senecaglobal.com/india-careers/senior-qa-lead/' title='Senior QA Lead'>Senior QA Lead</a>
        </h2>
        <div class="fl-post-meta">Hyderabad</div>
        <div class="fl-post-more-link">
          <a href='https://www.senecaglobal.com/india-careers/senior-qa-lead/' title='Read More'>Read More</a>
        </div>
      </div>
      <div class="career-item">
        <h2 class="h3 career-title">
          <a href='https://www.senecaglobal.com/india-careers/scrum-master/' title='Scrum Master'>Scrum Master</a>
        </h2>
        <div class="fl-post-meta">Remote, India</div>
      </div>
    </main>
  </body>
</html>
`

const detailHtml = `
<!DOCTYPE html>
<html lang="en-US">
  <head>
    <title>Senior QA Lead - SenecaGlobal</title>
    <link rel="canonical" href="https://www.senecaglobal.com/india-careers/senior-qa-lead/" />
    <meta property="og:description" content="Own QA strategy across multiple products." />
  </head>
  <body>
    <main><h1>Senior QA Lead</h1></main>
  </body>
</html>
`

test('Seneca scraper recognizes the current India careers shell and quote-agnostic job cards', async () => {
  const seneca = await loadSenecaModule()

  assert.equal(seneca.SOURCE, 'senecaglobalitservices')
  assert.equal(seneca.COMPANY, 'Seneca Global IT Services')
  assert.equal(seneca.CAREERS_URL, 'https://www.senecaglobal.com/careers/india-careers/')
  assert.equal(seneca.VERIFIED_ON, '2026-08-04')

  assert.equal(seneca.hasOfficialCareersSignal(careersHtml), true)
  assert.deepEqual(seneca.extractJobCards(careersHtml), [
    {
      title: 'Senior QA Lead',
      detailUrl: 'https://www.senecaglobal.com/india-careers/senior-qa-lead/',
    },
    {
      title: 'Scrum Master',
      detailUrl: 'https://www.senecaglobal.com/india-careers/scrum-master/',
    },
  ])
  assert.equal(seneca.hasOfficialJobDetailSignal(detailHtml), true)
})

test('Seneca scraper normalizes detail pages into jobs', async () => {
  const seneca = await loadSenecaModule()
  const job = seneca.extractJobFromDetailHtml(
    detailHtml,
    {
      title: 'Senior QA Lead',
      detailUrl: 'https://www.senecaglobal.com/india-careers/senior-qa-lead/',
    },
    { scrapedAt: '2026-08-04T00:00:00.000Z' },
  )

  assert.deepEqual(job, {
    jobId: 'senior-qa-lead',
    title: 'Senior QA Lead',
    company: 'Seneca Global IT Services',
    department: null,
    location: 'India',
    city: null,
    country: 'India',
    sourceUrl: 'https://www.senecaglobal.com/india-careers/senior-qa-lead/',
    applyUrl: 'https://www.senecaglobal.com/india-careers/senior-qa-lead/',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Own QA strategy across multiple products.',
    publicExperienceChecked: true,
    requisitionId: 'senior-qa-lead',
    source: 'senecaglobalitservices',
    link: 'https://www.senecaglobal.com/india-careers/senior-qa-lead/',
    scrapedAt: '2026-08-04T00:00:00.000Z',
  })
})

test('Seneca scraper returns live jobs from the verified listing and detail pages', async () => {
  const seneca = await loadSenecaModule()
  const requestedUrls = []

  const jobs = await seneca.createSenecaGlobalITServicesScraper({
    now: () => '2026-08-04T00:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === seneca.CAREERS_URL) return careersHtml
      if (url === 'https://www.senecaglobal.com/india-careers/senior-qa-lead/') return detailHtml
      if (url === 'https://www.senecaglobal.com/india-careers/scrum-master/') {
        return detailHtml
          .replace(/Senior QA Lead/g, 'Scrum Master')
          .replace(/senior-qa-lead/g, 'scrum-master')
          .replace('Own QA strategy across multiple products.', 'Drive agile ceremonies and delivery planning.')
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    seneca.CAREERS_URL,
    'https://www.senecaglobal.com/india-careers/senior-qa-lead/',
    'https://www.senecaglobal.com/india-careers/scrum-master/',
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].title, 'Senior QA Lead')
  assert.equal(jobs[1].title, 'Scrum Master')
})
