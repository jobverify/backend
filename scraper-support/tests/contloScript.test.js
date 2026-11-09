import assert from 'node:assert/strict'
import test from 'node:test'

const loadContloModule = async () => import('../../scraper/contlo/script.js')

const successorSiteHtml = `
  <html>
    <head><title>SuperAGI | AI Super App for Work</title></head>
    <body><h1>AI Super App for Work</h1></body>
  </html>
`

test('run returns no jobs when Contlo redirects to its official successor site without public careers', async () => {
  const contlo = await loadContloModule()
  const requestedUrls = []

  const jobs = await contlo.createContloScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return successorSiteHtml
    },
  })

  assert.deepEqual(requestedUrls, [contlo.CAREER_PAGE_URL])
  assert.deepEqual(jobs, [])
})

test('run returns no jobs when Contlo responds with the official successor redirect', async () => {
  const contlo = await loadContloModule()

  const jobs = await contlo.createContloScraper().run({
    fetchPage: async (url) => {
      assert.equal(url, contlo.CAREER_PAGE_URL)
      return {
        status: 301,
        redirected: true,
        location: 'https://web.superagi.com/',
        html: '',
      }
    },
  })

  assert.deepEqual(jobs, [])
})

test('run rejects an unexpected Contlo landing page', async () => {
  const contlo = await loadContloModule()

  await assert.rejects(
    contlo.createContloScraper().run({ fetchText: async () => '<html><body>Unknown site</body></html>' }),
    /official successor site/i,
  )
})
