import assert from 'node:assert/strict'
import test from 'node:test'

const loadOpseraModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Opsera scraper module at ./script.js')
  }
}

const careersPageHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Let’s Grow Together</h1>
      <p>You can be a game-changer at Opsera.</p>
      <h2>Current Positions</h2>

      <article>
        <h3><a href="https://opsera.ai/careers/devops-evangelist/">DevOps Evangelist</a></h3>
        <p>Full Time</p>
        <p>India-based, Remote Position</p>
        <p>Sales</p>
        <a href="https://opsera.ai/careers/devops-evangelist/">View Job</a>
      </article>

      <article>
        <h3><a href="https://opsera.ai/careers/pre-sales-solution-engineer/">Pre-Sales Solution Engineer</a></h3>
        <p>Full Time</p>
        <p>US-based, Remote Position</p>
        <p>Sales</p>
        <a href="https://opsera.ai/careers/pre-sales-solution-engineer/">View Job</a>
      </article>
    </main>
  </body>
</html>
`

const indiaJobDetailHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>DevOps Evangelist</h1>
      <p>Seeking a DevOps Evangelist Who Can Code, Analyze, and Inspire</p>
      <p>Sales</p>
      <p>Full Time</p>
      <p>India-based, Remote Position</p>
      <a href="https://opsera.ai/job-application/">Apply Now</a>
      <section>
        <h2>What You'll Do</h2>
        <p>Transform how organizations think about software delivery.</p>
        <p>Build compelling demos, analyze delivery intelligence data, and present findings that drive executive buy-in.</p>
      </section>
    </main>
  </body>
</html>
`

test('Opsera scraper validates the verified official careers page and extracts only India listings', async () => {
  const opsera = await loadOpseraModule()

  assert.equal(opsera.SOURCE, 'opsera')
  assert.equal(opsera.COMPANY, 'Opsera')
  assert.equal(opsera.CAREERS_URL, 'https://www.opsera.io/careers/')
  assert.equal(opsera.hasOfficialCareersSignal(careersPageHtml), true)
  assert.deepEqual(opsera.extractListings(careersPageHtml), [
    {
      title: 'DevOps Evangelist',
      sourceUrl: 'https://opsera.ai/careers/devops-evangelist/',
      applyUrl: 'https://opsera.ai/careers/devops-evangelist/',
      location: 'India-based, Remote Position',
      employmentType: 'Full Time',
      department: 'Sales',
      jobId: 'devops-evangelist',
      requisitionId: 'devops-evangelist',
    },
  ])
})

test('Opsera scraper uses the verified detail page to decorate the public India role', async () => {
  const opsera = await loadOpseraModule()
  const requestedUrls = []

  const jobs = await opsera.createOpseraScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === opsera.CAREERS_URL) return careersPageHtml
      if (url === 'https://opsera.ai/careers/devops-evangelist/') return indiaJobDetailHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
    now: () => '2026-07-10T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    'https://www.opsera.io/careers/',
    'https://opsera.ai/careers/devops-evangelist/',
  ])
  assert.deepEqual(jobs, [
    {
      title: 'DevOps Evangelist',
      company: 'Opsera',
      location: 'India-based, Remote Position',
      city: null,
      country: 'India',
      jobId: 'devops-evangelist',
      requisitionId: 'devops-evangelist',
      sourceUrl: 'https://opsera.ai/careers/devops-evangelist/',
      applyUrl: 'https://opsera.ai/careers/devops-evangelist/',
      employmentType: 'Full Time',
      department: 'Sales',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Seeking a DevOps Evangelist Who Can Code, Analyze, and Inspire What You\'ll Do Transform how organizations think about software delivery. Build compelling demos, analyze delivery intelligence data, and present findings that drive executive buy-in.',
      source: 'opsera',
      link: 'https://opsera.ai/careers/devops-evangelist/',
      scrapedAt: '2026-07-10T00:00:00.000Z',
    },
  ])
})

test('Opsera scraper fails closed when the verified official careers surface changes', async () => {
  const opsera = await loadOpseraModule()

  await assert.rejects(
    opsera.createOpseraScraper().run({
      fetchText: async () => '<html><body>No current positions are published here.</body></html>',
    }),
    /verified official careers surface/i,
  )
})
