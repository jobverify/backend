import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Sagar Defence Engineering</title>
  </head>
  <body>
    <main>
      <h1>Sagar Defence Engineering</h1>
      <nav>
        <a href="/about-us/">About Us</a>
        <a href="/careers/">Careers</a>
        <a href="/contact/">Contact</a>
      </nav>
      <p>Autonomous maritime and defence systems.</p>
    </main>
  </body>
</html>
`

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | Sagar Defence</title>
  </head>
  <body>
    <main>
      <h1>Careers</h1>
      <p>Send your resume and your goals to careers@sagardefence.com.</p>
      <p>We are always excited to hear from people building next-generation defence systems.</p>
    </main>
  </body>
</html>
`

const currentCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers &#8211; Sagar Defence Engineering | Unmanned Systems</title>
  </head>
  <body>
    <main>
      <h1>Careers</h1>
      <p>SDE provides a challenging and conducive work environment.</p>
      <p>At SDE, we truly believe that the strength of a company lies in its human resources and we take it as our responsibility to look after the career development of our employees.</p>
      <p>Then send us your resume and goals to careers@sagardefence.com. If we think there's a fit, it won't be long before you hear from us.</p>
    </main>
  </body>
</html>
`

const contactHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Contact | Sagar Defence</title>
  </head>
  <body>
    <main>
      <h1>Contact</h1>
      <p>Email: info@sagardefence.com</p>
      <p>Pune</p>
    </main>
  </body>
</html>
`

test('Sagar Defence scraper validates the verified homepage, email-only careers page, and contact page', async () => {
  const sagar = await loadModule()
  assert.ok(sagar, 'Sagar Defence scraper module should load')

  assert.equal(sagar.SOURCE, 'sagardefence')
  assert.equal(sagar.COMPANY, 'Sagar Defence Engineering')
  assert.equal(sagar.HOMEPAGE_URL, 'https://www.sagardefence.com/')
  assert.equal(sagar.CAREERS_URL, 'https://www.sagardefence.com/careers/')
  assert.equal(sagar.CONTACT_URL, 'https://www.sagardefence.com/contact/')
  assert.equal(sagar.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(sagar.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(sagar.hasOfficialContactSignal(contactHtml), true)
  assert.equal(sagar.extractApplicationEmail(careersHtml), 'careers@sagardefence.com')
  assert.equal(sagar.hasUnexpectedPublicJobsSignal(careersHtml), false)
})

test('Sagar Defence scraper recognizes the current live careers page as the same email-only public surface', async () => {
  const sagar = await loadModule()
  assert.ok(sagar, 'Sagar Defence scraper module should load')

  assert.equal(sagar.hasOfficialCareersSignal(currentCareersHtml), true)
  assert.equal(sagar.extractApplicationEmail(currentCareersHtml), 'careers@sagardefence.com')
  assert.equal(sagar.hasUnexpectedPublicJobsSignal(currentCareersHtml), false)
})

test('Sagar Defence scraper returns no jobs while the verified careers surface remains email-only', async () => {
  const sagar = await loadModule()
  assert.ok(sagar, 'Sagar Defence scraper module should load')

  const requestedUrls = []
  const jobs = await sagar.createSagarDefenceScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      if (url === sagar.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
      if (url === sagar.CAREERS_URL) return { status: 200, url, html: careersHtml }
      if (url === sagar.CONTACT_URL) return { status: 200, url, html: contactHtml }
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    sagar.HOMEPAGE_URL,
    sagar.CAREERS_URL,
    sagar.CONTACT_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Sagar Defence scraper fails closed when the homepage, careers page, or contact page drifts into an unexpected state', async () => {
  const sagar = await loadModule()
  assert.ok(sagar, 'Sagar Defence scraper module should load')

  await assert.rejects(
    sagar.createSagarDefenceScraper().run({
      fetchPage: async () => ({ status: 200, url: sagar.HOMEPAGE_URL, html: '<html><body>Unexpected</body></html>' }),
    }),
    /official homepage/i,
  )

  await assert.rejects(
    sagar.createSagarDefenceScraper().run({
      fetchPage: async (url) => {
        if (url === sagar.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === sagar.CAREERS_URL) {
          return {
            status: 200,
            url,
            html: careersHtml.replace(
              '</main>',
              '<a href="https://jobs.lever.co/sagardefence/systems-engineer">Current Openings</a></main>',
            ),
          }
        }
        if (url === sagar.CONTACT_URL) return { status: 200, url, html: contactHtml }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /careers page now exposes public jobs/i,
  )

  await assert.rejects(
    sagar.createSagarDefenceScraper().run({
      fetchPage: async (url) => {
        if (url === sagar.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === sagar.CAREERS_URL) return { status: 200, url, html: careersHtml }
        if (url === sagar.CONTACT_URL) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Placeholder contact</h1></body></html>',
          }
        }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /contact page/i,
  )
})
