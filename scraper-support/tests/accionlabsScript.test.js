import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>AI-Led Innovation Engineering Company | Accion Labs</title>
    <link rel="canonical" href="https://www.accionlabs.com" />
  </head>
  <body>
    <header>
      <a href="/capabilities">Capabilities</a>
      <a href="https://www.accionlabs.com/careers">Careers</a>
      <a href="/contact-us">Contact Us</a>
    </header>
    <main>
      <h2>AI-Led Innovation Engineering Company</h2>
      <p>Powered by Semantic Engineering</p>
      <h3>Accion Labs</h3>
      <h2>Smarter Enterprises, engineered to hold up in production.</h2>
      <p>
        Accion Labs builds new software, modernizes the systems you already run, and puts AI agents
        to work across your operations. Governed and grounded through Semantic Engineering.
      </p>
      <h3>Our Core — Semantic Engineering</h3>
    </main>
  </body>
</html>
`

const careersIntakeHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Empower Your Future at Accion Labs | Where Careers Thrive</title>
    <link rel="canonical" href="https://www.accionlabs.com/careers" />
  </head>
  <body>
    <main>
      <h1>Explore Opportunities for Career Growth</h1>
      <p>Join a Thriving Community of Innovators and Collaborators</p>
      <h2>Apply Here</h2>
      <p>
        Life at Accion Labs is a dynamic and invigorating journey where individuals not only excel
        but also thrive.
      </p>
      <h2>Thrive in Your Career with Accion Labs</h2>
      <p>
        Kindly provide your information, and we will reach out to you if a suitable match is found.
      </p>
      <a href="/us-opportunities">US Opportunities</a>
      <a href="/prague-engineering-center">Prague Opportunities</a>
      <section>
        <h2>How do I apply for a position at your organization?</h2>
        <p>Click the apply button on the desired job posting.</p>
        <p>Make sure to examine the job description and requirements.</p>
      </section>
      <p>Accion Labs India Is Now Great Place to Work-Certified</p>
    </main>
  </body>
</html>
`

const pragueSpontaneousApplicationHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Join our Prague Engineering Center for Career Opportunities</title>
    <link rel="canonical" href="https://www.accionlabs.com/prague-engineering-center" />
  </head>
  <body>
    <main>
      <h1>Prague Engineering Center</h1>
      <p>
        Veracode and Accion Labs are proud to come together to build the Prague Engineering Center.
      </p>
      <p>Join us and fast-track your career at Accion Prague Engineering Center.</p>
      <ul>
        <li>Data Platform team</li>
        <li>Crashtest team</li>
        <li>Flaw Reporting team</li>
        <li>Portal UI team</li>
      </ul>
      <p>
        If you don't find a position that perfectly matches your profile, don't worry! We still
        encourage you to apply.
      </p>
      <a href="/spontaneous-application">Spontaneous Application</a>
      <p>ta.cz@accionlabs.com</p>
    </main>
  </body>
</html>
`

const loadAccionLabsModule = async () => {
  try {
    return await import('../../scraper/accionlabs/script.js')
  } catch {
    return null
  }
}

test('Accion Labs recognizes the verified first-party surfaces after homepage marketing copy changes', async () => {
  const accionLabs = await loadAccionLabsModule()
  assert.ok(accionLabs, 'Expected Accion Labs scraper module at ../../scraper/accionlabs/script.js')

  assert.equal(accionLabs.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(accionLabs.hasOfficialCareersSignal(careersIntakeHtml), true)
  assert.equal(
    accionLabs.hasOfficialPragueEngineeringCenterSignal(pragueSpontaneousApplicationHtml),
    true,
  )
  assert.equal(accionLabs.pageExposesPublicJobListings(careersIntakeHtml), false)
  assert.equal(accionLabs.pageExposesPublicJobListings(pragueSpontaneousApplicationHtml), false)
  assert.equal(
    accionLabs.pageExposesPublicJobListings(
      `${careersIntakeHtml}<section><h2>Current Openings</h2><a href="/jobs/senior-data-engineer">Apply Now</a></section>`,
    ),
    true,
  )
})

test('Accion Labs returns no jobs only while the verified first-party careers routes remain non-listing surfaces', async () => {
  const accionLabs = await loadAccionLabsModule()
  assert.ok(accionLabs, 'Expected Accion Labs scraper module at ../../scraper/accionlabs/script.js')

  const requestedUrls = []

  const jobs = await accionLabs.createAccionLabsScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === accionLabs.HOMEPAGE_URL) {
        return {
          ok: true,
          status: 200,
          url,
          finalUrl: url,
          text: homepageHtml,
        }
      }

      if (url === accionLabs.CAREERS_URL) {
        return {
          ok: true,
          status: 200,
          url,
          finalUrl: url,
          text: careersIntakeHtml,
        }
      }

      if (url === accionLabs.US_OPPORTUNITIES_URL) {
        return {
          ok: true,
          status: 200,
          url,
          finalUrl: accionLabs.CAREERS_URL,
          text: careersIntakeHtml,
        }
      }

      if (url === accionLabs.PRAGUE_ENGINEERING_CENTER_URL) {
        return {
          ok: true,
          status: 200,
          url,
          finalUrl: url,
          text: pragueSpontaneousApplicationHtml,
        }
      }

      throw new Error(`Unexpected fixture URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    accionLabs.HOMEPAGE_URL,
    accionLabs.CAREERS_URL,
    accionLabs.US_OPPORTUNITIES_URL,
    accionLabs.PRAGUE_ENGINEERING_CENTER_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Accion Labs fails closed when the verified non-listing careers contract drifts', async () => {
  const accionLabs = await loadAccionLabsModule()
  assert.ok(accionLabs, 'Expected Accion Labs scraper module at ../../scraper/accionlabs/script.js')

  await assert.rejects(
    accionLabs.createAccionLabsScraper().run({
      fetchPage: async (url) => ({
        ok: true,
        status: 200,
        url,
        finalUrl: url,
        text: url === accionLabs.HOMEPAGE_URL
          ? '<html><head><title>Placeholder</title></head><body>Welcome</body></html>'
          : careersIntakeHtml,
      }),
    }),
    /official Accion Labs homepage/i,
  )

  await assert.rejects(
    accionLabs.createAccionLabsScraper().run({
      fetchPage: async (url) => {
        if (url === accionLabs.HOMEPAGE_URL) {
          return {
            ok: true,
            status: 200,
            url,
            finalUrl: url,
            text: homepageHtml,
          }
        }

        if (url === accionLabs.CAREERS_URL) {
          return {
            ok: true,
            status: 200,
            url,
            finalUrl: url,
            text: '<html><body><h1>Careers</h1></body></html>',
          }
        }

        return {
          ok: true,
          status: 200,
          url,
          finalUrl: url,
          text: pragueSpontaneousApplicationHtml,
        }
      },
    }),
    /resume-only careers surface/i,
  )

  await assert.rejects(
    accionLabs.createAccionLabsScraper().run({
      fetchPage: async (url) => {
        if (url === accionLabs.HOMEPAGE_URL) {
          return {
            ok: true,
            status: 200,
            url,
            finalUrl: url,
            text: homepageHtml,
          }
        }

        if (url === accionLabs.CAREERS_URL) {
          return {
            ok: true,
            status: 200,
            url,
            finalUrl: url,
            text: careersIntakeHtml,
          }
        }

        if (url === accionLabs.US_OPPORTUNITIES_URL) {
          return {
            ok: true,
            status: 200,
            url,
            finalUrl: url,
            text: careersIntakeHtml,
          }
        }

        return {
          ok: true,
          status: 200,
          url,
          finalUrl: url,
          text: pragueSpontaneousApplicationHtml,
        }
      },
    }),
    /US opportunities route/i,
  )

  await assert.rejects(
    accionLabs.createAccionLabsScraper().run({
      fetchPage: async (url) => {
        if (url === accionLabs.HOMEPAGE_URL) {
          return {
            ok: true,
            status: 200,
            url,
            finalUrl: url,
            text: homepageHtml,
          }
        }

        if (url === accionLabs.CAREERS_URL || url === accionLabs.US_OPPORTUNITIES_URL) {
          return {
            ok: true,
            status: 200,
            url,
            finalUrl: accionLabs.CAREERS_URL,
            text: careersIntakeHtml,
          }
        }

        return {
          ok: true,
          status: 200,
          url,
          finalUrl: url,
          text:
            `${pragueSpontaneousApplicationHtml}<section><h2>Open Positions</h2><a href="/jobs/platform-engineer">Apply Now</a></section>`,
        }
      },
    }),
    /Prague Engineering Center|public job listings/i,
  )
})
