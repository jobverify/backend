import assert from 'node:assert/strict'
import test from 'node:test'

import { CAREERS_URL, HOMEPAGE_URL, createPixdynamicsScraper, hasOfficialCareerPageSignal } from '../../scraper/pixdynamics/script.js'

const homepage = `<link rel="canonical" href="https://pixdynamics.com/" />
  <script type="application/ld+json">{"@type":"Organization","name":"PixDynamics Private Limited","alternateName":"PixDynamics"}</script>
  <p>Identity verification</p>`
const careers = `<link rel="canonical" href="https://pixdynamics.com/career" />
  <meta property="og:site_name" content="PixDynamics" />
  <h1>Join us at PixDynamics</h1>
  <section id="section1"><h3>Job Openings</h3><p>New Job Openings Will Be Added Soon...</p></section>
  <section class="d-none"><h3>Old hidden opening</h3><a href="mailto:hr@pixl.ai">Apply</a></section>`
const runWithCareers = (html) => createPixdynamicsScraper().run({
  fetchText: async (url) => {
    if (url === HOMEPAGE_URL) return homepage
    if (url === CAREERS_URL) return html
    throw new Error(`Unexpected URL ${url}`)
  },
})

test('PixDynamics accepts an explicit empty inventory in the verified visible openings section', async () => {
  assert.equal(hasOfficialCareerPageSignal(careers), true)
  assert.deepEqual(await runWithCareers(careers), [])
})

test('PixDynamics does not treat missing, hidden, or malformed vacancies as an empty inventory', async () => {
  await assert.rejects(runWithCareers(careers.replace('New Job Openings Will Be Added Soon...', '')), /verified public career page/)
  await assert.rejects(runWithCareers(careers.replace('id="section1"', 'id="hidden"')), /verified public career page/)
  await assert.rejects(runWithCareers(careers.replace('</section>', '<div class="job-card"><h3>Incomplete live job</h3></div></section>')), /verified public career page|visible public job cards/)
  await assert.rejects(runWithCareers(careers.replace('https://pixdynamics.com/career', 'https://unrelated.example/career')), /verified public career page/)
})

test('PixDynamics continues to parse advertised roles in the visible section', async () => {
  const liveCard = `<div class="job-card">
    <h3>Software Engineer</h3><div class="d-flex flex-wrap gap_10"><span>Kochi</span><span>Full Time</span></div>
    <a href="mailto:hr@pixl.ai">Apply</a></div>`
  const html = careers.replace('<p>New Job Openings Will Be Added Soon...</p>', liveCard)
  const jobs = await runWithCareers(html)
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Software Engineer')
  assert.equal(jobs[0].location, 'Kochi, India')
})
