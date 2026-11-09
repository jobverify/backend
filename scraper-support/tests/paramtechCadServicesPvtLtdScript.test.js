import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
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
    <section>
      <h1>Empowering Innovation With The Spirit Of Giving</h1>
      <h2>Product Design</h2>
      <p>We specialize in innovative product design services tailored to meet the unique needs of the automotive, manufacturing, industrial, and heavy engineering sectors.</p>
      <p>Spot-18, Suite No - 717, 7th Floor, Pimple Saudagar, Rahatani, Pune - 411017</p>
      <p>info@paramtechnologies.in</p>
      <p>+91 87702 67488</p>
    </section>
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
    <h1>Who We Are</h1>
    <p>Paramtech Engineering Services Private Limited is an engineering partner to global OEMs.</p>
    <p>For 17+ years we've covered the full product lifecycle.</p>
    <p>With 7,500+ successful placements.</p>
    <p>Helping ourselves by helping others.</p>
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
    <h1>Contact Us</h1>
    <p>Reach Us</p>
    <p>Paramtech Engineering Services Private Limited.</p>
    <p>Spot-18, Suite No - 717, 7th Floor, Pimple Saudagar, Rahatani, Pune - 411017</p>
    <p>+91 87702 67488</p>
    <p>info@paramtechnologies.in</p>
    <p>Send us an inquiry</p>
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
    <h1>Career</h1>
    <p>Join Paramtech Engineering Services Private Limited, where innovation, engineering excellence, and a people-first culture drive everything we do.</p>
    <h2>Current Openings</h2>
    <p>Coming Soon... Stay Tuned</p>
    <ul>
      <li>CAD/CAE Engineers</li>
      <li>Testing &amp; Validation Engineers</li>
    </ul>
  </body>
</html>
`

const loadParamtechModule = async () => {
  try {
    return await import('../../scraper/paramtechcadservicespvtltd/script.js')
  } catch {
    assert.fail('Expected Paramtech CAD Services scraper module at ../../scraper/paramtechcadservicespvtltd/script.js')
  }
}

test('Paramtech homepage verification accepts the current no-public-jobs first-party brand surface', async () => {
  const paramtech = await loadParamtechModule()

  assert.equal(paramtech.SOURCE, 'paramtechcadservicespvtltd')
  assert.equal(paramtech.COMPANY, 'Paramtech Cad Services Pvt. Ltd.')
  assert.equal(paramtech.HOMEPAGE_URL, 'https://www.paramtechnologies.in/')
  assert.equal(paramtech.ABOUT_URL, 'https://www.paramtechnologies.in/about-us.php')
  assert.equal(paramtech.CONTACT_URL, 'https://www.paramtechnologies.in/contact-us.php')
  assert.equal(paramtech.CAREERS_URL, 'https://www.paramtechnologies.in/career.php')
  assert.equal(paramtech.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(paramtech.hasOfficialAboutSignal(aboutHtml), true)
  assert.equal(paramtech.hasOfficialContactSignal(contactHtml), true)
  assert.equal(paramtech.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(paramtech.hasNoPublicJobListingsSignal(careersHtml), true)
})

test('Paramtech run returns an honest empty result when the verified careers shell still exposes no public jobs', async () => {
  const paramtech = await loadParamtechModule()
  const requestedUrls = []

  const jobs = await paramtech.createParamtechCadServicesScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === paramtech.HOMEPAGE_URL) return homepageHtml
      if (url === paramtech.ABOUT_URL) return aboutHtml
      if (url === paramtech.CONTACT_URL) return contactHtml
      if (url === paramtech.CAREERS_URL) return careersHtml

      throw new Error(`Unexpected Paramtech URL: ${url}`)
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

test('Paramtech still fails closed when the homepage drifts away from the verified first-party surface', async () => {
  const paramtech = await loadParamtechModule()

  await assert.rejects(
    paramtech.createParamtechCadServicesScraper().run({
      fetchText: async (url) => {
        if (url === paramtech.HOMEPAGE_URL) return '<html><body>broken</body></html>'
        if (url === paramtech.ABOUT_URL) return aboutHtml
        if (url === paramtech.CONTACT_URL) return contactHtml
        if (url === paramtech.CAREERS_URL) return careersHtml
        throw new Error(`Unexpected Paramtech URL: ${url}`)
      },
    }),
    /homepage no longer matches/i,
  )
})
