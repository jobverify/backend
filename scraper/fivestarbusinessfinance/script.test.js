import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREER_PAGE_URL,
  HOMEPAGE_URL,
  createFiveStarBusinessFinanceScraper,
  hasOfficialCareersShellSignal,
  hasOfficialHomepageSignal,
} from './script.js'

const homepageHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Five Star Group</title>
    </head>
    <body>
      <p>Financial Solutions For Your Business Needs</p>
      <p>Five Star at a Glance</p>
      <p>Branches</p>
      <p>Employees</p>
      <p>Five-Star Business Finance Limited</p>
      <a href="https://fivestargroup.in/careers/">Careers</a>
      <p>customercare@fivestargroup.in</p>
      <p>info@fivestargroup.in</p>
      <p>CIN: L65991TN1984PLC010844</p>
    </body>
  </html>
`

const careersHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Careers &#8211; Five Star Group</title>
    </head>
    <body>
      <h1>Careers</h1>
      <h2>Company Culture</h2>
      <p>Interested in partnering with market leader for Small Business Loans?</p>
      <p>Contact us</p>
      <p>Five-Star Business Finance Limited</p>
      <p>info@fivestargroup.in</p>
    </body>
  </html>
`

test('Five Star Business Finance accepts the current careers title entity encoding', () => {
  assert.equal(hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(hasOfficialCareersShellSignal(careersHtml), true)
})

test('Five Star Business Finance run returns [] while the homepage and careers shell still match the verified empty-state surface', async () => {
  const requestedUrls = []

  const jobs = await createFiveStarBusinessFinanceScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      if (url === HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
      if (url === CAREER_PAGE_URL) return { status: 200, url, html: careersHtml }
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [HOMEPAGE_URL, CAREER_PAGE_URL])
  assert.deepEqual(jobs, [])
})
