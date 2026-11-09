import assert from 'node:assert/strict'
import test from 'node:test'

const careersPageHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>CAREERS</h1>
    <h4>Zifo India</h4>
    <ul>
      <li><a href="/careers-form/assistant-manager---finance-19-4">Assistant Manager - Finance, Chennai</a></li>
    </ul>
    <p>We are happy to see your interest in joining our India team, but unfortunately we do not have any vacancies at this moment. Kindly submit your profile and we will reach out to you when any requirement arises in future.</p>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/zifo/script.js')
  } catch {
    assert.fail('Expected Zifo scraper module at ../../scraper/zifo/script.js')
  }
}

test('Zifo RnD Solutions retains its prior no-vacancies fixture for regression coverage', async () => {
  const zifo = await loadModule()

  assert.equal(zifo.SOURCE, 'zifo')
  assert.equal(zifo.COMPANY, 'Zifo RnD Solutions')
  assert.equal(zifo.OFFICIAL_BRAND_NAME, 'Zifo')
  assert.equal(zifo.CAREERS_URL, 'https://careers.zifo.com/')
  assert.equal(zifo.VERIFIED_ON, '2026-10-03')
  assert.equal(zifo.hasOfficialCareersSignal(careersPageHtml), true)
  assert.equal(zifo.hasNoCurrentVacanciesSignal(careersPageHtml), true)
  assert.deepEqual(zifo.extractStaleIndiaRoleTitles(careersPageHtml), ['Assistant Manager - Finance, Chennai'])
})

test('Zifo RnD Solutions rejects its old no-vacancies page without a current feed', async () => {
  const zifo = await loadModule()
  await assert.rejects(zifo.createZifoScraper().run({
    fetchText: async (url) => {
      assert.equal(url, zifo.CAREERS_URL)
      return careersPageHtml
    },
  }), /verified surface/i)
})

test('Zifo RnD Solutions sentinel fails closed when the verified page stops advertising no-current-vacancies', async () => {
  const zifo = await loadModule()

  await assert.rejects(
    zifo.createZifoScraper().run({
      fetchText: async () => `
        <html>
          <body>
            <h1>CAREERS</h1>
            <h4>Zifo India</h4>
            <ul>
              <li><a href="/careers-form/scientist---informatics-20-5">Scientist - Informatics, Bengaluru</a></li>
            </ul>
          </body>
        </html>
      `,
    }),
    /verified surface/i,
  )
})
