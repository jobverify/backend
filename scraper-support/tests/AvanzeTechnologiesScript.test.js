import assert from 'node:assert/strict'
import test from 'node:test'

const careersPageHtml = `
<!doctype html>
<html>
  <head>
    <title>Looking for a job change? Visit our Career Pages | Avanze</title>
  </head>
  <body>
    <h2 class="sec_title white">Join Our Team!</h2>
    <!-- <a class="common_btn red_bg" href="career-subpage.html"><span>current openings</span></a> -->
    <a href="contact.php" class="common_btn" id="pop_fifteen"><span>current openings</span></a>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/avanzetechnologies/script.js')
  } catch {
    assert.fail('Expected Avanze Technologies scraper module at ../../scraper/avanzetechnologies/script.js')
  }
}

test('Avanze Technologies validators stay pinned to the careers contact handoff page from Saturday, July 18, 2026', async () => {
  const avanze = await loadModule()
  assert.equal(avanze.hasOfficialCareersSignal(careersPageHtml), true)
  assert.equal(avanze.hasContactHandoffOnlySignal(careersPageHtml), true)
})

test('Avanze Technologies stays fail-closed while current openings still route to contact.php', async () => {
  const avanze = await loadModule()
  const jobs = await avanze.createAvanzeTechnologiesScraper().run({
    fetchText: async (url) => {
      assert.equal(url, avanze.CAREERS_URL)
      return careersPageHtml
    },
  })

  assert.deepEqual(jobs, [])
})
