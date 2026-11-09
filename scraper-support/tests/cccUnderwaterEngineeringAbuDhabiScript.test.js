import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const fixturesDir = path.join(currentDir, 'fixtures', 'cccunderwaterengineeringabudhabi')

const loadFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const homepageHtml = loadFixture('homepage.html')
const contactHtml = loadFixture('connect-with-us.html')
const careersHtml = loadFixture('careers.html')

const loadModule = async () => {
  try {
    return await import('../../scraper/cccunderwaterengineeringabudhabi/script.js')
  } catch {
    assert.fail('Expected CCC Underwater Engineering, Abu Dhabi scraper module at ../../scraper/cccunderwaterengineeringabudhabi/script.js')
  }
}

test('CCC Underwater Engineering, Abu Dhabi scraper pins the verified CCC homepage, contact entry, and careers CV form', async () => {
  const ccc = await loadModule()
  const currentNestedSubmitCvLinkHtml = contactHtml.replace(
    'Submit your CV',
    '<span>Submit your CV</span>',
  )

  assert.equal(ccc.SOURCE, 'cccunderwaterengineeringabudhabi')
  assert.equal(ccc.COMPANY, 'CCC Underwater Engineering, Abu Dhabi')
  assert.equal(ccc.HOMEPAGE_URL, 'https://www.ccc.net/')
  assert.equal(ccc.CONTACT_URL, 'https://www.ccc.net/connect-with-us/')
  assert.equal(ccc.CAREERS_URL, 'https://www.ccc.net/careers/')
  assert.equal(ccc.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(ccc.hasVerifiedContactSignal(contactHtml), true)
  assert.equal(ccc.extractSubmitCvUrl(contactHtml), ccc.CAREERS_URL)
  assert.equal(ccc.extractSubmitCvUrl(currentNestedSubmitCvLinkHtml), ccc.CAREERS_URL)
  assert.equal(ccc.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(ccc.hasPublicJobListingsSignal(careersHtml), false)
})

test('CCC Underwater Engineering, Abu Dhabi returns no jobs while the verified first-party CV form remains the only public hiring surface', async () => {
  const ccc = await loadModule()
  const requestedUrls = []

  const jobs = await ccc.createCccUnderwaterEngineeringAbuDhabiScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === ccc.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === ccc.CONTACT_URL) {
        return { status: 200, url, html: contactHtml }
      }

      if (url === ccc.CAREERS_URL) {
        return { status: 200, url, html: careersHtml }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    ccc.HOMEPAGE_URL,
    ccc.CONTACT_URL,
    ccc.CAREERS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('CCC Underwater Engineering, Abu Dhabi fails closed when the official group linkage drifts or public listings appear', async () => {
  const ccc = await loadModule()

  await assert.rejects(
    ccc.createCccUnderwaterEngineeringAbuDhabiScraper().run({
      fetchPage: async (url) => {
        if (url === ccc.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === ccc.CONTACT_URL) {
          return {
            status: 200,
            url,
            html: contactHtml.replace(
              'https://www.ccc.net/careers/',
              'https://www.ccc.net/join-us/',
            ),
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified careers handoff/i,
  )

  await assert.rejects(
    ccc.createCccUnderwaterEngineeringAbuDhabiScraper().run({
      fetchPage: async (url) => {
        if (url === ccc.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === ccc.CONTACT_URL) {
          return { status: 200, url, html: contactHtml }
        }

        if (url === ccc.CAREERS_URL) {
          return {
            status: 200,
            url,
            html: `${careersHtml}
              <section>
                <h2>Current Openings</h2>
                <article class="job-card">
                  <h3>Marine Project Engineer</h3>
                  <p>Abu Dhabi</p>
                </article>
              </section>`,
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /public job listings/i,
  )
})
