import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html>
  <body>
    <h1>Works Applications (India)</h1>
    <p>Formerly known as Infoview</p>
    <a href="mailto:hr-office@ivtlinfoview.co.jp">Mail: wai-hr@worksap.co.jp</a>
    <p>Talk to our experts right away!</p>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/ivtlinfoviewtechnologies/script.js')
  } catch {
    assert.fail('Expected IVTL Infoview Technologies scraper module at ../../scraper/ivtlinfoviewtechnologies/script.js')
  }
}

test('IVTL Infoview Technologies validators stay pinned to the verified Works Applications India homepage from Saturday, July 18, 2026', async () => {
  const ivtl = await loadModule()
  assert.equal(ivtl.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(ivtl.hasContactOnlySignal(homepageHtml), true)
})

test('IVTL Infoview Technologies stays fail-closed while the first-party surface remains homepage-only', async () => {
  const ivtl = await loadModule()
  const jobs = await ivtl.createIvtlInfoviewTechnologiesScraper().run({
    fetchText: async (url) => {
      assert.equal(url, ivtl.HOMEPAGE_URL)
      return homepageHtml
    },
  })

  assert.deepEqual(jobs, [])
})
