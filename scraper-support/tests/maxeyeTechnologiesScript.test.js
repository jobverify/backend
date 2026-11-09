import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'maxeyetechnologies',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const loadMaxEyeTechnologiesModule = async () => {
  try {
    return await import('../../scraper/maxeyetechnologies/script.js')
  } catch {
    assert.fail('Expected MaxEye Technologies scraper module at ../../scraper/maxeyetechnologies/script.js')
  }
}

const verifiedHomepageHtml = readFixture('homepage.html')
const verifiedContactHtml = readFixture('contact.html')
const currentHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Maxeye | Professional and Reliable Active Stylus Provider</title>
  </head>
  <body>
    <h1>Professional and Reliable Active Stylus Provider</h1>
    <a href="/contact/">contact us</a>
    <section>
      <h2>Why market-leading brands choose Maxeye</h2>
      <p>Maxeye specializes in offering comprehensive solutions for capacitive active styluses.</p>
    </section>
  </body>
</html>
`

test('MaxEye Technologies recognizes the verified homepage and hiring contact surface', async () => {
  const maxEyeTechnologies = await loadMaxEyeTechnologiesModule()

  assert.equal(maxEyeTechnologies.SOURCE, 'maxeyetechnologies')
  assert.equal(maxEyeTechnologies.COMPANY, 'MaxEye Technologies')
  assert.equal(maxEyeTechnologies.HOMEPAGE_URL, 'https://maxeye.com/')
  assert.equal(maxEyeTechnologies.CONTACT_URL, 'https://maxeye.com/contact/')
  assert.equal(maxEyeTechnologies.hasOfficialHomepageSignal(verifiedHomepageHtml), true)
  assert.equal(maxEyeTechnologies.hasHiringContactSignal(verifiedContactHtml), true)
  assert.equal(maxEyeTechnologies.hasPublicJobsSignal(verifiedHomepageHtml), false)
})

test('MaxEye Technologies accepts the current homepage wording and relative contact route', async () => {
  const maxEyeTechnologies = await loadMaxEyeTechnologiesModule()

  assert.equal(maxEyeTechnologies.hasOfficialHomepageSignal(currentHomepageHtml), true)
})

test('MaxEye Technologies returns no jobs while the verified homepage and hiring contact stay unchanged', async () => {
  const maxEyeTechnologies = await loadMaxEyeTechnologiesModule()
  const requestedUrls = []

  const jobs = await maxEyeTechnologies.createMaxEyeTechnologiesScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === maxEyeTechnologies.HOMEPAGE_URL) {
        return verifiedHomepageHtml
      }

      if (url === maxEyeTechnologies.CONTACT_URL) {
        return verifiedContactHtml
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    maxEyeTechnologies.HOMEPAGE_URL,
    maxEyeTechnologies.CONTACT_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('MaxEye Technologies fails closed when the verified homepage or hiring contact changes materially', async () => {
  const maxEyeTechnologies = await loadMaxEyeTechnologiesModule()

  await assert.rejects(
    maxEyeTechnologies.createMaxEyeTechnologiesScraper().run({
      fetchText: async (url) => {
        if (url === maxEyeTechnologies.HOMEPAGE_URL) {
          return '<html><body><h1>Unexpected homepage</h1></body></html>'
        }

        return verifiedContactHtml
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    maxEyeTechnologies.createMaxEyeTechnologiesScraper().run({
      fetchText: async (url) => {
        if (url === maxEyeTechnologies.HOMEPAGE_URL) return verifiedHomepageHtml
        return '<html><body><p>No hiring contact here</p></body></html>'
      },
    }),
    /verified hiring contact/i,
  )
})
