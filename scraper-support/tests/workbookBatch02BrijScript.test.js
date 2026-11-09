import assert from 'node:assert/strict'
import test from 'node:test'

const VERIFIED_CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Brij Careers | Help us Build the Future of Product Experience</title>
    <link rel="canonical" href="https://brij.ai/careers">
  </head>
  <body>
    <main>
      <h1>Work with us</h1>
      <p>Let's build the future of digital product experiences</p>

      <section>
        <h2>Chief of Staff</h2>
        <p>Location: Hybrid (NYC-based preferred)</p>
        <a href="https://brij.applytojob.com/apply/chief123/Chief-Of-Staff">Apply Now</a>
      </section>

      <section>
        <h2>Marketing Director</h2>
        <p>Location: Remote (NYC-preferred)</p>
        <a href="https://brij.applytojob.com/apply/market123/Marketing-Director">Apply Now</a>
      </section>

      <section>
        <h2>Senior Technical Product Manager</h2>
        <p>Location: Remote or Hybrid NYC / Austin</p>
        <a href="https://brij.applytojob.com/apply/pm123/Senior-Technical-Product-Manager">Apply Now</a>
      </section>
    </main>
  </body>
</html>
`

const VERIFIED_BOARD_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Brij - Career Page</title>
  </head>
  <body>
    <a href="https://www.brij.it/">View Our Website</a>
    <p>Thanks for visiting our Career Page. Please review our open positions and apply to the positions that match your qualifications.</p>
    <h2>Current Openings</h2>
    <ul>
      <li>
        <h3>
          <a href="https://brij.applytojob.com/apply/bGeEeYPbgv/Director-Of-Partnerships">
            Director of Partnerships
          </a>
        </h3>
        <p>New York City, NY</p>
      </li>
    </ul>
  </body>
</html>
`

const VERIFIED_DETAIL_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Director of Partnerships - Brij - Career Page</title>
  </head>
  <body>
    <main>
      <h1>Director of Partnerships</h1>
      <p>New York City, NY</p>
      <p>Full Time</p>
      <p>Experienced</p>
      <p>Open to WFH/Remote OR Hybrid NYC</p>
      <p>
        Brij is the AI-powered omnichannel marketing platform that helps brands turn
        every unknown shopper into a known customer.
      </p>
      <p>Apply for this position</p>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/brij/script.js')
  } catch {
    assert.fail('Expected Brij scraper module at ../../scraper/brij/script.js')
  }
}

test('Brij helper signals stay pinned to the verified first-party careers page and public ApplyToJob board from Thursday, July 30, 2026', async () => {
  const brij = await loadModule()
  const listings = brij.extractBoardJobs(VERIFIED_BOARD_HTML)
  const detail = brij.extractJobDetail(VERIFIED_DETAIL_HTML, listings[0])

  assert.equal(brij.SOURCE, 'brij')
  assert.equal(brij.COMPANY, 'Brij')
  assert.equal(brij.VERIFIED_ON, '2026-08-01')
  assert.equal(brij.CAREERS_URL, 'https://brij.ai/careers')
  assert.equal(brij.BOARD_URL, 'https://brij.applytojob.com/apply')
  assert.equal(brij.hasOfficialCareersSignal(VERIFIED_CAREERS_HTML), true)
  assert.equal(brij.hasOfficialCareersSignal('<main>Careers</main>'), false)
  assert.deepEqual(brij.extractOfficialApplyUrls(VERIFIED_CAREERS_HTML), [
    'https://brij.applytojob.com/apply/chief123/Chief-Of-Staff',
    'https://brij.applytojob.com/apply/market123/Marketing-Director',
    'https://brij.applytojob.com/apply/pm123/Senior-Technical-Product-Manager',
  ])
  assert.equal(brij.hasVerifiedBoardSignal(VERIFIED_BOARD_HTML), true)
  assert.equal(brij.hasVerifiedBoardSignal('<html><body>Jobs</body></html>'), false)
  assert.equal(brij.hasVerifiedJobDetailSignal(VERIFIED_DETAIL_HTML, listings[0]), true)
  assert.equal(listings.length, 1)
  assert.deepEqual(
    {
      ...listings[0],
      ...Object.fromEntries(
        Object.entries(detail).filter(([, value]) => value != null),
      ),
    },
    {
      title: 'Director of Partnerships',
      company: 'Brij',
      department: null,
      location: 'New York City, NY',
      city: 'New York City',
      country: 'United States',
      jobId: 'bGeEeYPbgv',
      requisitionId: 'bGeEeYPbgv',
      sourceUrl: 'https://brij.applytojob.com/apply/bGeEeYPbgv/Director-Of-Partnerships',
      applyUrl: 'https://brij.applytojob.com/apply/bGeEeYPbgv/Director-Of-Partnerships',
      employmentType: 'Full-time',
      experienceRequired: 'Experienced',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: "Brij is the AI-powered omnichannel marketing platform that helps brands turn every unknown shopper into a known customer.",
      remoteStatus: null,
    },
  )
})

test('Brij run validates the official careers handoff, checks the live public board opening, and returns [] because the verified opening is non-India only', async () => {
  const brij = await loadModule()
  const requestedUrls = []

  const jobs = await brij.createBrijScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === brij.CAREERS_URL) return VERIFIED_CAREERS_HTML
      if (url === brij.BOARD_URL) return VERIFIED_BOARD_HTML
      if (url === 'https://brij.applytojob.com/apply/bGeEeYPbgv/Director-Of-Partnerships') {
        return VERIFIED_DETAIL_HTML
      }

      throw new Error(`Unexpected Brij URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    brij.CAREERS_URL,
    brij.BOARD_URL,
    'https://brij.applytojob.com/apply/bGeEeYPbgv/Director-Of-Partnerships',
  ])
  assert.deepEqual(jobs, [])
})

test('Brij fails closed when the verified careers page, public board, or current public detail page drifts', async () => {
  const brij = await loadModule()

  await assert.rejects(
    brij.createBrijScraper().run({
      fetchText: async (url) => {
        if (url === brij.CAREERS_URL) return '<html><body>Careers</body></html>'
        if (url === brij.BOARD_URL) return VERIFIED_BOARD_HTML
        if (url === 'https://brij.applytojob.com/apply/bGeEeYPbgv/Director-Of-Partnerships') {
          return VERIFIED_DETAIL_HTML
        }

        throw new Error(`Unexpected Brij URL: ${url}`)
      },
    }),
    /official brij careers page/i,
  )

  await assert.rejects(
    brij.createBrijScraper().run({
      fetchText: async (url) => {
        if (url === brij.CAREERS_URL) return VERIFIED_CAREERS_HTML
        if (url === brij.BOARD_URL) return '<html><body>Current Openings</body></html>'
        if (url === 'https://brij.applytojob.com/apply/bGeEeYPbgv/Director-Of-Partnerships') {
          return VERIFIED_DETAIL_HTML
        }

        throw new Error(`Unexpected Brij URL: ${url}`)
      },
    }),
    /verified brij applytojob board/i,
  )

  await assert.rejects(
    brij.createBrijScraper().run({
      fetchText: async (url) => {
        if (url === brij.CAREERS_URL) return VERIFIED_CAREERS_HTML
        if (url === brij.BOARD_URL) return VERIFIED_BOARD_HTML
        if (url === 'https://brij.applytojob.com/apply/bGeEeYPbgv/Director-Of-Partnerships') {
          return '<html><body>Apply</body></html>'
        }

        throw new Error(`Unexpected Brij URL: ${url}`)
      },
    }),
    /verified brij job detail/i,
  )
})
