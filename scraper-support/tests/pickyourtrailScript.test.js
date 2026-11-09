import assert from 'node:assert/strict'
import test from 'node:test'

const loadPickyourtrailModule = async () => {
  try {
    return await import('../../scraper/pickyourtrail/script.js')
  } catch {
    assert.fail('Expected Pickyourtrail scraper module at ../../scraper/pickyourtrail/script.js')
  }
}

const careersPageHtml = `
<!doctype html>
<html lang="en-IN">
  <head>
    <title>Careers at Pickyourtrail: Join Our Travel Team</title>
    <meta
      name="description"
      content="We’re always looking for amazing people to join our team. Take a look at our current opening roles and apply!"
    />
  </head>
  <body>
    <main>
      <section>
        <div class="veho-c-gqwkJN veho-c-gqwkJN-iTKOFX-direction-column veho-c-gqwkJN-iiKNzEw-css">
          <div class="veho-c-gqwkJN veho-c-gqwkJN-iFhAwE-css">
            <span>Travel Consultant - Gurgaon</span>
            <span>Sales</span>
          </div>
          <div class="veho-c-gqwkJN veho-c-gqwkJN-iiwKtld-css">
            <div class="veho-c-gqwkJN veho-c-gqwkJN-ihliXqb-css">
              <div class="veho-c-lesPJm veho-c-lesPJm-idSMhyY-css"><span>Gurgaon</span></div>
            </div>
            <button><span>Read more</span></button>
          </div>
        </div>
        <div class="veho-c-gqwkJN veho-c-gqwkJN-iTKOFX-direction-column veho-c-gqwkJN-iiKNzEw-css">
          <div class="veho-c-gqwkJN veho-c-gqwkJN-iFhAwE-css">
            <span>Sales Consultant</span>
            <span>Sales</span>
          </div>
          <div class="veho-c-gqwkJN veho-c-gqwkJN-iiwKtld-css">
            <div class="veho-c-gqwkJN veho-c-gqwkJN-ihliXqb-css">
              <div class="veho-c-lesPJm veho-c-lesPJm-idSMhyY-css"><span>1 - 3 yrs</span></div>
              <div class="veho-c-lesPJm veho-c-lesPJm-idSMhyY-css"><span>Chennai</span></div>
            </div>
            <button><span>Read more</span></button>
          </div>
        </div>
      </section>
      <section>
        <span>Engineering</span>
        <span>Internship Programme @ Pickyourtrail</span>
      </section>
      <footer>
        <a href="mailto:careers@pickyourtrail.com">careers@pickyourtrail.com</a>
        <a href="mailto:planners@pickyourtrail.com">planners@pickyourtrail.com</a>
      </footer>
    </main>
  </body>
</html>
`

test('hasOfficialCareersSignal validates the verified Pickyourtrail careers surface', async () => {
  const picky = await loadPickyourtrailModule()

  assert.equal(picky.hasOfficialCareersSignal(careersPageHtml), true)
  assert.equal(picky.extractApplyEmail(careersPageHtml), 'mailto:careers@pickyourtrail.com')
})

test('extractListings maps public Pickyourtrail job cards from the official careers page', async () => {
  const picky = await loadPickyourtrailModule()

  assert.deepEqual(picky.extractListings(careersPageHtml), [
    {
      title: 'Travel Consultant - Gurgaon',
      company: 'Pickyourtrail',
      department: 'Sales',
      location: 'Gurgaon',
      city: 'Gurgaon',
      country: 'India',
      jobId: 'travel-consultant-gurgaon',
      requisitionId: 'travel-consultant-gurgaon',
      experienceRequired: null,
      sourceUrl: 'https://pickyourtrail.com/careers',
      applyUrl: 'mailto:careers@pickyourtrail.com',
    },
    {
      title: 'Sales Consultant',
      company: 'Pickyourtrail',
      department: 'Sales',
      location: 'Chennai',
      city: 'Chennai',
      country: 'India',
      jobId: 'sales-consultant',
      requisitionId: 'sales-consultant',
      experienceRequired: '1 - 3 yrs',
      sourceUrl: 'https://pickyourtrail.com/careers',
      applyUrl: 'mailto:careers@pickyourtrail.com',
    },
  ])
})

test('run fetches the official Pickyourtrail careers page and decorates the final jobs', async () => {
  const picky = await loadPickyourtrailModule()
  const requestedUrls = []

  const jobs = await picky.createPickyourtrailScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === picky.CAREERS_URL) return careersPageHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
    now: () => '2026-07-10T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [picky.CAREERS_URL])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'pickyourtrail')
  assert.equal(jobs[0].link, picky.CAREERS_URL)
  assert.equal(jobs[0].scrapedAt, '2026-07-10T00:00:00.000Z')
})

test('run fails closed when the verified Pickyourtrail careers signal disappears', async () => {
  const picky = await loadPickyourtrailModule()

  await assert.rejects(
    picky.createPickyourtrailScraper().run({
      fetchText: async () => '<html><body>No official Pickyourtrail roles here</body></html>',
    }),
    /verified Pickyourtrail careers surface/i,
  )
})
