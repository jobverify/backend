import assert from 'node:assert/strict'
import test from 'node:test'

const loadSahajAiModule = async () => {
  try {
    return await import('../../scraper/sahajai/script.js')
  } catch {
    assert.fail('Expected Sahaj AI scraper module at ../../scraper/sahajai/script.js')
  }
}

const careersPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers Sahaj Software</title>
  </head>
  <body>
    <main>
      <h1>Work will never be the same again!</h1>
      <h2>Explore Open Roles</h2>
      <h3>Data Scientist</h3>
      <p>As a data scientist, you must have a strong background in Data Mining, Machine Learning, Recommendation Systems and Statistics.</p>
      <a href="https://sahaj.ai/joinus/data-scientist/">Know More</a>
      <h3>Data Engineer</h3>
      <p>As a Data Engineer, you’ll feel at home if you are hands on, grounded, opinionated and passionate about delivering comprehensive data solutions.</p>
      <a href="/joinus/data-engineer/">Know More</a>
      <h3>Senior and Lead Engineer - Full Stack</h3>
      <p>As a full-stack engineer, you’ll feel at home if you are hands-on, grounded, opinionated and passionate about building things using technology.</p>
      <a href="/joinus/full-stack-engineer/">Know More</a>
    </main>
  </body>
</html>
`

const dataScientistDetailHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <a href="/careers/">Careers</a>
      <h1>Data Scientist</h1>
      <p>Location: Bengaluru | London | Pune</p>
      <h2>About the role and the skill set</h2>
      <p>A Data Scientist at Sahaj should help solve client problems.</p>
      <p>They should be conversant with end-to-end data science model life cycle, metrics, and deployment challenges.</p>
      <h2>Qualification/experience:</h2>
      <p>PhD/Master’s/Graduate Degree in Computer Science, Machine Learning, AI, Operational Research, Statistics, or Mathematics.</p>
      <h2>Give yourself an opportunity to</h2>
      <ul>
        <li>Experience a culture of trust, respect and transparency powered by holacracy.</li>
        <li>Collaborate with multi-disciplinary teams to solve some real business problems.</li>
      </ul>
      <h2>Write to us at: connect@sahaj.ai</h2>
    </main>
  </body>
</html>
`

const fullStackDetailHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <a href="/careers/">Careers</a>
      <h1>Senior and Lead Engineer – Full Stack</h1>
      <p>Location: Bengaluru | Chennai | Hyderabad | London | Pune</p>
      <h2>About the role</h2>
      <p>You’ll thrive if you’re hands-on, grounded, and passionate about building with technology.</p>
      <h2>Responsibilities</h2>
      <ul>
        <li>Remain fully hands-on and write high-quality, production-ready code that enables smooth deployment of solutions.</li>
        <li>Lead architecture and design decisions, ensuring adherence to best practices in technology choices and system design.</li>
      </ul>
      <h2>Skills you’ll need</h2>
      <ul>
        <li>At least 8+ years experience as a Software Engineer.</li>
        <li>A nuanced and rich understanding of code quality, maintainability and practices like Test Driven Development.</li>
      </ul>
      <h2>Write to us at: connect@sahaj.ai</h2>
    </main>
  </body>
</html>
`

test('Sahaj AI validates the verified official careers page and extracts same-domain role links', async () => {
  const sahajai = await loadSahajAiModule()

  assert.equal(sahajai.CAREERS_URL, 'https://sahaj.ai/careers/')
  assert.equal(sahajai.COMPANY, 'Sahaj AI')
  assert.equal(sahajai.SOURCE, 'sahajai')
  assert.equal(sahajai.hasOfficialCareersSignal(careersPageHtml), true)

  assert.deepEqual(sahajai.extractListings(careersPageHtml), [
    {
      title: 'Data Scientist',
      sourceUrl: 'https://sahaj.ai/joinus/data-scientist/',
      applyUrl: 'https://sahaj.ai/joinus/data-scientist/',
      jobId: 'data-scientist',
      requisitionId: 'data-scientist',
    },
    {
      title: 'Data Engineer',
      sourceUrl: 'https://sahaj.ai/joinus/data-engineer/',
      applyUrl: 'https://sahaj.ai/joinus/data-engineer/',
      jobId: 'data-engineer',
      requisitionId: 'data-engineer',
    },
    {
      title: 'Senior and Lead Engineer - Full Stack',
      sourceUrl: 'https://sahaj.ai/joinus/full-stack-engineer/',
      applyUrl: 'https://sahaj.ai/joinus/full-stack-engineer/',
      jobId: 'full-stack-engineer',
      requisitionId: 'full-stack-engineer',
    },
  ])
})

test('Sahaj AI extracts detail-page metadata from an official role page', async () => {
  const sahajai = await loadSahajAiModule()
  const sourceUrl = 'https://sahaj.ai/joinus/data-scientist/'

  assert.deepEqual(sahajai.extractJobDetail(dataScientistDetailHtml, {
    title: 'Data Scientist',
    sourceUrl,
    applyUrl: sourceUrl,
    jobId: 'data-scientist',
    requisitionId: 'data-scientist',
  }), {
    title: 'Data Scientist',
    location: 'Bengaluru | London | Pune',
    city: 'Bengaluru',
    country: 'India',
    jobId: 'data-scientist',
    requisitionId: 'data-scientist',
    sourceUrl,
    applyUrl: sourceUrl,
    employmentType: null,
    experienceRequired: null,
    department: null,
    minimumQualification: 'PhD/Master’s/Graduate Degree in Computer Science, Machine Learning, AI, Operational Research, Statistics, or Mathematics.',
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: 'About the role and the skill set A Data Scientist at Sahaj should help solve client problems. They should be conversant with end-to-end data science model life cycle, metrics, and deployment challenges. Give yourself an opportunity to Experience a culture of trust, respect and transparency powered by holacracy. Collaborate with multi-disciplinary teams to solve some real business problems.',
  })
})

test('Sahaj AI run fetches the official listing page, follows role pages, and decorates final jobs', async () => {
  const sahajai = await loadSahajAiModule()
  const requestedUrls = []

  const jobs = await sahajai.createSahajAiScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === sahajai.CAREERS_URL) return careersPageHtml
      if (url === 'https://sahaj.ai/joinus/data-scientist/') return dataScientistDetailHtml
      if (url === 'https://sahaj.ai/joinus/data-engineer/') return dataScientistDetailHtml.replace('Data Scientist', 'Data Engineer')
      if (url === 'https://sahaj.ai/joinus/full-stack-engineer/') return fullStackDetailHtml
      throw new Error(`Unexpected Sahaj AI fixture URL: ${url}`)
    },
    now: () => '2026-07-10T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    'https://sahaj.ai/careers/',
    'https://sahaj.ai/joinus/data-scientist/',
    'https://sahaj.ai/joinus/data-engineer/',
    'https://sahaj.ai/joinus/full-stack-engineer/',
  ])
  assert.equal(jobs.length, 3)
  assert.equal(jobs[0].company, 'Sahaj AI')
  assert.equal(jobs[0].source, 'sahajai')
  assert.equal(jobs[0].link, jobs[0].sourceUrl)
  assert.equal(jobs[0].scrapedAt, '2026-07-10T00:00:00.000Z')
})

test('Sahaj AI fails closed when the verified official careers signal disappears', async () => {
  const sahajai = await loadSahajAiModule()

  await assert.rejects(
    sahajai.createSahajAiScraper().run({
      fetchText: async () => '<html><body>No verified Sahaj AI careers content here</body></html>',
    }),
    /verified Sahaj AI careers surface/i,
  )
})
