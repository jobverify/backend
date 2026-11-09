import assert from 'node:assert/strict'
import test from 'node:test'

const careersPage = {
  status: 200,
  url: 'https://www.paisabazaar.com/careers',
  html: `
    <!doctype html>
    <html lang="en">
      <body>
        <main>
          <h1>We make personal finance easy, convenient & transparent</h1>
          <p>Using data and technology innovations, we help you choose the most-suited financial products.</p>
          <h2>We are committed to empower our Consumers</h2>
          <p>If you are passionate about making a difference in the lives of customers, Join Us in our journey.</p>
          <h3>Technology Team</h3>
          <p>Interested in Data Science, Back-end Engineering, Full-stack development, UI/UX Design or Analytics roles?</p>
          <p>Send us your resume along with a cover letter at: careers+tech@paisabazaar.com</p>
          <h3>Product & Marketing Teams</h3>
          <p>Send us your resume along with a cover letter at: careers+product@paisabazaar.com</p>
          <h3>Operations Teams</h3>
          <p>Send us your resume along with a cover letter at: careers+operations@paisabazaar.com</p>
          <footer>CIN No. U74900HR2011PTC044581</footer>
        </main>
      </body>
    </html>
  `,
}

const publicJobsPage = {
  status: 200,
  url: 'https://www.paisabazaar.com/careers',
  html: `
    <!doctype html>
    <html lang="en">
      <body>
        <main>
          <h1>Current Openings</h1>
          <a href="/careers/software-engineer">Apply Now</a>
        </main>
      </body>
    </html>
  `,
}

const loadModule = async () => {
  try {
    return await import('../../scraper/paisabazaar/script.js')
  } catch {
    assert.fail('Expected Paisabazaar scraper module at ../../scraper/paisabazaar/script.js')
  }
}

test('Paisabazaar script helpers stay pinned to the verified first-party careers email-intake surface', async () => {
  const paisabazaar = await loadModule()

  assert.equal(paisabazaar.SOURCE, 'paisabazaar')
  assert.equal(paisabazaar.COMPANY, 'Paisabazaar')
  assert.equal(paisabazaar.CAREERS_URL, 'https://www.paisabazaar.com/careers')
  assert.equal(paisabazaar.VERIFIED_ON, '2026-07-17')
  assert.match(paisabazaar.VERIFIED_SURFACE_SUMMARY, /Paisabazaar/i)
  assert.equal(paisabazaar.hasOfficialCareersSignal(careersPage), true)
  assert.equal(paisabazaar.hasPublicRolePagesSignal(publicJobsPage.html), true)
})

test('Paisabazaar returns no jobs while the verified first-party careers surface stays resume-intake only', async () => {
  const paisabazaar = await loadModule()
  const requestedUrls = []

  const jobs = await paisabazaar.createPaisabazaarScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      return careersPage
    },
  })

  assert.deepEqual(requestedUrls, [paisabazaar.CAREERS_URL])
  assert.deepEqual(jobs, [])
})

test('Paisabazaar fails closed when the verified careers page drifts into a public jobs board', async () => {
  const paisabazaar = await loadModule()

  await assert.rejects(
    paisabazaar.createPaisabazaarScraper().run({
      fetchPage: async () => ({
        status: 200,
        url: paisabazaar.CAREERS_URL,
        html: '<html><body><h1>Careers</h1></body></html>',
      }),
    }),
    /verified Paisabazaar careers page/i,
  )

  await assert.rejects(
    paisabazaar.createPaisabazaarScraper().run({
      fetchPage: async () => publicJobsPage,
    }),
    /verified resume-intake-only state/i,
  )
})
