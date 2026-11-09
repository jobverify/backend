import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - iFedora.com</title>
  </head>
  <body>
    <main>
      <h1>Careers</h1>
      <h2>Join the Fedora team!</h2>
      <p>Fedora offers a high paced and competitive environment to kickstart your career.</p>
      <h3>Apply Now!</h3>
      <p>Interested candidates are invited to submit their resume to recruitment@ifedora.com.</p>
      <p>Domain Expertise in Medical Billing and Coding</p>
    </main>
  </body>
</html>
`

const contactHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Contact - iFedora.com</title>
  </head>
  <body>
    <main>
      <h1>Contact</h1>
      <p>21, Fedora, Magnet Corporate Park, 380059, Thaltej, Ahmedabad, Gujarat, India</p>
      <p>Please do not use this form to inquire about job vacancies or to apply for roles at Fedora.</p>
      <p>recruitment@ifedora.com</p>
    </main>
  </body>
</html>
`

const structuredJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - iFedora.com</title>
  </head>
  <body>
    <main>
      <h2>Join the Fedora team!</h2>
      <h3>Apply Now!</h3>
      <p>Interested candidates are invited to submit their resume to recruitment@ifedora.com.</p>
      <h1>Current Openings</h1>
      <article class="job-card">
        <h2>AR Executive</h2>
        <a href="/careers/ar-executive">Apply Now</a>
      </article>
    </main>
  </body>
</html>
`

const loadFedoraModule = async () => {
  try {
    return await import('../../scraper/fedorasolutions/script.js')
  } catch {
    assert.fail('Expected Fedora Solutions scraper module at ../../scraper/fedorasolutions/script.js')
  }
}

test('Fedora Solutions returns [] only while the verified careers surface remains email-only', async () => {
  const fedora = await loadFedoraModule()
  const requestedUrls = []

  assert.equal(fedora.hasOfficialFedoraCareersSignals(careersHtml), true)
  assert.equal(fedora.hasOfficialFedoraContactSignals(contactHtml), true)
  assert.equal(fedora.pageExposesStructuredJobListings(careersHtml), false)

  const jobs = await fedora.createFedoraSolutionsScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === fedora.OFFICIAL_CAREERS_URL) return careersHtml
      if (url === fedora.CONTACT_PAGE_URL) return contactHtml
      throw new Error(`Unexpected Fedora Solutions URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://www.ifedora.com/careers/',
    'https://www.ifedora.com/contact-in/',
  ])
  assert.deepEqual(jobs, [])
})

test('Fedora Solutions fails closed when structured public jobs appear on the verified careers page', async () => {
  const fedora = await loadFedoraModule()

  await assert.rejects(
    fedora.createFedoraSolutionsScraper().run({
      fetchText: async (url) => {
        if (url === fedora.OFFICIAL_CAREERS_URL) return structuredJobsHtml
        if (url === fedora.CONTACT_PAGE_URL) return contactHtml
        throw new Error(`Unexpected Fedora Solutions URL: ${url}`)
      },
    }),
    /structured public job listings/i,
  )
})

test('Fedora Solutions fails closed when the verified first-party careers identity drifts', async () => {
  const fedora = await loadFedoraModule()

  await assert.rejects(
    fedora.createFedoraSolutionsScraper().run({
      fetchText: async (url) => {
        if (url === fedora.OFFICIAL_CAREERS_URL) return '<html><body>Unknown</body></html>'
        throw new Error(`Unexpected Fedora Solutions URL: ${url}`)
      },
    }),
    /official careers surface changed/i,
  )
})
