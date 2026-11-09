import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'invoxeltechnologies',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const verifiedHomepageHtml = readFixture('homepage.html')
const verifiedBundleJs = readFixture('careers-bundle.js')
const verified404Html = readFixture('404.html')

const loadModule = async () => {
  try {
    return await import('../../scraper/invoxeltechnologies/script.js')
  } catch {
    assert.fail('Expected Invoxel Technologies scraper module at ../../scraper/invoxeltechnologies/script.js')
  }
}

test('Invoxel Technologies sentinels recognize the verified homepage, careers bundle, and missing public routes', async () => {
  const invoxel = await loadModule()

  assert.equal(invoxel.SOURCE, 'invoxeltechnologies')
  assert.equal(invoxel.COMPANY, 'Invoxel Technologies')
  assert.equal(invoxel.HOMEPAGE_URL, 'https://www.invoxel.com/')
  assert.equal(invoxel.CAREERS_URL, 'https://www.invoxel.com/careers/')
  assert.equal(invoxel.extractBundlePath(verifiedHomepageHtml), '/reactassets/index-D3z9zpQc.js')
  assert.equal(invoxel.hasOfficialHomepageSignal(verifiedHomepageHtml), true)
  assert.equal(invoxel.hasVerifiedCareersShellSignal(verifiedBundleJs), true)
  assert.equal(invoxel.hasPublicJobSignal(verifiedBundleJs), false)
  assert.equal(invoxel.hasPublicJobSignal(verified404Html), false)
})

test('Invoxel Technologies returns no jobs while the verified homepage and careers shell stay intact', async () => {
  const invoxel = await loadModule()
  const requestedUrls = []

  const jobs = await invoxel.createInvoxelTechnologiesScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === invoxel.HOMEPAGE_URL) {
        return { status: 200, url, html: verifiedHomepageHtml }
      }

      if (url === new URL('/reactassets/index-D3z9zpQc.js', invoxel.HOMEPAGE_URL).toString()) {
        return { status: 200, url, html: verifiedBundleJs }
      }

      if (
        url === invoxel.CAREERS_URL
        || url === invoxel.CAREER_URL
        || url === invoxel.JOBS_URL
        || url === invoxel.JOIN_US_URL
      ) {
        return { status: 404, url, html: verified404Html }
      }

      throw new Error(`Unexpected page URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    invoxel.HOMEPAGE_URL,
    new URL('/reactassets/index-D3z9zpQc.js', invoxel.HOMEPAGE_URL).toString(),
    invoxel.CAREERS_URL,
    invoxel.CAREER_URL,
    invoxel.JOBS_URL,
    invoxel.JOIN_US_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Invoxel Technologies fails closed when the homepage shell, careers bundle, or public route contract changes', async () => {
  const invoxel = await loadModule()

  await assert.rejects(
    invoxel.createInvoxelTechnologiesScraper().run({
      fetchPage: async (url) => ({
        status: 200,
        url,
        html: url === invoxel.HOMEPAGE_URL
          ? '<html><head><title>Unexpected</title></head><body>Broken</body></html>'
          : verifiedBundleJs,
      }),
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    invoxel.createInvoxelTechnologiesScraper().run({
      fetchPage: async (url) => {
        if (url === invoxel.HOMEPAGE_URL) {
          return { status: 200, url, html: verifiedHomepageHtml }
        }

        if (url === new URL('/reactassets/index-D3z9zpQc.js', invoxel.HOMEPAGE_URL).toString()) {
          return {
            status: 200,
            url,
            html: `${verifiedBundleJs}\nCurrent Openings`,
          }
        }

        return { status: 404, url, html: verified404Html }
      },
    }),
    /public job listings/i,
  )

  await assert.rejects(
    invoxel.createInvoxelTechnologiesScraper().run({
      fetchPage: async (url) => {
        if (url === invoxel.HOMEPAGE_URL) {
          return { status: 200, url, html: verifiedHomepageHtml }
        }

        if (url === new URL('/reactassets/index-D3z9zpQc.js', invoxel.HOMEPAGE_URL).toString()) {
          return { status: 200, url, html: verifiedBundleJs }
        }

        return {
          status: url === invoxel.CAREERS_URL ? 200 : 404,
          url,
          html: verified404Html,
        }
      },
    }),
    /verified no-public-careers route changed/i,
  )
})
