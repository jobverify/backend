import assert from 'node:assert/strict'
import test from 'node:test'

const officialHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Paramtech Engineering Services Private Limited</title>
  </head>
  <body>
    <nav>
      <a href="about-us.php">WHO WE ARE</a>
      <a href="career.php">Careers</a>
      <a href="contact-us.php">Contact Us</a>
    </nav>
    <main>
      <h1>Empowering Innovation with the Spirit of Giving</h1>
      <section>
        <h2>Product Design</h2>
        <p>We specialize in innovative product design services tailored to meet the unique needs of the automotive, manufacturing, industrial, and heavy engineering sectors.</p>
      </section>
      <section>
        <h2>Electric vehicle</h2>
        <p>We provied End-to-end design and development of high-performance, reliable battery systems.</p>
      </section>
      <section>
        <h2>Our Client Reviews</h2>
        <p>
          We as SCHINDLER CRD &amp; Global function team, wanted to congratulate
          Paramtech CAD Services Pvt Ltd on your determination to finish all the Inventio project.
        </p>
      </section>
    </main>
    <footer>
      <p>Paramtech Engineering Services Private Limited.</p>
      <p>Spot-18, Suite No - 717, 7th Floor, Pimple Saudagar, Rahatani, Pune - 411017</p>
      <p>info@paramtechnologies.in</p>
      <p>+91 87702 67488</p>
    </footer>
  </body>
</html>
`

const aboutHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Paramtech Engineering Services Private Limited</title>
  </head>
  <body>
    <main>
      <h1>Who we are</h1>
      <p>
        Paramtech Engineering Services Private Limited is an engineering partner to global OEMs
        including Fortune 500 companies delivering end-to-end solutions across Automotive,
        Aerospace, Industrial, and Elevator sectors.
      </p>
      <p>For 17+ years we’ve covered the full product lifecycle.</p>
      <p>With 7,500+ successful placements, clients trust us to integrate quickly.</p>
      <p>Helping ourselves by helping others</p>
    </main>
  </body>
</html>
`

const contactHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Paramtech Engineering Services Private Limited</title>
  </head>
  <body>
    <main>
      <h1>Contact Us</h1>
      <p>Reach Us</p>
      <p>Paramtech Engineering Services Private Limited.</p>
      <p>Spot-18, Suite No - 717, 7th Floor, Pimple Saudagar, Rahatani, Pune - 411017</p>
      <p>+91 87702 67488</p>
      <p>info@paramtechnologies.in</p>
      <p>Send Us an Inquiry</p>
    </main>
  </body>
</html>
`

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Paramtech Engineering Services Private Limited</title>
  </head>
  <body>
    <nav>
      <a href="career.php">Careers</a>
      <a href="contact-us.php">Contact Us</a>
    </nav>
    <main>
      <h1>Career</h1>
      <p>
        Join Paramtech Engineering Services Private Limited, where innovation, engineering excellence,
        and a people-first culture drive everything we do.
      </p>
      <h2>Current Openings</h2>
      <p>Coming Soon... Stay Tuned</p>
      <p>Product Design &amp; Development</p>
      <p>Recruitment &amp; Staffing</p>
      <p>Embedded Systems</p>
      <p>CAD/CAE Engineers</p>
      <p>Electrical &amp; Electronics</p>
      <p>Testing &amp; Validation Engineers</p>
    </main>
    <footer>
      <p>info@paramtechnologies.in</p>
    </footer>
  </body>
</html>
`

const publicJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Paramtech Engineering Services Private Limited</title>
  </head>
  <body>
    <main>
      <h1>Career</h1>
      <h2>Current Openings</h2>
      <article class="job-card">
        <h3>Design Engineer</h3>
        <p>Location: Pune</p>
        <a href="/apply/design-engineer">Apply Now</a>
      </article>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

test('Paramtech CAD Services sentinel recognizes the verified first-party site and empty careers shell', async () => {
  const paramtech = await loadModule()
  assert.ok(paramtech, 'Expected scraper module at ./script.js')

  assert.equal(paramtech.SOURCE, 'paramtechcadservicespvtltd')
  assert.equal(paramtech.COMPANY, 'Paramtech Cad Services Pvt. Ltd.')
  assert.equal(paramtech.HOMEPAGE_URL, 'https://www.paramtechnologies.in/')
  assert.equal(paramtech.ABOUT_URL, 'https://www.paramtechnologies.in/about-us.php')
  assert.equal(paramtech.CONTACT_URL, 'https://www.paramtechnologies.in/contact-us.php')
  assert.equal(paramtech.CAREERS_URL, 'https://www.paramtechnologies.in/career.php')

  assert.equal(paramtech.hasOfficialHomepageSignal(officialHomepageHtml), true)
  assert.equal(paramtech.hasOfficialAboutSignal(aboutHtml), true)
  assert.equal(paramtech.hasOfficialContactSignal(contactHtml), true)
  assert.equal(paramtech.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(paramtech.hasNoPublicJobListingsSignal(careersHtml), true)
  assert.equal(paramtech.hasPublicJobListingsSignal(careersHtml), false)
})

test('Paramtech CAD Services sentinel returns no jobs while the first-party careers page stays on the verified empty state', async () => {
  const paramtech = await loadModule()
  assert.ok(paramtech, 'Expected scraper module at ./script.js')

  const requestedUrls = []
  const jobs = await paramtech.createParamtechCadServicesScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === paramtech.HOMEPAGE_URL) return officialHomepageHtml
      if (url === paramtech.ABOUT_URL) return aboutHtml
      if (url === paramtech.CONTACT_URL) return contactHtml
      if (url === paramtech.CAREERS_URL) return careersHtml

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    paramtech.HOMEPAGE_URL,
    paramtech.ABOUT_URL,
    paramtech.CONTACT_URL,
    paramtech.CAREERS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Paramtech CAD Services sentinel fails closed when the exact-company proof or empty careers shell drifts', async () => {
  const paramtech = await loadModule()
  assert.ok(paramtech, 'Expected scraper module at ./script.js')

  await assert.rejects(
    paramtech.createParamtechCadServicesScraper().run({
      fetchText: async (url) => {
        if (url === paramtech.HOMEPAGE_URL) {
          return '<html><body><h1>Unexpected homepage</h1></body></html>'
        }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /homepage no longer matches the verified exact-company surface/i,
  )

  await assert.rejects(
    paramtech.createParamtechCadServicesScraper().run({
      fetchText: async (url) => {
        if (url === paramtech.HOMEPAGE_URL) return officialHomepageHtml
        if (url === paramtech.ABOUT_URL) return aboutHtml
        if (url === paramtech.CONTACT_URL) return contactHtml
        if (url === paramtech.CAREERS_URL) return publicJobsHtml
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /careers page (?:no longer matches the verified empty-shell surface|now exposes public job listings or changed shape)/i,
  )
})
