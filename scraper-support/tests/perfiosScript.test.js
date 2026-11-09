import assert from 'node:assert/strict'
import test from 'node:test'
import {thirdWaveTransport} from '../../test/helpers/darwinboxThirdWaveFixture.js'

import {
  CAREERS_PAGE_URL,
  DARWINBOX_URL,
  createPerfiosScraper,
} from '../../scraper/perfios/script.js'

test('Perfios rejects the retired body-only SSO sentinel before trusting an empty result', async () => {
  const requestedUrls = []
  const scraper = createPerfiosScraper()

  await assert.rejects(scraper.run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === CAREERS_PAGE_URL) {
        return '<a href="https://perfios.darwinbox.in">Lead with Us</a>'
      }
      return '<title>Perfios : Login</title><h3>Single sign on</h3><a>Perfios SSO</a>'
    },
  }), /native HTTP metadata required; body-only overrides unsupported/)

  assert.deepEqual(requestedUrls, [])
})

test('Perfios refuses current inventory when the advertised legacy company does not enable its declared v2 transition', async () => {
  const scraper = createPerfiosScraper()
  const http = thirdWaveTransport('perfios', row => {
    if (row.url.endsWith('/companyinfo')) {
      const payload = JSON.parse(row.body)
      payload.message.company.new_careers = false
      row.body = JSON.stringify(payload)
    }
  })

  await assert.rejects(
    scraper.run(http),
    /legacy company does not establish current v2 transition/,
  )
})
