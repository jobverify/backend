import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-08-04T00:00:00.000Z'

const homepageHtml = `
<!doctype html>
<html>
  <head><title>Molecular Connections</title></head>
  <body>
    <p>Molecular Connections Private Limited</p>
    <p>Powered by AI &amp; 5,000+ Experts</p>
    <p>Experience applied AI</p>
    <a href="https://career.molecularconnections.com/">Careers</a>
  </body>
</html>
`

const careersHomeHtml = `
<!doctype html>
<html>
  <body>
    <h1>Career at Molecular Connections</h1>
    <p>Ranked Best Place to Work</p>
    <p>Current Openings</p>
    <a href="https://career.molecularconnections.com/technology-job-openings/">Technology Job Openings</a>
    <a href="https://career.molecularconnections.com/job-openings/">Apply</a>
  </body>
</html>
`

const applyFormHtml = `
<!doctype html>
<html>
  <body>
    <h1>Job Openings</h1>
    <p>submit your resume below</p>
    <label>Position you are applying for</label>
    <button>Apply</button>
  </body>
</html>
`

const technologyOpeningsHtml = `
<!doctype html>
<html>
  <body>
    <h1>Technology Job Openings</h1>
    <p>Current Openings</p>
    <p>Take a look at the open positions mentioned below</p>
    <div data-post-link="https://career.molecularconnections.com/job_opening/application-support-specialist-publishing-platforms/"></div>
    <h2>POSTED ON</h2>
    <div>Application Support Specialist - Publishing Platforms</div>
    <div>Bengaluru</div>
    <div>July 18, 2026</div>
  </body>
</html>
`

const detailHtml = `
<!doctype html>
<html>
  <body>
    <h1>Application Support Specialist - Publishing Platforms</h1>
    <p><strong>Required:</strong></p>
    <ul>
      <li>Bachelor's degree.</li>
      <li>1+ years of experience in a helpdesk, product support, or L1 technical support role.</li>
    </ul>
  </body>
</html>
`

const loadMolecularModule = async () => {
  try {
    return await import('../../scraper/molecularconnectionspvtltd/script.js')
  } catch {
    assert.fail('Expected Molecular Connections scraper module at ../../scraper/molecularconnectionspvtltd/script.js')
  }
}

test('Molecular Connections extractor keeps first-party detail links from the public technology openings surface', async () => {
  const molecular = await loadMolecularModule()

  const jobs = molecular.extractTechnologyOpenings(technologyOpeningsHtml)

  assert.deepEqual(jobs, [
    {
      title: 'Application Support Specialist - Publishing Platforms',
      location: 'Bengaluru, India',
      city: 'Bangalore',
      postingDate: '2026-07-18',
      sourceUrl: 'https://career.molecularconnections.com/job_opening/application-support-specialist-publishing-platforms/',
      applyUrl: 'https://career.molecularconnections.com/job-openings/',
    },
  ])
})

test('Molecular Connections run enriches public job detail pages with experience when available', async () => {
  const molecular = await loadMolecularModule()
  let nowCalls = 0

  const jobs = await molecular.createMolecularConnectionsScraper().run({
    fetchText: async (url) => {
      if (url === molecular.HOMEPAGE_URL) return homepageHtml
      if (url === molecular.CAREERS_HOME_URL) return careersHomeHtml
      if (url === molecular.APPLY_URL) return applyFormHtml
      if (url === molecular.TECHNOLOGY_OPENINGS_URL) return technologyOpeningsHtml
      if (url === 'https://career.molecularconnections.com/job_opening/application-support-specialist-publishing-platforms/') {
        return detailHtml
      }
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Application Support Specialist - Publishing Platforms')
  assert.equal(jobs[0].source, 'molecularconnectionspvtltd')
  assert.equal(jobs[0].sourceUrl, 'https://career.molecularconnections.com/job_opening/application-support-specialist-publishing-platforms/')
  assert.equal(jobs[0].applyUrl, 'https://career.molecularconnections.com/job-openings/')
  assert.equal(jobs[0].experienceRequired, '1+ years')
  assert.equal(jobs[0].publicExperienceChecked, true)
  assert.match(jobs[0].jobDescription, /1\+ years of experience/i)
  assert.equal(typeof jobs[0].scrapedAt, 'string')
  nowCalls += 1
  assert.equal(nowCalls, 1)
})
