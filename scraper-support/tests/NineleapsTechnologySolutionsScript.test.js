import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Build with Purpose.</h1>
    <p>Grow with Intent.</p>
    <a href="https://www.nineleaps.com/jobs/">Find Your Role</a>
  </body>
</html>
`

const jobsHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h2>Open Jobs (3)</h2>
    <article class="job-card">
      <h3>Full Stack Developer</h3>
      <p class="location">Bengaluru</p>
      <p class="experience">2-5 years</p>
      <a href="/job/full-stack-developer/">View Details</a>
    </article>
    <article class="job-card">
      <h3>AI Engineer</h3>
      <p class="location">Bengaluru</p>
      <p class="experience">2-4 years</p>
      <a href="/job/ai-engineer/">View Details</a>
    </article>
    <article class="job-card">
      <h3>Account Executive</h3>
      <p class="location">Kansas</p>
      <p class="experience">5-8 years</p>
      <a href="/job/account-executive/">View Details</a>
    </article>
  </body>
</html>
`

const fullStackDetailHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Full Stack Developer</h1>
    <p>Bengaluru</p>
    <p>2-5 years</p>
    <h2>Role Overview</h2>
    <p>Build and maintain scalable web applications across both frontend and backend systems.</p>
    <h2>What We're Looking For</h2>
    <ul>
      <li>React.js</li>
      <li>Node.js</li>
      <li>REST APIs</li>
    </ul>
    <a href="#apply">Apply To This Job</a>
  </body>
</html>
`

const aiEngineerDetailHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>AI Engineer</h1>
    <p>Bengaluru</p>
    <p>2-4 years</p>
    <h2>Role Overview</h2>
    <p>Build, test, and improve machine learning solutions that solve real-world business problems.</p>
    <h2>What We're Looking For</h2>
    <ul>
      <li>Python</li>
      <li>Machine Learning</li>
      <li>LLMs</li>
    </ul>
    <a href="#apply">Apply To This Job</a>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/nineleapstechnologysolutions/script.js')
  } catch {
    assert.fail('Expected Nineleaps Technology Solutions scraper module at ../../scraper/nineleapstechnologysolutions/script.js')
  }
}

test('Nineleaps Technology Solutions helpers stay pinned to the verified first-party job pages', async () => {
  const nineleaps = await loadModule()

  assert.equal(nineleaps.SOURCE, 'nineleapstechnologysolutions')
  assert.equal(nineleaps.COMPANY, 'Nineleaps Technology Solutions')
  assert.equal(nineleaps.CAREERS_PAGE_URL, 'https://www.nineleaps.com/careers/')
  assert.equal(nineleaps.JOBS_PAGE_URL, 'https://www.nineleaps.com/jobs/')
  assert.equal(nineleaps.VERIFIED_ON, '2026-07-18')
  assert.equal(nineleaps.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(nineleaps.hasOfficialJobsSignal(jobsHtml), true)
  assert.equal(nineleaps.extractJobCards(jobsHtml).length, 2)
})

test('Nineleaps Technology Solutions run validates the first-party surfaces and returns India jobs from detail pages', async () => {
  const nineleaps = await loadModule()
  const requestedUrls = []

  const jobs = await nineleaps.createNineleapsTechnologySolutionsScraper({
    now: () => '2026-07-18T00:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === nineleaps.CAREERS_PAGE_URL) return careersHtml
      if (url === nineleaps.JOBS_PAGE_URL) return jobsHtml
      if (url === 'https://www.nineleaps.com/job/full-stack-developer/') return fullStackDetailHtml
      if (url === 'https://www.nineleaps.com/job/ai-engineer/') return aiEngineerDetailHtml
      throw new Error(`Unexpected Nineleaps URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://www.nineleaps.com/careers/',
    'https://www.nineleaps.com/jobs/',
    'https://www.nineleaps.com/job/full-stack-developer/',
    'https://www.nineleaps.com/job/ai-engineer/',
  ])
  assert.deepEqual(jobs, [
    {
      title: 'Full Stack Developer',
      company: 'Nineleaps Technology Solutions',
      department: null,
      location: 'Bengaluru',
      city: 'Bengaluru',
      country: 'India',
      jobId: 'full-stack-developer',
      requisitionId: 'full-stack-developer',
      sourceUrl: 'https://www.nineleaps.com/job/full-stack-developer/',
      applyUrl: 'https://www.nineleaps.com/job/full-stack-developer/#apply',
      employmentType: null,
      experienceRequired: '2-5 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: ['React.js', 'Node.js', 'REST APIs'],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Build and maintain scalable web applications across both frontend and backend systems.',
      remoteStatus: 'On-site',
      source: 'nineleapstechnologysolutions',
      link: 'https://www.nineleaps.com/job/full-stack-developer/#apply',
      scrapedAt: '2026-07-18T00:00:00.000Z',
    },
    {
      title: 'AI Engineer',
      company: 'Nineleaps Technology Solutions',
      department: null,
      location: 'Bengaluru',
      city: 'Bengaluru',
      country: 'India',
      jobId: 'ai-engineer',
      requisitionId: 'ai-engineer',
      sourceUrl: 'https://www.nineleaps.com/job/ai-engineer/',
      applyUrl: 'https://www.nineleaps.com/job/ai-engineer/#apply',
      employmentType: null,
      experienceRequired: '2-4 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: ['Python', 'Machine Learning', 'LLMs'],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Build, test, and improve machine learning solutions that solve real-world business problems.',
      remoteStatus: 'On-site',
      source: 'nineleapstechnologysolutions',
      link: 'https://www.nineleaps.com/job/ai-engineer/#apply',
      scrapedAt: '2026-07-18T00:00:00.000Z',
    },
  ])
})

test('Nineleaps Technology Solutions run fails closed when the verified jobs surface drifts', async () => {
  const nineleaps = await loadModule()

  await assert.rejects(
    nineleaps.createNineleapsTechnologySolutionsScraper().run({
      fetchText: async (url) => (url === nineleaps.CAREERS_PAGE_URL ? careersHtml : '<html><body>Missing jobs</body></html>'),
    }),
    /verified nineleaps technology solutions jobs surface/i,
  )
})
