import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Careers</h1>
    <h2>Current Openings</h2>
    <article class="career-card">
      <h3>MS SQL Database Administrator | ThinkSys</h3>
      <p class="location">Noida, India</p>
      <p class="experience">5+ years</p>
      <a href="https://thinksys.com/careers/ms-sql-database-administrator/">Apply Now</a>
    </article>
    <article class="career-card">
      <h3>Talent Acquisition Specialist Jobs at ThinkSys</h3>
      <p class="location">Noida, India</p>
      <p class="experience">3+ years</p>
      <a href="https://thinksys.com/careers/talent-acquisition-specialist/">Apply Now</a>
    </article>
    <article class="career-card">
      <h3>Software Engineer (.NET & React) | ThinkSys</h3>
      <p class="location">Dallas, United States</p>
      <p class="experience">4+ years</p>
      <a href="https://thinksys.com/careers/software-engineer-dotnet-react/">Apply Now</a>
    </article>
  </body>
</html>
`

const sqlDetailHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>MS SQL Database Administrator</h1>
    <h2>Key Responsibilities</h2>
    <ul>
      <li>SQL Server Administration</li>
      <li>Performance Tuning</li>
      <li>Backup and Recovery</li>
    </ul>
    <h2>Requirements</h2>
    <p>5+ years of experience in database administration.</p>
    <a href="https://thinksys.com/careers/ms-sql-database-administrator/#apply">Apply Now</a>
  </body>
</html>
`

const talentDetailHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Talent Acquisition Specialist</h1>
    <h2>Key Responsibilities</h2>
    <ul>
      <li>Recruitment Cycle</li>
      <li>Campus Hiring</li>
      <li>Interview Coordination</li>
    </ul>
    <h2>Requirements</h2>
    <p>3+ years of experience in technical hiring.</p>
    <a href="https://thinksys.com/careers/talent-acquisition-specialist/#apply">Apply Now</a>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/thinksyssoftware/script.js')
  } catch {
    assert.fail('Expected Thinksys Software scraper module at ../../scraper/thinksyssoftware/script.js')
  }
}

test('Thinksys Software helpers stay pinned to the verified first-party careers page', async () => {
  const thinksys = await loadModule()

  assert.equal(thinksys.SOURCE, 'thinksyssoftware')
  assert.equal(thinksys.COMPANY, 'Thinksys Software')
  assert.equal(thinksys.CAREERS_URL, 'https://thinksys.com/careers/')
  assert.equal(thinksys.VERIFIED_ON, '2026-07-18')
  assert.equal(thinksys.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(thinksys.extractJobCards(careersHtml).length, 2)
})

test('Thinksys Software run validates the official careers page and returns only India jobs', async () => {
  const thinksys = await loadModule()
  const requestedUrls = []

  const jobs = await thinksys.createThinksysSoftwareScraper({
    now: () => '2026-07-18T00:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === thinksys.CAREERS_URL) return careersHtml
      if (url === 'https://thinksys.com/careers/ms-sql-database-administrator/') return sqlDetailHtml
      if (url === 'https://thinksys.com/careers/talent-acquisition-specialist/') return talentDetailHtml
      throw new Error(`Unexpected ThinkSys URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://thinksys.com/careers/',
    'https://thinksys.com/careers/ms-sql-database-administrator/',
    'https://thinksys.com/careers/talent-acquisition-specialist/',
  ])
  assert.deepEqual(jobs, [
    {
      title: 'MS SQL Database Administrator',
      company: 'Thinksys Software',
      department: null,
      location: 'Noida, India',
      city: 'Noida',
      country: 'India',
      jobId: 'ms-sql-database-administrator',
      requisitionId: 'ms-sql-database-administrator',
      sourceUrl: 'https://thinksys.com/careers/ms-sql-database-administrator/',
      applyUrl: 'https://thinksys.com/careers/ms-sql-database-administrator/#apply',
      employmentType: null,
      experienceRequired: '5+ years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: ['SQL Server Administration', 'Performance Tuning', 'Backup and Recovery'],
      postingDate: null,
      closingDate: null,
      jobDescription: '5+ years of experience in database administration.',
      remoteStatus: 'On-site',
      source: 'thinksyssoftware',
      link: 'https://thinksys.com/careers/ms-sql-database-administrator/#apply',
      scrapedAt: '2026-07-18T00:00:00.000Z',
    },
    {
      title: 'Talent Acquisition Specialist',
      company: 'Thinksys Software',
      department: null,
      location: 'Noida, India',
      city: 'Noida',
      country: 'India',
      jobId: 'talent-acquisition-specialist',
      requisitionId: 'talent-acquisition-specialist',
      sourceUrl: 'https://thinksys.com/careers/talent-acquisition-specialist/',
      applyUrl: 'https://thinksys.com/careers/talent-acquisition-specialist/#apply',
      employmentType: null,
      experienceRequired: '3+ years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: ['Recruitment Cycle', 'Campus Hiring', 'Interview Coordination'],
      postingDate: null,
      closingDate: null,
      jobDescription: '3+ years of experience in technical hiring.',
      remoteStatus: 'On-site',
      source: 'thinksyssoftware',
      link: 'https://thinksys.com/careers/talent-acquisition-specialist/#apply',
      scrapedAt: '2026-07-18T00:00:00.000Z',
    },
  ])
})

test('Thinksys Software run fails closed when the verified careers surface drifts', async () => {
  const thinksys = await loadModule()

  await assert.rejects(
    thinksys.createThinksysSoftwareScraper().run({
      fetchText: async () => '<html><body><h1>Careers</h1></body></html>',
    }),
    /verified thinksys software careers surface/i,
  )
})
