import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-18T00:00:00.000Z'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Your career journey starts here | Techugo</title>
  </head>
  <body>
    <main>
      <h1>Together At Techugo</h1>
      <h2>Current Openings</h2>
      <h3>Join Us To Revolutionize The Future Of Technology</h3>
      <ul class="opening-list">
        <li>
          <a href="/career/job_openings?type=14">Node.js developer</a>
          <span>Exp: 3 to 6 years</span>
        </li>
        <li>
          <a href="/career/job_openings?type=44">QA Manual Engineer</a>
          <span>Exp: 3 to 5 years</span>
        </li>
        <li>
          <a href="/career/job_openings?type=35">Content Writer</a>
          <span>Exp: 2 to 3 years</span>
        </li>
      </ul>
    </main>
  </body>
</html>
`

const nodeDetailHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h2>Node.js developer (3-6 years)</h2>
      <h3>Description</h3>
      <p>A Node.js developer is responsible for writing server-side web application logic in JavaScript.</p>
      <h4>Skills</h4>
      <ul>
        <li>Experience of developing REST-based API</li>
        <li>Familiarity with SQL Server, MYSQL, MongoDB and other NoSQL database</li>
      </ul>
      <h4>Responsibilities</h4>
      <ul>
        <li>Should have worked on at least one Node.js based framework</li>
        <li>Must have worked on Agile development methodologies</li>
      </ul>
    </main>
  </body>
</html>
`

const qaDetailHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h2>QA Manual Engineer (3-5 years)</h2>
      <h3>Description</h3>
      <p>We are looking to hire a results-driven mobile test engineer.</p>
      <h4>Skills</h4>
      <ul>
        <li>Should have knowledge of mobile app and website testing</li>
        <li>API testing and database testing</li>
      </ul>
      <h4>Responsibilities</h4>
      <ul>
        <li>Testing mobile devices and live applications</li>
        <li>Producing clear and concise test reports</li>
      </ul>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/techugo/script.js')
  } catch {
    assert.fail('Expected Techugo scraper module at ../../scraper/techugo/script.js')
  }
}

test('Techugo helpers stay pinned to the verified first-party careers and role pages', async () => {
  const techugo = await loadModule()

  assert.equal(techugo.SOURCE, 'techugo')
  assert.equal(techugo.COMPANY, 'Techugo')
  assert.equal(techugo.CAREERS_URL, 'https://www.techugo.com/career')
  assert.equal(techugo.VERIFIED_ON, '2026-07-18')
  assert.equal(techugo.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(techugo.hasOfficialCareersSignal('<html><body><h1>Techugo</h1></body></html>'), false)
  assert.deepEqual(techugo.extractRoleSummaries(careersHtml), [
    {
      title: 'Node.js developer',
      detailUrl: 'https://www.techugo.com/career/job_openings?type=14',
      experienceRequired: '3 to 6 years',
      jobId: '14',
      requisitionId: '14',
    },
    {
      title: 'QA Manual Engineer',
      detailUrl: 'https://www.techugo.com/career/job_openings?type=44',
      experienceRequired: '3 to 5 years',
      jobId: '44',
      requisitionId: '44',
    },
    {
      title: 'Content Writer',
      detailUrl: 'https://www.techugo.com/career/job_openings?type=35',
      experienceRequired: '2 to 3 years',
      jobId: '35',
      requisitionId: '35',
    },
  ])

  const nodeDetail = techugo.extractRoleDetail(nodeDetailHtml, techugo.extractRoleSummaries(careersHtml)[0])
  assert.equal(nodeDetail.location, 'Remote, India')
  assert.equal(nodeDetail.remoteStatus, 'Remote')
  assert.equal(nodeDetail.experienceRequired, '3-6 years')
  assert.deepEqual(nodeDetail.requiredSkills, [
    'Experience of developing REST-based API',
    'Familiarity with SQL Server, MYSQL, MongoDB and other NoSQL database',
    'Should have worked on at least one Node.js based framework',
    'Must have worked on Agile development methodologies',
  ])
})

test('Techugo run validates the verified careers page before hydrating linked role pages', async () => {
  const techugo = await loadModule()
  const requestedUrls = []

  const jobs = await techugo.createTechugoScraper({ maxJobs: 2 }).run({
    now: () => FIXED_SCRAPED_AT,
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === techugo.CAREERS_URL) return careersHtml
      if (url === 'https://www.techugo.com/career/job_openings?type=14') return nodeDetailHtml
      if (url === 'https://www.techugo.com/career/job_openings?type=44') return qaDetailHtml
      throw new Error(`Unexpected Techugo URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    techugo.CAREERS_URL,
    'https://www.techugo.com/career/job_openings?type=14',
    'https://www.techugo.com/career/job_openings?type=44',
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'techugo')
  assert.equal(jobs[0].link, 'https://www.techugo.com/career/job_openings?type=14')
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
  assert.equal(jobs[1].title, 'QA Manual Engineer')
})

test('Techugo run fails closed when the verified careers surface drifts', async () => {
  const techugo = await loadModule()

  await assert.rejects(
    techugo.createTechugoScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
    }),
    /verified techugo careers surface/i,
  )
})
