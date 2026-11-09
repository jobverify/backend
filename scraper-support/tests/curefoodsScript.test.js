import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Careers - Curefoods</title>
    <meta name="description" content="Career opportunities at Curefoods">
  </head>
  <body>
    <h1>Careers at Curefoods</h1>
    <p>Build iconic food brands with Curefoods.</p>
    <a href="https://www.linkedin.com/authwall?trk=bf&amp;trkInfo=opaque&amp;original_referer=&amp;sessionRedirect=https%3A%2F%2Fwww.linkedin.com%2Fcompany%2Fcurefoods%2Fjobs%2F%3FviewAsMember%3Dtrue">
      Check out our LinkedIn Page to discover the latest job openings and learn more about how you can join the Curefoods family.
    </a>
    <p>Email careers@curefoods.in to share your profile.</p>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/curefoods/script.js')
  } catch {
    assert.fail('Expected Curefoods scraper module at ../../scraper/curefoods/script.js')
  }
}

test('Curefoods sentinel validates the verified first-party page and LinkedIn handoff', async () => {
  const curefoods = await loadModule()

  assert.equal(curefoods.SOURCE, 'curefoods')
  assert.equal(curefoods.COMPANY, 'Curefoods')
  assert.equal(curefoods.CAREERS_URL, 'https://www.curefoods.in/pages/careers')
  assert.equal(curefoods.APPLICATION_EMAIL, 'careers@curefoods.in')
  assert.equal(
    curefoods.VERIFIED_LINKEDIN_URL,
    'https://www.linkedin.com/company/curefoods/',
  )
  assert.equal(curefoods.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(
    curefoods.extractLinkedInJobsUrl(careersHtml),
    'https://www.linkedin.com/company/curefoods/',
  )
  assert.equal(curefoods.pageExposesFirstPartyJobRecords(careersHtml), false)
})

test('Curefoods sentinel returns no jobs while the verified page still only links out to LinkedIn', async () => {
  const curefoods = await loadModule()
  const requestedUrls = []

  const jobs = await curefoods.createCurefoodsScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return careersHtml
    },
  })

  assert.deepEqual(requestedUrls, [curefoods.CAREERS_URL])
  assert.deepEqual(jobs, [])
})

test('Curefoods sentinel fails closed if the verified careers page drifts', async () => {
  const curefoods = await loadModule()

  await assert.rejects(
    curefoods.createCurefoodsScraper().run({
      fetchText: async () => '<html><body><h1>Careers</h1></body></html>',
    }),
    /verified Curefoods careers surface/i,
  )
})
