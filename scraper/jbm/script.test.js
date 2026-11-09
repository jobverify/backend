import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const loadJbmModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected JBM scraper module at ./script.js')
  }
}

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const homepageHtml = fs.readFileSync(path.join(currentDir, 'fixtures/homepage.html'), 'utf8')
const careersHtml = fs.readFileSync(path.join(currentDir, 'fixtures/our-people.html'), 'utf8')

test('JBM scraper validates the verified first-party homepage and our-people zero-jobs surface', async () => {
  const jbm = await loadJbmModule()

  assert.equal(jbm.SOURCE, 'jbm')
  assert.equal(jbm.COMPANY, 'JBM')
  assert.equal(jbm.HOMEPAGE_URL, 'https://www.jbmgroup.com/')
  assert.equal(jbm.CAREERS_URL, 'https://www.jbmgroup.com/our-people/')
  assert.equal(jbm.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(jbm.hasOfficialCareersSignal(careersHtml), true)
  assert.deepEqual(jbm.extractSuspiciousPublicJobLinks(careersHtml), [])
})

test('JBM scraper returns no jobs while the verified homepage and careers page remain stable', async () => {
  const jbm = await loadJbmModule()
  const requestedUrls = []

  const jobs = await jbm.createJbmScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === jbm.HOMEPAGE_URL) {
        return { status: 200, url, headers: {}, html: homepageHtml }
      }

      if (url === jbm.CAREERS_URL) {
        return { status: 200, url, headers: {}, html: careersHtml }
      }

      throw new Error(`Unexpected page URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [jbm.HOMEPAGE_URL, jbm.CAREERS_URL])
  assert.deepEqual(jobs, [])
})

test('JBM scraper fails closed when the homepage or careers surface changes materially', async () => {
  const jbm = await loadJbmModule()

  await assert.rejects(
    jbm.createJbmScraper().run({
      fetchPage: async (url) => {
        if (url === jbm.HOMEPAGE_URL) {
          return { status: 200, url, headers: {}, html: '<html><title>Unexpected</title></html>' }
        }

        return { status: 200, url, headers: {}, html: careersHtml }
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    jbm.createJbmScraper().run({
      fetchPage: async (url) => {
        if (url === jbm.HOMEPAGE_URL) {
          return { status: 200, url, headers: {}, html: homepageHtml }
        }

        return {
          status: 200,
          url,
          headers: {},
          html: careersHtml.replace(
            '</main>',
            '<a href="https://jobs.greenhouse.io/jbm">Current openings</a></main>',
          ),
        }
      },
    }),
    /public job links|public jobs surface/i,
  )

  await assert.rejects(
    jbm.createJbmScraper().run({
      fetchPage: async (url) => {
        if (url === jbm.HOMEPAGE_URL) {
          return { status: 200, url, headers: {}, html: homepageHtml }
        }

        return {
          status: 200,
          url,
          headers: {},
          html: careersHtml.replace('</main>', '<a href="/jobs/openings">View jobs</a></main>'),
        }
      },
    }),
    /public job links|public jobs surface/i,
  )
})
