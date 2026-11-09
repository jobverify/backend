import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-17T00:00:00.000Z'
const JOB_DETAIL_URL = 'https://ats.rippling.com/syllable-corporation/jobs/2ca2fc5b-cab8-4a67-928f-f78c1e7f08b9'

const VERIFIED_CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
      <title>Careers at Syllable AI - AI Infrastructure &amp; Agent Platform</title>
  </head>
  <body>
    <main>
      <h1>Build the Future of AI Infrastructure</h1>
      <h2>Open Positions</h2>
      <p>We are hiring across engineering, product, and go-to-market.</p>
      <a href="https://ats.rippling.com/syllable-corporation/jobs">View Open Positions</a>
    </main>
    <footer>© Syllable AI 2026</footer>
  </body>
</html>
`

const VERIFIED_BOARD_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Syllable Corporation</title>
  </head>
  <body>
    <main>
      <h1>Syllable Corporation</h1>
      <article class="job-card">
        <h2>A1000 ActiumHealth</h2>
        <a href="${JOB_DETAIL_URL}">Software Engineer II</a>
        <p class="location-summary">Remote (Mountain View, California, US)</p>
        <p class="location-short">Mountain View, CA</p>
        <a href="${JOB_DETAIL_URL}">View job</a>
      </article>
    </main>
    <footer>Powered by Rippling</footer>
  </body>
</html>
`

const VERIFIED_DETAIL_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Software Engineer II</title>
  </head>
  <body>
    <main>
      <p>Syllable Corporation</p>
      <p>Software Engineer II</p>
      <p>(Syllable Corporation has an opening in Mountain View, CA) Software Engineer II:</p>
      <p>Responsible for full lifecycle software development.</p>
      <p>Responsible for building and maintaining the web applications and backend services that will power customer experience.</p>
      <p>Building backend web services and APIs to power web applications.</p>
      <p>Building modern and responsive web applications using state of the art web application frameworks.</p>
      <p>Working with product owners from creation of vision to QA of final product.</p>
      <p>Telecommuting permitted from anywhere in the U.S.</p>
      <p>Requires Bachelors in Computer Science, or related technical field.</p>
      <p>Requires any demonstrated knowledge of, or university coursework involving: Python, JavaScript, Java, C#, or C++.</p>
      <p>$150,000.00 per year.</p>
      <p>Send resume to HR@syllable.ai and refer to job title.</p>
      <a href="${JOB_DETAIL_URL}">Apply now</a>
      <p>A1000 ActiumHealth</p>
      <p>Mountain View, CA</p>
      <p>Remote (Mountain View, California, US)</p>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/syllable/script.js')
  } catch {
    assert.fail('Expected Syllable scraper module at ../../scraper/syllable/script.js')
  }
}

test('Syllable verifies the first-party careers page and linked Rippling board shell', async () => {
  const syllable = await loadModule()

  assert.equal(syllable.SOURCE, 'syllable')
  assert.equal(syllable.COMPANY_NAME, 'Syllable')
  assert.equal(syllable.OFFICIAL_BRAND_NAME, 'Syllable AI')
  assert.equal(syllable.VERIFIED_ON, '2026-10-03')
  assert.equal(syllable.CAREERS_URL, 'https://syllable.ai/careers')
  assert.equal(syllable.JOBS_URL, 'https://ats.rippling.com/syllable-corporation/jobs')
  assert.equal(syllable.JOB_BOARD_SLUG, 'syllable-corporation')
  assert.equal(syllable.hasVerifiedCareersPageSignal(VERIFIED_CAREERS_HTML), true)
  assert.equal(
    syllable.hasVerifiedCareersPageSignal('<html><body><h1>Careers</h1></body></html>'),
    false,
  )
  assert.equal(syllable.hasVerifiedBoardPageSignal(VERIFIED_BOARD_HTML), true)
  assert.equal(syllable.hasVerifiedBoardPageSignal('<html><body><h1>Jobs</h1></body></html>'), false)
  assert.equal(syllable.extractVerifiedJobBoardUrl(VERIFIED_CAREERS_HTML), syllable.JOBS_URL)
  assert.deepEqual(syllable.extractListingCards(VERIFIED_BOARD_HTML), [
    {
      title: 'Software Engineer II',
      department: 'A1000 ActiumHealth',
      locationSummary: 'Remote (Mountain View, California, US)',
      locationShort: 'Mountain View, CA',
      detailUrl: JOB_DETAIL_URL,
    },
  ])
  assert.deepEqual(syllable.extractJobDetail(VERIFIED_DETAIL_HTML, JOB_DETAIL_URL), {
    title: 'Software Engineer II',
    department: 'A1000 ActiumHealth',
    location: 'Remote (Mountain View, California, US)',
    city: 'Mountain View',
    country: 'United States',
    employmentType: 'Remote',
    jobId: 'syllable-2ca2fc5b-cab8-4a67-928f-f78c1e7f08b9',
    jobDescription: '(Syllable Corporation has an opening in Mountain View, CA) Software Engineer II: Responsible for full lifecycle software development. Responsible for building and maintaining the web applications and backend services that will power customer experience. Building backend web services and APIs to power web applications. Building modern and responsive web applications using state of the art web application frameworks. Working with product owners from creation of vision to QA of final product. Telecommuting permitted from anywhere in the U.S. Requires Bachelors in Computer Science, or related technical field. Requires any demonstrated knowledge of, or university coursework involving: Python, JavaScript, Java, C#, or C++. $150,000.00 per year. Send resume to HR@syllable.ai and refer to job title.',
    detailUrl: JOB_DETAIL_URL,
  })
})

test('Syllable run validates the first-party-linked Rippling board and keeps non-India jobs excluded on the historical nonempty board fixture', async () => {
  const syllable = await loadModule()
  const requestedUrls = []

  const jobs = await syllable.createSyllableScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === syllable.CAREERS_URL) return VERIFIED_CAREERS_HTML
      if (url === syllable.JOBS_URL) return VERIFIED_BOARD_HTML
      if (url === JOB_DETAIL_URL) return VERIFIED_DETAIL_HTML
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    syllable.CAREERS_URL,
    syllable.JOBS_URL,
    JOB_DETAIL_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Syllable fails closed when the first-party careers page, Rippling board, or job detail contract drifts', async () => {
  const syllable = await loadModule()

  await assert.rejects(
    syllable.createSyllableScraper().run({
      fetchText: async () => '<html><body><h1>Careers</h1></body></html>',
    }),
    /verified first-party careers page/i,
  )

  await assert.rejects(
    syllable.createSyllableScraper().run({
      fetchText: async (url) => {
        if (url === syllable.CAREERS_URL) return VERIFIED_CAREERS_HTML
        if (url === syllable.JOBS_URL) return VERIFIED_BOARD_HTML.replace('Syllable Corporation', 'Another Company')
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified rippling board/i,
  )

  await assert.rejects(
    syllable.createSyllableScraper().run({
      fetchText: async (url) => {
        if (url === syllable.CAREERS_URL) return VERIFIED_CAREERS_HTML
        if (url === syllable.JOBS_URL) return VERIFIED_BOARD_HTML
        if (url === JOB_DETAIL_URL) return VERIFIED_DETAIL_HTML.replace('HR@syllable.ai', 'jobs@example.com')
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified rippling job detail/i,
  )
})
