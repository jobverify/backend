import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const loadKaizenInstituteModule = async () => {
  try {
    return await import('../../scraper/kaizeninstitute/script.js')
  } catch {
    assert.fail('Expected Kaizen Institute scraper module at ../../scraper/kaizeninstitute/script.js')
  }
}

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const fixturesDir = path.join(currentDir, 'fixtures', 'kaizeninstitute')

const homepageHtml = readFileSync(path.join(fixturesDir, 'homepage.html'), 'utf8')
const careersHtml = readFileSync(path.join(fixturesDir, 'careers-in.html'), 'utf8')

test('Kaizen Institute scraper validates the verified India homepage and email-only careers surface', async () => {
  const kaizenInstitute = await loadKaizenInstituteModule()

  assert.equal(kaizenInstitute.SOURCE, 'kaizeninstitute')
  assert.equal(kaizenInstitute.COMPANY, 'Kaizen Institute')
  assert.equal(kaizenInstitute.HOMEPAGE_URL, 'https://kaizen.com/in/')
  assert.equal(kaizenInstitute.CAREERS_URL, 'https://kaizen.com/in/careers-in/')
  assert.equal(kaizenInstitute.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(kaizenInstitute.hasOfficialCareersSignal(careersHtml), true)
  assert.deepEqual(kaizenInstitute.extractSuspiciousPublicJobLinks(careersHtml), [])
})

test('Kaizen Institute scraper returns no jobs while the verified first-party India surfaces remain email-only', async () => {
  const kaizenInstitute = await loadKaizenInstituteModule()
  const requestedUrls = []

  const jobs = await kaizenInstitute.createKaizenInstituteScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === kaizenInstitute.HOMEPAGE_URL) {
        return { status: 200, url, headers: {}, html: homepageHtml }
      }

      if (url === kaizenInstitute.CAREERS_URL) {
        return { status: 200, url, headers: {}, html: careersHtml }
      }

      throw new Error(`Unexpected page URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [kaizenInstitute.HOMEPAGE_URL, kaizenInstitute.CAREERS_URL])
  assert.deepEqual(jobs, [])
})

test('Kaizen Institute scraper fails closed when the homepage or careers page drifts into a public jobs surface', async () => {
  const kaizenInstitute = await loadKaizenInstituteModule()

  await assert.rejects(
    kaizenInstitute.createKaizenInstituteScraper().run({
      fetchPage: async (url) => {
        if (url === kaizenInstitute.HOMEPAGE_URL) {
          return { status: 200, url, headers: {}, html: '<html><title>Unexpected</title></html>' }
        }

        return { status: 200, url, headers: {}, html: careersHtml }
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    kaizenInstitute.createKaizenInstituteScraper().run({
      fetchPage: async (url) => {
        if (url === kaizenInstitute.HOMEPAGE_URL) {
          return { status: 200, url, headers: {}, html: homepageHtml }
        }

        return {
          status: 200,
          url,
          headers: {},
          html: careersHtml.replace(
            'mailto:in@kaizen.com',
            'https://jobs.kaizen.com/india/consultant',
          ),
        }
      },
    }),
    /public job links|public jobs surface/i,
  )

  await assert.rejects(
    kaizenInstitute.createKaizenInstituteScraper().run({
      fetchPage: async (url) => {
        if (url === kaizenInstitute.HOMEPAGE_URL) {
          return { status: 200, url, headers: {}, html: homepageHtml }
        }

        return {
          status: 200,
          url,
          headers: {},
          html: careersHtml.replace(
            '</body>',
            '<a href="/in/jobs/">View jobs</a></body>',
          ),
        }
      },
    }),
    /public job links|public jobs surface/i,
  )
})
