import assert from 'node:assert/strict'
import test from 'node:test'

const officialContactHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h2>CONTACT US</h2>
      <p>Explore Job Openings at</p>
      <a href="https://careers.smartrecruiters.com/CloudMoyo/">United States</a>
      <a href="https://careers.smartrecruiters.com/CloudMoyo/cloudmoyo-india-careers">Pune, India</a>
      <p>Career Opportunities</p>
      <p>recruitment@cloudmoyo.com</p>
      <a href="https://careers.smartrecruiters.com/CloudMoyo/cloudmoyo-india-careers">View India openings</a>
    </main>
  </body>
</html>
`

const emptyBoardHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>CloudMoyo</h1>
      <h2>Why Work for us?</h2>
      <h3>Current Openings - India</h3>
      <p>No job postings are currently available.</p>
    </main>
  </body>
</html>
`

const publicBoardHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>CloudMoyo</h1>
      <h3>Current Openings - India</h3>
      <a href="https://jobs.smartrecruiters.com/CloudMoyo/744000140000001-full-stack-developer">Full Stack Developer</a>
      <p>Pune, India</p>
    </main>
  </body>
</html>
`

const zeroListingsPayload = {
  totalFound: 0,
  content: [],
}

const publicListingsPayload = {
  totalFound: 1,
  content: [
    {
      id: '744000140000001',
      name: 'Full Stack Developer',
      location: {
        fullLocation: 'Pune, India',
      },
    },
  ],
}

const loadModule = async () => {
  try {
    return await import('../../scraper/cloudmoyo/script.js')
  } catch {
    assert.fail('Expected CloudMoyo scraper module at ../../scraper/cloudmoyo/script.js')
  }
}

test('CloudMoyo helpers stay pinned to the verified contact-page handoff and empty India SmartRecruiters board from Friday, July 17, 2026', async () => {
  const cloudmoyo = await loadModule()

  assert.equal(cloudmoyo.SOURCE, 'cloudmoyo')
  assert.equal(cloudmoyo.COMPANY, 'CloudMoyo')
  assert.equal(cloudmoyo.VERIFIED_ON, '2026-07-17')
  assert.equal(cloudmoyo.CONTACT_URL, 'https://www.cloudmoyo.com/contact-us/')
  assert.equal(
    cloudmoyo.BOARD_URL,
    'https://careers.smartrecruiters.com/CloudMoyo/cloudmoyo-india-careers?remoteLocation=true',
  )
  assert.equal(
    cloudmoyo.LISTINGS_API_URL,
    'https://api.smartrecruiters.com/v1/companies/CloudMoyo/postings?limit=100&offset=0',
  )
  assert.equal(cloudmoyo.hasOfficialContactSignal(officialContactHtml), true)
  assert.equal(cloudmoyo.hasVerifiedEmptyBoardSignal(emptyBoardHtml), true)
  assert.equal(cloudmoyo.hasVerifiedZeroListingsSignal(zeroListingsPayload), true)
  assert.equal(cloudmoyo.hasVerifiedZeroListingsSignal(publicListingsPayload), false)
  assert.equal(cloudmoyo.pageExposesPublicJobListings(emptyBoardHtml), false)
  assert.equal(cloudmoyo.pageExposesPublicJobListings(publicBoardHtml), true)
})

test('CloudMoyo returns [] while the verified public SmartRecruiters API stays at zero listings', async () => {
  const cloudmoyo = await loadModule()
  const requestedUrls = []
  const requestedJson = []

  const jobs = await cloudmoyo.createCloudMoyoScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === cloudmoyo.CONTACT_URL) return officialContactHtml
      throw new Error(`Unexpected CloudMoyo URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJson.push(url)
      if (url === cloudmoyo.LISTINGS_API_URL) return zeroListingsPayload
      throw new Error(`Unexpected CloudMoyo JSON URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [cloudmoyo.CONTACT_URL])
  assert.deepEqual(requestedJson, [cloudmoyo.LISTINGS_API_URL])
  assert.deepEqual(jobs, [])
})

test('CloudMoyo rejects an unrelated contact page and preserves a newly nonempty legacy observation as partial', async () => {
  const cloudmoyo = await loadModule()

  await assert.rejects(
    cloudmoyo.createCloudMoyoScraper().run({
      fetchText: async () => '<html><body>Contact</body></html>',
      fetchJson: async () => zeroListingsPayload,
    }),
    /contact page/i,
  )

  const jobs = await cloudmoyo.createCloudMoyoScraper().run({
    fetchText: async () => officialContactHtml,
    fetchJson: async () => publicListingsPayload,
  })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Full Stack Developer')
  assert.equal(jobs[0].jobDescription, null)
  assert.equal(jobs[0].sourceDetailComplete, false)
  assert.equal(jobs[0].applicationUrlIsGeneric, true)
  const { readInventoryEvidence } = await import('../utils/inventoryEvidence.js')
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
})
