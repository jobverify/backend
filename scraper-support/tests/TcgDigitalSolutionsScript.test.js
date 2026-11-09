import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-18T00:00:00.000Z'

const careersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Careers</h1>
    <p>Explore Open Roles</p>
    <h2>Openings</h2>
    <section class="opening">
      <h3>AI Product Manager / Product Owner</h3>
      <div>Role AI Product Manager / Product Owner</div>
      <div>Location Pune (Hybrid)</div>
      <div>Experience 6 – 10 years with 3+ years in AI/ML products</div>
      <div>Education Bachelor’s or master’s degree in engineering, Computer Science, or a related field.</div>
      <div>Number of Positions 1</div>
      <div>SPOC Human Resources</div>
      <div>Mail to careers@tcgdigital.com</div>
    </section>
    <section class="opening">
      <h3>Project Manager</h3>
      <div>Role Project Manager</div>
      <div>Location Chicago/Houston</div>
      <div>Experience 8 years</div>
      <div>Mail to careers@tcgdigital.com</div>
    </section>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/tcgdigitalsolutions/script.js')
  } catch {
    assert.fail('Expected TCG Digital Solutions scraper module at ../../scraper/tcgdigitalsolutions/script.js')
  }
}

test('TCG Digital Solutions helpers stay pinned to the verified careers page', async () => {
  const tcg = await loadModule()

  assert.equal(tcg.SOURCE, 'tcgdigitalsolutions')
  assert.equal(tcg.COMPANY, 'Tcg Digital Solutions')
  assert.equal(tcg.CAREERS_URL, 'https://www.tcgdigital.com/careers/')
  assert.equal(tcg.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(tcg.hasOfficialCareersSignal('<html><body><h1>Jobs</h1></body></html>'), false)
  assert.deepEqual(tcg.extractJobs(careersHtml), [
    {
      title: 'AI Product Manager / Product Owner',
      company: 'Tcg Digital Solutions',
      department: null,
      location: 'Pune (Hybrid), India',
      city: 'Pune',
      country: 'India',
      jobId: 'ai-product-manager-product-owner',
      requisitionId: 'ai-product-manager-product-owner',
      sourceUrl: 'https://www.tcgdigital.com/careers/#ai-product-manager-product-owner',
      applyUrl: 'mailto:careers@tcgdigital.com?subject=AI%20Product%20Manager%20%2F%20Product%20Owner',
      employmentType: null,
      experienceRequired: '6 – 10 years with 3+ years in AI/ML products',
      minimumQualification: 'Bachelor’s or master’s degree in engineering, Computer Science, or a related field.',
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: 'Hybrid',
    },
  ])
})

test('TCG Digital Solutions run validates the verified careers page and returns India roles only', async () => {
  const tcg = await loadModule()
  const requestedUrls = []

  const jobs = await tcg.createTcgDigitalSolutionsScraper().run({
    now: () => FIXED_SCRAPED_AT,
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === tcg.CAREERS_URL) return careersHtml
      throw new Error(`Unexpected TCG URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [tcg.CAREERS_URL])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'tcgdigitalsolutions')
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
  assert.equal(jobs[0].title, 'AI Product Manager / Product Owner')
})

test('TCG Digital Solutions fails closed when the verified careers page drifts', async () => {
  const tcg = await loadModule()

  await assert.rejects(
    tcg.createTcgDigitalSolutionsScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
    }),
    /verified tcg digital careers page/i,
  )
})
