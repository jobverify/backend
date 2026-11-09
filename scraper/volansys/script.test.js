import assert from 'node:assert/strict'
import test from 'node:test'

import {
  BLOCKED_ROUTE_URLS,
  PARENT_CAREERS_URL,
  hasAclDigitalRecruitmentSignal,
  isBlockedVolansysResponse,
  run,
} from './script.js'

const parentCareersHtml = `
  <html>
    <head><title>ACL Digital</title></head>
    <body>
      <h1>ACL Digital Job Portal</h1>
      <nav><a href="Search/">Search Jobs</a></nav>
      <div>Job Seekers/ New Hire</div>
      <p>Looking for a job? We can help you find the best jobs in seconds !!!</p>
    </body>
  </html>
`

test('Volansys recognizes the current ACL Digital parent recruitment shell and 522 blocked-route sentinel', () => {
  assert.equal(PARENT_CAREERS_URL, 'https://recruitment.acldigital.com/Default.aspx')
  assert.equal(hasAclDigitalRecruitmentSignal(parentCareersHtml), true)
  assert.equal(
    isBlockedVolansysResponse({
      status: 522,
      html: '<html><title>volansys.com | 522: Connection timed out</title><body>Error code: 522</body></html>',
    }),
    true,
  )
})

test('Volansys run stays fail-closed after validating the parent shell and blocked official routes', async () => {
  const requestedUrls = []
  const jobs = await run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      if (url === PARENT_CAREERS_URL) {
        return { status: 200, url, html: parentCareersHtml }
      }

      if (BLOCKED_ROUTE_URLS.includes(url)) {
        return {
          status: 522,
          url,
          html: '<html><title>volansys.com | 522: Connection timed out</title><body>Error code: 522</body></html>',
        }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [PARENT_CAREERS_URL, ...BLOCKED_ROUTE_URLS])
  assert.deepEqual(jobs, [])
})
