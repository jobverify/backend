import assert from 'node:assert/strict'
import test from 'node:test'

const officialCareersHtml = `
  <main>
    <section>
      <p>CAREERS</p>
      <h1>HyperTribe: Lead the change</h1>
      <h2>OPEN POSITIONS</h2>
      <article class="job-card">
        <h3>Full Stack Engineer</h3>
        <p><img alt="Hyperverge Job location"> Bengaluru</p>
        <p><img alt="Hyperverg Job"> Full-time</p>
        <a href="https://www.linkedin.com/jobs/view/123">Apply Now</a>
      </article>
      <article class="job-card">
        <h3>Lead - Machine Learning (NLP)</h3>
        <p><img alt="Hyperverge Job location"> Bangalore</p>
        <p><img alt="Hyperverg Job"> Full-time</p>
        <a href="https://docs.google.com/forms/d/e/example/viewform">Apply Now</a>
      </article>
      <article class="job-card">
        <h3>Product Support/Technical Intern</h3>
        <p><img alt="Hyperverge Job location"> Coimbatore</p>
        <p><img alt="Hyperverg Job"> Intern</p>
        <a href="https://www.linkedin.com/jobs/view/456">Apply Now</a>
      </article>
      <article class="job-card">
        <h3>Customer Success Manager - Vietnam</h3>
        <p><img alt="Hyperverge Job location"> Ho Chi Minh City</p>
        <p><img alt="Hyperverg Job"> Full-time</p>
        <a href="https://www.linkedin.com/jobs/view/789">Apply Now</a>
      </article>
    </section>
  </main>
`

test('HyperVerge maps official India job cards into runner-ready records', async () => {
  const hyperverge = await import('../../scraper/hyperverge/script.js')
  const requestedUrls = []

  assert.equal(hyperverge.hasOfficialCareersSignal(officialCareersHtml), true)

  const jobs = await hyperverge.createHyperVergeScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return officialCareersHtml
    },
  })

  assert.deepEqual(requestedUrls, [hyperverge.CAREERS_URL])
  assert.equal(jobs.length, 3)
  assert.deepEqual(jobs.map((job) => job.title), [
    'Full Stack Engineer',
    'Lead - Machine Learning (NLP)',
    'Product Support/Technical Intern',
  ])
  assert.equal(jobs[0].company, 'HyperVerge')
  assert.equal(jobs[0].location, 'Bengaluru, India')
  assert.equal(jobs[1].location, 'Bangalore, India')
  assert.equal(jobs[2].employmentType, 'Intern')
  assert.equal(jobs[0].applyUrl, 'https://www.linkedin.com/jobs/view/123')
  assert.equal(jobs[1].applyUrl, 'https://docs.google.com/forms/d/e/example/viewform')
  assert.equal(jobs[0].source, 'hyperverge')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
})

test('HyperVerge refuses to scrape when the official careers surface changes', async () => {
  const hyperverge = await import('../../scraper/hyperverge/script.js')

  await assert.rejects(
    hyperverge.createHyperVergeScraper().run({
      fetchText: async () => '<html><body>Unrelated site</body></html>',
    }),
    /official careers surface/i,
  )
})
