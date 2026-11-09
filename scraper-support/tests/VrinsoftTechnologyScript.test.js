import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('../../scraper/vrinsofttechnology/script.js')
  } catch {
    assert.fail('Expected Vrinsoft Technology scraper module at ../../scraper/vrinsofttechnology/script.js')
  }
}

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Vrinsoft Careers | Jobs in AI, Web &amp; Software Development</title>
  </head>
  <body>
    <h1 class="career-hiring-heading1">Build your future with Vrinsoft</h1>
    <p>Apply Now On <a href="mailto:hr@vrinsofts.com">hr@vrinsofts.com</a></p>
    <div class="accordion-item accordion-item-career">
      <div class="accordion-header" id="senior-react-developer">
        <p class="heading-four blue-text">Senior React Developer</p>
      </div>
      <div class="career-hiring-details">5+ years Ahmedabad</div>
      <a class="apply-btn" data-id="vr-101">Apply Now</a>
    </div>
    <div class="accordion-item accordion-item-career">
      <div class="accordion-header" id="qa-engineer">
        <p class="heading-four blue-text">QA Engineer</p>
      </div>
      <div class="career-hiring-details">3+ years Remote</div>
      <a class="apply-btn" data-id="vr-102">Apply Now</a>
    </div>
  </body>
</html>
`

test('Vrinsoft Technology validates the verified first-party careers page and extracts job cards', async () => {
  const vrinsoft = await loadModule()

  assert.equal(vrinsoft.hasOfficialCareersSignal(careersHtml), true)
  assert.deepEqual(vrinsoft.extractJobCards(careersHtml), [
    {
      title: 'Senior React Developer',
      location: 'Ahmedabad, India',
      city: 'Ahmedabad',
      sourceUrl: 'https://www.vrinsofts.com/career.html#senior-react-developer',
      applyUrl: 'https://www.vrinsofts.com/career.html#senior-react-developer',
      jobId: 'vr-101',
      requisitionId: 'vr-101',
      experienceRequired: '5+ years',
    },
    {
      title: 'QA Engineer',
      location: 'Remote, India',
      city: 'Remote',
      sourceUrl: 'https://www.vrinsofts.com/career.html#qa-engineer',
      applyUrl: 'https://www.vrinsofts.com/career.html#qa-engineer',
      jobId: 'vr-102',
      requisitionId: 'vr-102',
      experienceRequired: '3+ years',
    },
  ])
})

test('Vrinsoft Technology run returns normalized jobs from the verified first-party careers page', async () => {
  const vrinsoft = await loadModule()
  const jobs = await vrinsoft.run({
    fetchText: async (url) => {
      assert.equal(url, vrinsoft.CAREERS_URL)
      return careersHtml
    },
    now: () => '2026-07-17T00:00:00.000Z',
  })

  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      location: job.location,
      link: job.link,
      source: job.source,
    })),
    [
      {
        title: 'Senior React Developer',
        location: 'Ahmedabad, India',
        link: 'https://www.vrinsofts.com/career.html#senior-react-developer',
        source: 'vrinsofttechnology',
      },
      {
        title: 'QA Engineer',
        location: 'Remote, India',
        link: 'https://www.vrinsofts.com/career.html#qa-engineer',
        source: 'vrinsofttechnology',
      },
    ],
  )
})

test('Vrinsoft Technology default fetch is bounded by a timeout signal', async () => {
  const vrinsoft = await loadModule()
  let capturedInit = null

  const html = await vrinsoft.defaultFetchText(vrinsoft.CAREERS_URL, {
    timeoutMs: 25,
    fetchImpl: async (url, init) => {
      capturedInit = init

      return {
        ok: true,
        status: 200,
        text: async () => careersHtml,
      }
    },
  })

  assert.equal(html, careersHtml)
  assert.equal(capturedInit.signal instanceof AbortSignal, true)
  assert.equal(capturedInit.headers.Accept.includes('text/html'), true)
})

test('Vrinsoft Technology fails closed when the verified careers page loses its job-card structure', async () => {
  const vrinsoft = await loadModule()

  await assert.rejects(
    vrinsoft.run({
      fetchText: async () => '<html><body><h1>Vrinsoft</h1><p>Contact us</p></body></html>',
    }),
    /verified first-party careers page/i,
  )
})
