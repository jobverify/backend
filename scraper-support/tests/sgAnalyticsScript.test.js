import assert from 'node:assert/strict'
import test from 'node:test'

const officialPageHtml = `
  <html>
    <body>
      <h1>Current Opening</h1>
      <div>Business Insights Corporate Data Analytics ESG Services Investment Insights Technology Services</div>
      <h2>Disclaimer And Notification</h2>
      <p>If you meet our position requirements and can see yourself at SG Analytics, we invite you to apply by e-mailing your resume and cover letter to us at careers@sganalytics.com.</p>
    </body>
  </html>
`

const emptyFragmentHtml = '   \n  '

test('SG Analytics scraper verifies the official current openings page and returns no jobs when the public listing fragment is empty', async () => {
  const sgAnalytics = await import('../../scraper/sganalytics/script.js')
  const requests = []

  assert.equal(
    sgAnalytics.CAREERS_URL,
    'https://www.sganalytics.com/careers/jobs/',
  )
  assert.equal(
    sgAnalytics.LISTING_FRAGMENT_URL,
    'https://www.sganalytics.com/careers/current-opening.get_related_jobs?ajax=true',
  )
  assert.equal(typeof sgAnalytics.hasOfficialCareersSignal, 'function')
  assert.equal(typeof sgAnalytics.hasEmailApplyFallback, 'function')
  assert.equal(typeof sgAnalytics.hasVisibleOpeningsSignal, 'function')
  assert.equal(typeof sgAnalytics.createSgAnalyticsScraper, 'function')

  const jobs = await sgAnalytics.createSgAnalyticsScraper().run({
    fetchText: async (url, options = {}) => {
      requests.push({ url, options })
      if (url === sgAnalytics.CAREERS_URL) return officialPageHtml
      if (url === sgAnalytics.LISTING_FRAGMENT_URL) return emptyFragmentHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requests, [
    { url: sgAnalytics.CAREERS_URL, options: {} },
    {
      url: sgAnalytics.LISTING_FRAGMENT_URL,
      options: {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: 'o_unit=&search_k=',
      },
    },
  ])
  assert.deepEqual(jobs, [])
})

test('SG Analytics scraper fails closed when the verified page-level email handoff disappears', async () => {
  const sgAnalytics = await import('../../scraper/sganalytics/script.js')

  await assert.rejects(
    () => sgAnalytics.createSgAnalyticsScraper().run({
      fetchText: async (url) => {
        if (url === sgAnalytics.CAREERS_URL) {
          return '<html><body><h1>Current Opening</h1><div>Business Insights Corporate Data Analytics</div></body></html>'
        }
        return emptyFragmentHtml
      },
    }),
    /verified email apply fallback/i,
  )
})
