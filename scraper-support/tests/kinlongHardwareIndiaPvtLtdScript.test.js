import assert from 'node:assert/strict'
import path from 'node:path'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const fixturesDir = path.join(currentDir, 'fixtures', 'kinlonghardwareindiapvtltd')

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const homepageHtml = readFixture('homepage.html')
const careersHtml = readFixture('career.html')
const contactHtml = readFixture('contact.html')

test('KINLONG Hardware India verifies the official homepage, career page, and India contact listing', async () => {
  const kinlong = await import('../../scraper/kinlonghardwareindiapvtltd/script.js')

  assert.equal(kinlong.SOURCE, 'kinlonghardwareindiapvtltd')
  assert.equal(kinlong.COMPANY, 'KINLONG HARDWARE INDIAPVT. LTD')
  assert.equal(kinlong.HOMEPAGE_URL, 'https://en.kinlong.com/')
  assert.equal(kinlong.CAREERS_URL, 'https://en.kinlong.com/career.html')
  assert.equal(kinlong.CONTACT_URL, 'https://en.kinlong.com/contact.html')

  assert.equal(kinlong.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(kinlong.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(kinlong.hasIndiaSubsidiarySignal(contactHtml), true)
  assert.equal(kinlong.hasPublicJobsSignal(careersHtml), false)
})

test('KINLONG Hardware India returns no jobs while the verified first-party surface is email-only', async () => {
  const kinlong = await import('../../scraper/kinlonghardwareindiapvtltd/script.js')
  const requestedUrls = []

  const jobs = await kinlong.createKinlongHardwareIndiaScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === kinlong.HOMEPAGE_URL) return homepageHtml
      if (url === kinlong.CAREERS_URL) return careersHtml
      if (url === kinlong.CONTACT_URL) return contactHtml

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    kinlong.HOMEPAGE_URL,
    kinlong.CAREERS_URL,
    kinlong.CONTACT_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('KINLONG Hardware India fails closed when the first-party zero-job surface drifts to public jobs or loses India verification', async () => {
  const kinlong = await import('../../scraper/kinlonghardwareindiapvtltd/script.js')

  await assert.rejects(
    kinlong.createKinlongHardwareIndiaScraper().run({
      fetchText: async (url) => {
        if (url === kinlong.HOMEPAGE_URL) return '<html><body><h1>Welcome</h1></body></html>'
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /official homepage/i,
  )

  await assert.rejects(
    kinlong.createKinlongHardwareIndiaScraper().run({
      fetchText: async (url) => {
        if (url === kinlong.HOMEPAGE_URL) return homepageHtml
        if (url === kinlong.CAREERS_URL) {
          return careersHtml.replace(
            '</body>',
            '<p>Browse our current openings and apply now.</p></body>',
          )
        }
        if (url === kinlong.CONTACT_URL) return contactHtml

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /public jobs surface|zero-job state/i,
  )

  await assert.rejects(
    kinlong.createKinlongHardwareIndiaScraper().run({
      fetchText: async (url) => {
        if (url === kinlong.HOMEPAGE_URL) return homepageHtml
        if (url === kinlong.CAREERS_URL) return careersHtml
        if (url === kinlong.CONTACT_URL) {
          return contactHtml.replace('KINLONG HARDWARE (INDIA) PRIVATE LIMITED', 'KINLONG HARDWARE (NEPAL) PRIVATE LIMITED')
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /india subsidiary|contact surface/i,
  )
})
