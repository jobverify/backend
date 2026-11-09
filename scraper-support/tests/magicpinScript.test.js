import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Find your next job at magicpin</h1>
      <h2>This is where the magic happens!</h2>
      <section>
        <p>All open roles ()</p>
        <input placeholder="Search by job title" />
        <div>Department</div>
        <div>Location</div>
        <div>Experience</div>
        <div>Employment Type</div>
        <p>No Jobs found</p>
      </section>
    </main>
  </body>
</html>
`

const publicJobsHtml = careersHtml.replace(
  '<p>No Jobs found</p>',
  '<a href="/careers/senior-software-engineer">Senior Software Engineer</a><button>Apply Now</button>',
)

const driftedCareersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Careers</h1>
      <p>Placeholder</p>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/magicpin/script.js')
  } catch {
    assert.fail('Expected Magicpin scraper module at ../../scraper/magicpin/script.js')
  }
}

test('Magicpin recognizes the verified exact-name empty careers page', async () => {
  const magicpin = await loadModule()

  assert.equal(magicpin.SOURCE, 'magicpin')
  assert.equal(magicpin.COMPANY, 'Magicpin')
  assert.equal(magicpin.OFFICIAL_BRAND_NAME, 'magicpin')
  assert.equal(magicpin.VERIFIED_ON, '2026-07-16')
  assert.equal(magicpin.HOMEPAGE_URL, 'https://magicpin.in/')
  assert.equal(magicpin.CAREERS_URL, 'https://magicpin.in/careers')
  assert.equal(magicpin.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(magicpin.hasVerifiedEmptyCareersState(careersHtml), true)
  assert.equal(magicpin.pageExposesPublicJobListings(careersHtml), false)
  assert.equal(magicpin.pageExposesPublicJobListings(publicJobsHtml), true)
})

test('Magicpin returns [] while the verified first-party careers page stays in the no-jobs state', async () => {
  const magicpin = await loadModule()
  const requestedUrls = []

  const jobs = await magicpin.createMagicpinScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === magicpin.CAREERS_URL) {
        return { status: 200, url, html: careersHtml }
      }

      throw new Error(`Unexpected Magicpin URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [magicpin.CAREERS_URL])
  assert.deepEqual(jobs, [])
})

test('Magicpin fails closed when the first-party careers page drifts or starts exposing jobs', async () => {
  const magicpin = await loadModule()

  await assert.rejects(
    magicpin.createMagicpinScraper().run({
      fetchPage: async (url) => {
        if (url === magicpin.CAREERS_URL) {
          return { status: 200, url, html: driftedCareersHtml }
        }

        throw new Error(`Unexpected Magicpin URL: ${url}`)
      },
    }),
    /careers page/i,
  )

  await assert.rejects(
    magicpin.createMagicpinScraper().run({
      fetchPage: async (url) => {
        if (url === magicpin.CAREERS_URL) {
          return { status: 200, url, html: publicJobsHtml }
        }

        throw new Error(`Unexpected Magicpin URL: ${url}`)
      },
    }),
    /public jobs surface/i,
  )
})
