import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | Vymo</title>
    <meta name="description" content="We are reimagining enterprise applications with artificial intelligence and automation. Our solution has been validated by industry leaders from across domains."/>
    <link rel="canonical" href="https://vymo.com/careers/"/>
  </head>
  <body>
    <script>window.pagePath="/careers/";</script>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/vymotechnologies/script.js')
  } catch {
    assert.fail('Expected Vymo Technologies scraper module at ../../scraper/vymotechnologies/script.js')
  }
}

test('Vymo Technologies validator stays pinned to the verified first-party careers shell from Friday, July 17, 2026', async () => {
  const vymo = await loadModule()
  assert.equal(vymo.hasOfficialCareersSignal(careersHtml), true)
})

test('Vymo Technologies run validates the first-party careers shell and stays fail-closed', async () => {
  const vymo = await loadModule()
  const jobs = await vymo.createVymoTechnologiesScraper().run({
    fetchText: async () => careersHtml,
  })

  assert.deepEqual(jobs, [])
})
