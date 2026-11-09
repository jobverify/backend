import assert from 'node:assert/strict'
import test from 'node:test'

const loadQuantumBsoTechModule = async () => {
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
    <title>Quantum: ERP System &amp; Business Intelligence Solution for Logistics</title>
  </head>
  <body>
    <main>
      <h1>The Digital World</h1>
      <h2>Technology is the Greatest Change Agent</h2>
      <section>
        <h3>Where to find us</h3>
        <h4>Bangalore, IN</h4>
        <p>Quantum BSO &amp; Tech Pvt. Ltd</p>
        <p>Ahad Pinnacle, 3rd Floor. #80</p>
        <p>5th Main, 2nd Cross, 5th Cross</p>
        <p>Koramangala Industrial Area</p>
        <p>Bangalore - 560095</p>
      </section>
    </main>
  </body>
</html>
`

const aboutHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>About us - Quantum</title>
  </head>
  <body>
    <main>
      <h1>The Quantum Story</h1>
      <h2>About Us</h2>
      <p>Founded in 2003, Quantum is a transportation and logistics solution provider.</p>
      <section>
        <h2>Careers</h2>
        <p>At Quantum your contributions can have a global impact and we are always on the look out for people that view the world differently.</p>
        <p>If you have an obsessive eye for detail, if you live and breathe quality and have a drive to succeed in a high performance environment. Then we want to hear from you.</p>
        <h3>Get in touch</h3>
        <p>Name *</p>
        <p>E-mail *</p>
        <p>Subject *</p>
        <p>Company Name *</p>
        <p>Message *</p>
      </section>
    </main>
  </body>
</html>
`

const contactHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>The Digital World</title>
  </head>
  <body>
    <main>
      <h1>Get In Touch</h1>
      <p>What can we help you with? Drop us a line and let's talk about it.</p>
      <section>
        <h2>India Office</h2>
        <p>Quantum BSO &amp; Tech Pvt. Ltd</p>
        <p>Ahad Pinnacle, 3rd Floor. #80</p>
        <p>5th Main, 2nd Cross, 5th Cross</p>
        <p>Koramangala Industrial Area</p>
        <p>Bangalore - 560095</p>
        <p>Tel - +91 80 4406 6700</p>
      </section>
      <section>
        <h2>Customer Service Contact</h2>
      </section>
    </main>
  </body>
</html>
`

const publicJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Quantum Careers</title>
  </head>
  <body>
    <main>
      <h1>Current Openings</h1>
      <a href="https://jobs.lever.co/quantum/full-stack-engineer">Apply now</a>
    </main>
  </body>
</html>
`

test('Quantum BSO & Tech Pvt. Ltd sentinel recognizes the verified homepage, about careers handoff, and contact surface', async () => {
  const quantum = await loadQuantumBsoTechModule()
  assert.ok(quantum, 'Expected Quantum BSO & Tech Pvt. Ltd scraper module at ./script.js')

  assert.equal(quantum.SOURCE, 'quantumbsotechpvtltd')
  assert.equal(quantum.COMPANY, 'Quantum BSO & Tech Pvt. Ltd')
  assert.equal(quantum.HOMEPAGE_URL, 'https://quantumbso.com/')
  assert.equal(quantum.ABOUT_URL, 'https://www.quantumbso.com/about-us')
  assert.equal(quantum.CONTACT_URL, 'https://www.quantumbso.com/contact')
  assert.equal(quantum.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(quantum.hasOfficialAboutSignal(aboutHtml), true)
  assert.equal(quantum.hasOfficialContactSignal(contactHtml), true)
  assert.equal(quantum.hasFirstPartyJobsPathLink(homepageHtml), false)
  assert.equal(quantum.hasPublicJobsSignal(homepageHtml), false)
})

test('Quantum BSO & Tech Pvt. Ltd sentinel returns no jobs only while the verified first-party no-public-careers surface stays intact', async () => {
  const quantum = await loadQuantumBsoTechModule()
  assert.ok(quantum, 'Expected Quantum BSO & Tech Pvt. Ltd scraper module at ./script.js')

  const requestedUrls = []
  const jobs = await quantum.createQuantumBsoTechScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      if (url === quantum.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
      if (url === quantum.ABOUT_URL) return { status: 200, url, html: aboutHtml }
      if (url === quantum.CONTACT_URL) return { status: 200, url, html: contactHtml }
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    quantum.HOMEPAGE_URL,
    quantum.ABOUT_URL,
    quantum.CONTACT_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Quantum BSO & Tech Pvt. Ltd sentinel fails closed when the homepage, about page, or contact page drifts into a public jobs surface', async () => {
  const quantum = await loadQuantumBsoTechModule()
  assert.ok(quantum, 'Expected Quantum BSO & Tech Pvt. Ltd scraper module at ./script.js')

  await assert.rejects(
    quantum.createQuantumBsoTechScraper().run({
      fetchPage: async (url) => {
        if (url === quantum.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><body><main>Unexpected</main></body></html>' }
        }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    quantum.createQuantumBsoTechScraper().run({
      fetchPage: async (url) => {
        if (url === quantum.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === quantum.ABOUT_URL) return { status: 200, url, html: publicJobsHtml }
        if (url === quantum.CONTACT_URL) return { status: 200, url, html: contactHtml }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /about page now exposes public jobs/i,
  )

  await assert.rejects(
    quantum.createQuantumBsoTechScraper().run({
      fetchPage: async (url) => {
        if (url === quantum.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === quantum.ABOUT_URL) return { status: 200, url, html: aboutHtml }
        if (url === quantum.CONTACT_URL) {
          return {
            status: 200,
            url,
            html: contactHtml.replace(
              '</main>',
              '<a href="/jobs/software-engineer">Open positions</a></main>',
            ),
          }
        }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /contact page now exposes public jobs/i,
  )
})
