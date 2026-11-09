import assert from 'node:assert/strict'
import test from 'node:test'

const CAREERS_PAGE_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <section id="current_openings" class="current-jobs">
      <h1>Current Job Openings</h1>
      <div class="col-md-7">
        <p class="color-brand">BPO</p>
        <ul>
          <li><a class="text-dark" href="/career/research-analyst">Research Analyst</a></li>
        </ul>
      </div>
      <div class="col-md-5">
        <p class="color-brand">Technology</p>
        <ul>
          <li><a class="text-dark" href="/career/data-engineer">Data Engineer</a></li>
          <li><a class="text-dark" href="/career/senior-dynamics-365-solution-architect">Senior Dynamics 365 Solution Architect</a></li>
        </ul>
      </div>
    </section>
    <footer>Built By Arcgate Technologies LLP</footer>
  </body>
</html>
`

const RESEARCH_ANALYST_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <link rel="canonical" href="https://www.arcgate.com/career/research-analyst" />
  </head>
  <body>
    <section class="proximaRegular sectionCareer">
      <h1 class="fw-bold fs-1 mt-3">Research Analyst</h1>
      <p>Are you a detail-oriented individual with a passion for research, analysis, and decision making?</p>
      <h2>Key Responsibilities</h2>
      <ol><li>Meet daily targets.</li></ol>
      <h2>Requirements:</h2>
      <ol><li>Bachelor's degree.</li></ol>
      <h2>Meet Key Performance Indicators</h2>
      <ol><li>Quality Assurance.</li></ol>
      <p>If you are ready to contribute your skills, click the Apply button below and become an Arcgatian!</p>
      <div class="career-bottom-strip">
        <a href="/join?post_name=Research-Analyst">Apply Now</a>
      </div>
    </section>
  </body>
</html>
`

const DATA_ENGINEER_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <link rel="canonical" href="https://www.arcgate.com/career/data-engineer" />
  </head>
  <body>
    <section class="proximaRegular sectionCareer">
      <h1 class="fw-bold fs-1 mt-3">Data Engineer</h1>
      <p>Arcgate is a dynamic and rapidly growing team of professionals passionate about data and technology.</p>
      <h2>Responsibilities:</h2>
      <ol><li>Design, build, and optimize data pipelines.</li></ol>
      <h2>Qualifications:</h2>
      <ol><li>5+ years of demonstrable experience.</li></ol>
      <h2>Benefits:</h2>
      <ol><li>Competitive salary package.</li></ol>
      <p>Click the Apply button below and become an Arcgatian!</p>
      <div class="career-bottom-strip">
        <a href="/join?post_name=Data%20Engineer">Apply Now</a>
      </div>
    </section>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/arcgate/script.js')
  } catch {
    assert.fail('Expected ArcGate scraper module at ../../scraper/arcgate/script.js')
  }
}

test('ArcGate helpers stay pinned to the verified first-party careers page and linked detail pages from Saturday, July 18, 2026', async () => {
  const arcgate = await loadModule()

  assert.equal(arcgate.SOURCE, 'arcgate')
  assert.equal(arcgate.COMPANY, 'ArcGate')
  assert.equal(arcgate.OFFICIAL_BRAND_NAME, 'Arcgate')
  assert.equal(arcgate.VERIFIED_ON, '2026-07-18')
  assert.equal(arcgate.CAREERS_URL, 'https://www.arcgate.com/careers')
  assert.equal(arcgate.VERIFIED_JOB_DETAIL_URL, 'https://www.arcgate.com/career/data-engineer')
  assert.equal(arcgate.hasOfficialCareersSignal(CAREERS_PAGE_HTML), true)

  const openings = arcgate.extractOpeningLinks(CAREERS_PAGE_HTML)
  assert.equal(openings.length, 3)
  assert.deepEqual(openings[0], {
    department: 'BPO',
    title: 'Research Analyst',
    detailUrl: 'https://www.arcgate.com/career/research-analyst',
  })

  const job = arcgate.extractJobDetail(DATA_ENGINEER_HTML, openings[1])
  assert.equal(job.title, 'Data Engineer')
  assert.equal(job.location, 'Udaipur, Rajasthan, India')
  assert.equal(job.applyUrl, 'https://www.arcgate.com/join?post_name=Data%20Engineer')
})

test('ArcGate returns public jobs from the verified first-party careers page and linked application flow', async () => {
  const arcgate = await loadModule()
  const requestedUrls = []

  const jobs = await arcgate.createArcGateScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === arcgate.CAREERS_URL) return CAREERS_PAGE_HTML
      if (url === 'https://www.arcgate.com/career/research-analyst') return RESEARCH_ANALYST_HTML
      if (url === 'https://www.arcgate.com/career/data-engineer') return DATA_ENGINEER_HTML
      if (url === 'https://www.arcgate.com/career/senior-dynamics-365-solution-architect') {
        return DATA_ENGINEER_HTML.replace('Data Engineer', 'Senior Dynamics 365 Solution Architect')
          .replace('Data%20Engineer', 'Senior%20Dynamics%20365%20Solution%20Architect')
      }
      throw new Error(`Unexpected ArcGate URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    arcgate.CAREERS_URL,
    'https://www.arcgate.com/career/research-analyst',
    'https://www.arcgate.com/career/data-engineer',
    'https://www.arcgate.com/career/senior-dynamics-365-solution-architect',
  ])
  assert.equal(jobs.length, 3)
  assert.equal(jobs[0].company, 'ArcGate')
  assert.equal(jobs[0].source, 'arcgate')
  assert.equal(jobs[0].country, 'India')
  assert.equal(typeof jobs[0].scrapedAt, 'string')
  assert.equal(jobs[1].link, jobs[1].applyUrl)
})

test('ArcGate fails closed when the verified careers page or detail layout drifts', async () => {
  const arcgate = await loadModule()

  await assert.rejects(
    arcgate.createArcGateScraper().run({
      fetchText: async () => '<html><body><h1>Careers</h1></body></html>',
    }),
    /verified first-party careers page/i,
  )

  await assert.rejects(
    arcgate.createArcGateScraper().run({
      fetchText: async (url) => {
        if (url === arcgate.CAREERS_URL) return CAREERS_PAGE_HTML
        return '<html><body><h1>Broken detail page</h1></body></html>'
      },
    }),
    /job detail no longer matches/i,
  )
})
