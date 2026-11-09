import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const loadMyWaysModule = async () => {
  try {
    return await import('../../scraper/mywaysai/script.js')
  } catch {
    assert.fail('Expected MyWays.ai scraper module at ../../scraper/mywaysai/script.js')
  }
}

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const fixturesDir = path.join(currentDir, 'fixtures', 'mywaysai')

const homepageHtml = readFileSync(path.join(fixturesDir, 'homepage.html'), 'utf8')
const opportunityHtml = readFileSync(path.join(fixturesDir, 'opportunity.html'), 'utf8')
const opportunityBundleJs = readFileSync(path.join(fixturesDir, 'opportunity-page.js'), 'utf8')
const technologyJobsHtml = readFileSync(path.join(fixturesDir, 'technology-jobs.html'), 'utf8')
const opportunityJobsHtml = readFileSync(path.join(fixturesDir, 'opportunity-jobs.html'), 'utf8')
const opportunityInternshipsHtml = readFileSync(path.join(fixturesDir, 'opportunity-internships.html'), 'utf8')

test('MyWays.ai scraper pins the verified first-party homepage, handoff bundle, and zero-job public routes', async () => {
  const myways = await loadMyWaysModule()

  assert.equal(myways.SOURCE, 'mywaysai')
  assert.equal(myways.COMPANY, 'MyWays.ai')
  assert.equal(myways.HOMEPAGE_URL, 'https://myways.ai/')
  assert.equal(myways.OPPORTUNITY_URL, 'https://myways.ai/opportunity')
  assert.equal(myways.TECHNOLOGY_JOBS_URL, 'https://myways.ai/technology-jobs')
  assert.equal(myways.OPPORTUNITY_JOBS_URL, 'https://myways.ai/opportunity/jobs')
  assert.equal(myways.OPPORTUNITY_INTERNSHIPS_URL, 'https://myways.ai/opportunity/internships')
  assert.equal(myways.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(myways.hasOfficialOpportunityShellSignal(opportunityHtml), true)
  assert.equal(
    myways.extractOpportunityBundleAssetPath(opportunityHtml),
    '/_next/static/chunks/pages/opportunity-6150b4f61c6d20d0.js',
  )
  assert.equal(myways.hasOpportunityBundleRedirectSignal(opportunityBundleJs), true)
  assert.equal(myways.hasOfficialTechnologyJobsSignal(technologyJobsHtml), true)
  assert.deepEqual(myways.extractTechnologyJobsData(technologyJobsHtml), {
    opportunities: [],
    latest: [],
  })
  assert.equal(myways.hasTechnologyJobsZeroState(technologyJobsHtml), true)
  assert.equal(myways.hasZeroJobsTypeRouteSignal(opportunityJobsHtml, 'jobs'), true)
  assert.equal(myways.hasZeroJobsTypeRouteSignal(opportunityInternshipsHtml, 'internships'), true)
})

test('MyWays.ai scraper returns no jobs while the verified first-party public jobs routes stay empty', async () => {
  const myways = await loadMyWaysModule()
  const requestedUrls = []

  const jobs = await myways.createMyWaysScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === myways.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === myways.OPPORTUNITY_URL) {
        return { status: 200, url, html: opportunityHtml }
      }

      if (url === myways.TECHNOLOGY_JOBS_URL) {
        return { status: 200, url, html: technologyJobsHtml }
      }

      if (url === myways.OPPORTUNITY_JOBS_URL) {
        return { status: 200, url, html: opportunityJobsHtml }
      }

      if (url === myways.OPPORTUNITY_INTERNSHIPS_URL) {
        return { status: 200, url, html: opportunityInternshipsHtml }
      }

      throw new Error(`Unexpected page URL: ${url}`)
    },
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === new URL('/_next/static/chunks/pages/opportunity-6150b4f61c6d20d0.js', myways.HOMEPAGE_URL).toString()) {
        return opportunityBundleJs
      }

      throw new Error(`Unexpected text URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    myways.HOMEPAGE_URL,
    myways.OPPORTUNITY_URL,
    'https://myways.ai/_next/static/chunks/pages/opportunity-6150b4f61c6d20d0.js',
    myways.TECHNOLOGY_JOBS_URL,
    myways.OPPORTUNITY_JOBS_URL,
    myways.OPPORTUNITY_INTERNSHIPS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('MyWays.ai scraper fails closed when the verified first-party handoff or zero-job routes drift', async () => {
  const myways = await loadMyWaysModule()

  await assert.rejects(
    myways.createMyWaysScraper().run({
      fetchPage: async (url) => {
        if (url === myways.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: '<html><head><title>Placeholder</title></head><body>Welcome</body></html>',
          }
        }

        if (url === myways.OPPORTUNITY_URL) return { status: 200, url, html: opportunityHtml }
        if (url === myways.TECHNOLOGY_JOBS_URL) return { status: 200, url, html: technologyJobsHtml }
        if (url === myways.OPPORTUNITY_JOBS_URL) return { status: 200, url, html: opportunityJobsHtml }
        if (url === myways.OPPORTUNITY_INTERNSHIPS_URL) return { status: 200, url, html: opportunityInternshipsHtml }
        throw new Error(`Unexpected page URL: ${url}`)
      },
      fetchText: async () => opportunityBundleJs,
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    myways.createMyWaysScraper().run({
      fetchPage: async (url) => {
        if (url === myways.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === myways.OPPORTUNITY_URL) return { status: 200, url, html: opportunityHtml }
        if (url === myways.TECHNOLOGY_JOBS_URL) return { status: 200, url, html: technologyJobsHtml }
        if (url === myways.OPPORTUNITY_JOBS_URL) return { status: 200, url, html: opportunityJobsHtml }
        if (url === myways.OPPORTUNITY_INTERNSHIPS_URL) return { status: 200, url, html: opportunityInternshipsHtml }
        throw new Error(`Unexpected page URL: ${url}`)
      },
      fetchText: async () => opportunityBundleJs.replace('/technology-jobs', '/somewhere-else'),
    }),
    /handoff bundle/i,
  )

  await assert.rejects(
    myways.createMyWaysScraper().run({
      fetchPage: async (url) => {
        if (url === myways.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === myways.OPPORTUNITY_URL) return { status: 200, url, html: opportunityHtml }
        if (url === myways.TECHNOLOGY_JOBS_URL) {
          return {
            status: 200,
            url,
            html: technologyJobsHtml.replace(
              '"opportunities":[],"latest":[]',
              '"opportunities":[{"_id":"job-1","title":"Software Engineer"}],"latest":[]',
            ),
          }
        }

        if (url === myways.OPPORTUNITY_JOBS_URL) return { status: 200, url, html: opportunityJobsHtml }
        if (url === myways.OPPORTUNITY_INTERNSHIPS_URL) return { status: 200, url, html: opportunityInternshipsHtml }
        throw new Error(`Unexpected page URL: ${url}`)
      },
      fetchText: async () => opportunityBundleJs,
    }),
    /technology jobs surface now exposes public openings/i,
  )

  await assert.rejects(
    myways.createMyWaysScraper().run({
      fetchPage: async (url) => {
        if (url === myways.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === myways.OPPORTUNITY_URL) return { status: 200, url, html: opportunityHtml }
        if (url === myways.TECHNOLOGY_JOBS_URL) return { status: 200, url, html: technologyJobsHtml }
        if (url === myways.OPPORTUNITY_JOBS_URL) {
          return {
            status: 200,
            url,
            html: opportunityJobsHtml.replace(
              '"opportunities":[]',
              '"opportunities":[{"_id":"job-2","title":"Data Analyst"}]',
            ).replace('No Data', 'Open role'),
          }
        }

        if (url === myways.OPPORTUNITY_INTERNSHIPS_URL) return { status: 200, url, html: opportunityInternshipsHtml }
        throw new Error(`Unexpected page URL: ${url}`)
      },
      fetchText: async () => opportunityBundleJs,
    }),
    /jobs route now exposes public openings/i,
  )
})
