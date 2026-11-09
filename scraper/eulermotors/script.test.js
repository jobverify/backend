import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_BOARD_URL,
  buildJobsApiUrl,
  createEulerMotorsScraper,
  extractCompanyContext,
  hasCareersSurfaceSignal,
} from './script.js'

const companyContext = {
  companyName: 'Euler Motors',
  companySlug: 'euler-motors',
  companyUuid: 'AD8D0AD806',
}

const careersShellHtml = `
  <h4>Careers at Euler Motors</h4>
  <div>Loading jobs...</div>
  <div>Hiring Powered By</div>
  <script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
    props: {
      pageProps: {
        companyDetails: {
          name: companyContext.companyName,
          slug: companyContext.companySlug,
          uuid: companyContext.companyUuid,
          url: 'https://www.eulermotors.com',
        },
      },
    },
    query: { company: companyContext.companySlug },
  })}</script>
`

test('pins the Euler Motors public PyjamaHR board to its exact company context', () => {
  assert.equal(CAREERS_BOARD_URL, 'https://jobs.pyjamahr.com/euler-motors')
  assert.equal(hasCareersSurfaceSignal(careersShellHtml), true)
  assert.deepEqual(extractCompanyContext(careersShellHtml), companyContext)
  assert.equal(
    buildJobsApiUrl(companyContext.companyUuid),
    'https://api.pyjamahr.com/api/career/jobs/?company_uuid=AD8D0AD806&page=1&is_careers_page=false',
  )
})

test('accepts the current server-rendered board shell before its dynamic heading loads', () => {
  const serverRenderedShell = careersShellHtml.replace('<h4>Careers at Euler Motors</h4>', '')
  assert.equal(hasCareersSurfaceSignal(serverRenderedShell), true)
})

test('fails closed when the public board does not identify Euler Motors', async () => {
  await assert.rejects(
    createEulerMotorsScraper().run({
      fetchText: async () => careersShellHtml.replace('"Euler Motors"', '"Another Company"'),
    }),
    /expected exact company context/i,
  )
})
