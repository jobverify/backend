import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const loadGenworxModule = async () => {
  try {
    return await import('../../scraper/genworx/script.js')
  } catch {
    assert.fail('Expected Genworx scraper module at ../../scraper/genworx/script.js')
  }
}

const homepageHtml = readFileSync(
  new URL('./fixtures/genworx/homepage.html', import.meta.url),
  'utf8',
)

const routesBundle = readFileSync(
  new URL('./fixtures/genworx/routes.js', import.meta.url),
  'utf8',
)

test('Genworx constants stay pinned to the verified official homepage and current no-careers route bundle', async () => {
  const genworx = await loadGenworxModule()

  assert.equal(genworx.SOURCE, 'genworx')
  assert.equal(genworx.COMPANY, 'Genworx')
  assert.equal(genworx.HOME_URL, 'https://genworx.ai/')
  assert.equal(genworx.CAREERS_URL, 'https://genworx.ai/careers')
  assert.equal(genworx.JOBS_URL, 'https://genworx.ai/jobs')
  assert.equal(genworx.CAREER_URL, 'https://genworx.ai/career')
  assert.equal(genworx.JOIN_US_URL, 'https://genworx.ai/join-us')
  assert.equal(genworx.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(genworx.extractBundlePath(homepageHtml), '/assets/index-DDL8jli4.js')
  assert.deepEqual(genworx.extractStaticRoutes(routesBundle), [
    '/',
    '/about',
    '/contact',
    '/blog',
    '/blog/:slug',
    '/how-we-deliver',
    '/genies/timeiq',
    '/team',
    '*',
  ])
})

test('Genworx scraper returns no jobs while the first-party site remains a marketing SPA without public careers routes', async () => {
  const genworx = await loadGenworxModule()
  const requestedUrls = []

  const jobs = await genworx.createGenworxScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === genworx.HOME_URL) return homepageHtml
      if (url === 'https://genworx.ai/assets/index-DDL8jli4.js') return routesBundle
      if (
        url === genworx.CAREERS_URL
        || url === genworx.JOBS_URL
        || url === genworx.CAREER_URL
        || url === genworx.JOIN_US_URL
      ) {
        return homepageHtml
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    genworx.HOME_URL,
    'https://genworx.ai/assets/index-DDL8jli4.js',
    genworx.CAREERS_URL,
    genworx.JOBS_URL,
    genworx.CAREER_URL,
    genworx.JOIN_US_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Genworx scraper fails closed when a careers route appears or a checked route stops behaving like the verified SPA shell', async () => {
  const genworx = await loadGenworxModule()

  await assert.rejects(
    genworx.createGenworxScraper().run({
      fetchText: async (url) => {
        if (url === genworx.HOME_URL) return homepageHtml
        if (url === 'https://genworx.ai/assets/index-DDL8jli4.js') {
          return routesBundle.replace(
            'a.jsx(Dt,{path:"/team",element:a.jsx(sp,{})}),a.jsx(Dt,{path:"*",element:a.jsx(wk,{})})',
            'a.jsx(Dt,{path:"/team",element:a.jsx(sp,{})}),a.jsx(Dt,{path:"/careers",element:a.jsx(hi,{})}),a.jsx(Dt,{path:"*",element:a.jsx(wk,{})})',
          )
        }
        return homepageHtml
      },
    }),
    /public careers route/i,
  )

  await assert.rejects(
    genworx.createGenworxScraper().run({
      fetchText: async (url) => {
        if (url === genworx.HOME_URL) return homepageHtml
        if (url === 'https://genworx.ai/assets/index-DDL8jli4.js') return routesBundle
        if (url === genworx.JOBS_URL) {
          return '<html><body><h1>Jobs at Genworx</h1><a href=\"/apply\">Apply now</a></body></html>'
        }
        return homepageHtml
      },
    }),
    /first-party route now differs from the verified marketing shell/i,
  )
})
