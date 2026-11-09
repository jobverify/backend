import assert from 'node:assert/strict'
import test from 'node:test'

const CURRENT_CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Careers</h1>
      <p>Engineer the systems that power intelligent enterprises and grow with a team that values disciplined execution and shared ownership.</p>
      <a href="#join-our-team">View Opportunities</a>
      <a href="/company/careers/openings">View Open Positions</a>
    </main>
  </body>
</html>
`

const CURRENT_OPENINGS_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Current Openings</h1>
      <p>Find your place in the Bitwise family.</p>
      <p>All Locations</p>
      <p>All Types</p>
      <p>Keep Up with Bitwise News!</p>
    </main>
  </body>
</html>
`

const OPENINGS_WITH_JOB_RECORDS_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Current Openings</h1>
      <a href="/company/careers/openings/senior-data-engineer">Senior Data Engineer</a>
      <p>Apply Now</p>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/bitwisesolutions/script.js')
  } catch {
    assert.fail('Expected Bitwise Solutions scraper module at ../../scraper/bitwisesolutions/script.js')
  }
}

test('Bitwise Solutions accepts the current careers and zero-openings shells', async () => {
  const bitwise = await loadModule()

  assert.equal(bitwise.SOURCE, 'bitwisesolutions')
  assert.equal(bitwise.COMPANY, 'Bitwise Solutions')
  assert.equal(bitwise.CAREERS_URL, 'https://www.bitwiseglobal.com/company/careers')
  assert.equal(bitwise.OPENINGS_URL, 'https://www.bitwiseglobal.com/company/careers/openings')
  assert.equal(bitwise.hasOfficialCareersSignal(CURRENT_CAREERS_HTML), true)
  assert.equal(bitwise.hasNoOpeningsSignal(CURRENT_OPENINGS_HTML), true)
  assert.equal(bitwise.hasNoOpeningsSignal(OPENINGS_WITH_JOB_RECORDS_HTML), false)
})

test('Bitwise Solutions returns [] while the current openings page exposes no job records', async () => {
  const bitwise = await loadModule()
  const requestedUrls = []

  const jobs = await bitwise.createBitwiseSolutionsScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === bitwise.CAREERS_URL) return CURRENT_CAREERS_HTML
      if (url === bitwise.OPENINGS_URL) return CURRENT_OPENINGS_HTML
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [bitwise.CAREERS_URL, bitwise.OPENINGS_URL])
  assert.deepEqual(jobs, [])
})
