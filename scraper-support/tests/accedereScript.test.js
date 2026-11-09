import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Accedere</title>
  </head>
  <body>
    <header>
      <a href="https://accedere.io/">Home</a>
      <a href="https://accedere.io/about">About</a>
      <a href="https://accedere.io/contact">Contact</a>
      <a href="https://blog.accedere.io/">Blogs</a>
    </header>
    <main>
      <h5>SOC Attest Reports</h5>
      <h5>Global Federal Assessments</h5>
      <h5>Privacy Assessments</h5>
      <h5>Cloud Security Assessments</h5>
      <h5>ISO/IEC Certification</h5>
      <h5>Training Programs</h5>
      <h5>ESG Reporting Services</h5>
      <h5>PQC Security</h5>
      <p>999, 18th St, #3000, Denver, Colorado 80202</p>
      <p>119 Andheri Industrial Estate, Off Veera Desai Road, Andheri West, Mumbai 400053</p>
      <p>Innovation One Level 3 Dubai AI Campus Gate Avenue- South Zone Unit GA-00-SZ-G0-RT-147 DIFC, Dubai UAE.</p>
      <section>
        <h3>Our Services</h3>
        <p>SOC Attest Reports</p>
        <p>ISO/IEC Certifications</p>
        <p>Global Federal Assessments</p>
        <p>Privacy Assessments</p>
        <p>Cloud Security Assessments</p>
        <p>Training Programs</p>
        <p>ESG Services</p>
      </section>
      <section>
        <h3>Company</h3>
        <p>About Us</p>
        <p>Contact</p>
      </section>
    </main>
    <footer>
      <p>© 2026 | Designed By Accedere</p>
    </footer>
  </body>
</html>
`

const aboutHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Accedere</title>
  </head>
  <body>
    <header>
      <a href="https://accedere.io/">Home</a>
      <a href="https://accedere.io/about">About</a>
      <a href="https://accedere.io/contact">Contact</a>
    </header>
    <main>
      <h5>SOC Attest Reports</h5>
      <h5>Global Federal Assessments</h5>
      <h5>Privacy Assessments</h5>
      <h5>Cloud Security Assessments</h5>
      <h5>ISO/IEC Certification</h5>
      <h5>Training Programs</h5>
      <h5>ESG Reporting Services</h5>
      <h5>PQC Security</h5>
      <section>
        <h3>Company</h3>
        <p>About Us</p>
        <p>Contact</p>
      </section>
      <p>119 Andheri Industrial Estate, Off Veera Desai Road, Andheri West, Mumbai 400053</p>
    </main>
    <footer>
      <p>© 2026 | Designed By Accedere</p>
    </footer>
  </body>
</html>
`

const contactHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Accedere</title>
  </head>
  <body>
    <main>
      <h5>SOC Attest Reports</h5>
      <h5>Global Federal Assessments</h5>
      <h5>Privacy Assessments</h5>
      <h5>Cloud Security Assessments</h5>
      <h5>ISO/IEC Certification</h5>
      <h5>Training Programs</h5>
      <h5>ESG Reporting Services</h5>
      <p>999, 18th St, #3000, Denver, Colorado 80202</p>
      <p>119 Andheri Industrial Estate, Off Veera Desai Road, Andheri West, Mumbai 400053</p>
      <p>Innovation One Level 3 Dubai AI Campus Gate Avenue- South Zone Unit GA-00-SZ-G0-RT-147 DIFC, Dubai UAE.</p>
      <h3>Company</h3>
      <p>About Us</p>
      <p>Contact</p>
    </main>
    <footer>
      <p>© 2025 | Designed By Accedere</p>
    </footer>
  </body>
</html>
`

const missingRouteHtml = ''

const loadAccedereModule = async () => {
  try {
    return await import('../../scraper/accedere/script.js')
  } catch {
    assert.fail('Expected Accedere scraper module at ../../scraper/accedere/script.js')
  }
}

test('Accedere sentinel pins the verified first-party no-public-jobs surface from July 14, 2026', async () => {
  const accedere = await loadAccedereModule()

  assert.equal(accedere.SOURCE, 'accedere')
  assert.equal(accedere.COMPANY, 'Accedere')
  assert.equal(accedere.OFFICIAL_BRAND_NAME, 'Accedere')
  assert.equal(accedere.VERIFIED_ON, '2026-07-14')
  assert.equal(accedere.HOMEPAGE_URL, 'https://accedere.io/')
  assert.equal(accedere.ABOUT_URL, 'https://accedere.io/about')
  assert.equal(accedere.CONTACT_URL, 'https://accedere.io/contact')
  assert.deepEqual(accedere.CAREERS_ROUTE_URLS, [
    'https://accedere.io/careers',
    'https://accedere.io/career',
    'https://accedere.io/jobs',
    'https://accedere.io/job',
    'https://accedere.io/join-us',
    'https://accedere.io/openings',
    'https://accedere.io/work-with-us',
    'https://accedere.io/hiring',
  ])
  assert.match(accedere.VERIFIED_SURFACE_SUMMARY, /no trustworthy public jobs surface/i)

  assert.equal(accedere.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(accedere.hasOfficialAboutSignal(aboutHtml), true)
  assert.equal(accedere.hasOfficialContactSignal(contactHtml), true)
  assert.equal(accedere.hasFirstPartyCareerLikeLink(homepageHtml), false)
  assert.equal(
    accedere.hasFirstPartyCareerLikeLink('<a href="https://accedere.io/careers">Careers</a>'),
    true,
  )
  assert.equal(accedere.hasPublicJobsSignal(homepageHtml), false)
  assert.equal(
    accedere.hasPublicJobsSignal('<a href="https://jobs.lever.co/accedere">Open positions</a>'),
    true,
  )
  assert.equal(
    accedere.isVerifiedMissingFirstPartyRoute({
      status: 404,
      url: accedere.CAREERS_ROUTE_URLS[0],
      html: missingRouteHtml,
    }),
    true,
  )
})

test('Accedere sentinel returns [] only while the verified first-party surface exposes no public jobs board', async () => {
  const accedere = await loadAccedereModule()
  const requestedUrls = []

  const jobs = await accedere.createAccedereScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === accedere.HOMEPAGE_URL) {
        return { ok: true, status: 200, url, text: homepageHtml }
      }

      if (url === accedere.ABOUT_URL) {
        return { ok: true, status: 200, url, text: aboutHtml }
      }

      if (url === accedere.CONTACT_URL) {
        return { ok: true, status: 200, url, text: contactHtml }
      }

      if (accedere.CAREERS_ROUTE_URLS.includes(url)) {
        return { ok: false, status: 404, url, text: missingRouteHtml }
      }

      throw new Error(`Unexpected Accedere URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    accedere.HOMEPAGE_URL,
    accedere.ABOUT_URL,
    accedere.CONTACT_URL,
    ...accedere.CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Accedere sentinel fails closed when the verified first-party surface drifts into a public jobs surface', async () => {
  const accedere = await loadAccedereModule()

  await assert.rejects(
    accedere.createAccedereScraper().run({
      fetchPage: async (url) => {
        if (url === accedere.HOMEPAGE_URL) {
          return {
            ok: true,
            status: 200,
            url,
            text: `${homepageHtml}<a href="https://accedere.io/careers">Careers</a>`,
          }
        }

        throw new Error(`Unexpected Accedere URL: ${url}`)
      },
    }),
    /homepage now exposes a first-party careers or jobs link/i,
  )

  await assert.rejects(
    accedere.createAccedereScraper().run({
      fetchPage: async (url) => {
        if (url === accedere.HOMEPAGE_URL) {
          return { ok: true, status: 200, url, text: homepageHtml }
        }

        if (url === accedere.ABOUT_URL) {
          return { ok: true, status: 200, url, text: aboutHtml }
        }

        if (url === accedere.CONTACT_URL) {
          return {
            ok: true,
            status: 200,
            url,
            text: `${contactHtml}<section><h2>Open positions</h2><a href="https://accedere.io/jobs/senior-consultant">Apply now</a></section>`,
          }
        }

        throw new Error(`Unexpected Accedere URL: ${url}`)
      },
    }),
    /contact page now appears to expose a careers or jobs surface/i,
  )

  await assert.rejects(
    accedere.createAccedereScraper().run({
      fetchPage: async (url) => {
        if (url === accedere.HOMEPAGE_URL) {
          return { ok: true, status: 200, url, text: homepageHtml }
        }

        if (url === accedere.ABOUT_URL) {
          return { ok: true, status: 200, url, text: aboutHtml }
        }

        if (url === accedere.CONTACT_URL) {
          return { ok: true, status: 200, url, text: contactHtml }
        }

        if (url === accedere.CAREERS_ROUTE_URLS[0]) {
          return {
            ok: true,
            status: 200,
            url,
            text: '<html><body><h1>Careers</h1><a href="https://jobs.lever.co/accedere">Apply now</a></body></html>',
          }
        }

        return { ok: false, status: 404, url, text: missingRouteHtml }
      },
    }),
    /careers route changed materially or now exposes public jobs/i,
  )
})
