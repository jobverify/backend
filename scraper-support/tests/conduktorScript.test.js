import assert from 'node:assert/strict'
import test from 'node:test'

const careersPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - Join Our Team | Conduktor</title>
  </head>
  <body>
    <main>
      <h1>Join a Team of Builders</h1>
      <p>We're driven by a clear goal: helping businesses move faster and smarter by unlocking the full potential of their data streaming.</p>
      <a href="https://www.conduktor.io/careers/open-roles">Open Roles</a>
      <a href="https://www.conduktor.io/careers/open-roles">View Open Roles</a>
      <section>
        <h2>How We Hire</h2>
      </section>
    </main>
  </body>
</html>
`

const noOpenRolesHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Open Roles | Conduktor</title>
  </head>
  <body>
    <main>
      <nav>
        <a href="https://www.conduktor.io/careers">Careers</a>
      </nav>
      <h1>No Open Roles Right Now</h1>
      <p>We don't have any open positions at the moment, but we're always growing. Check back soon or reach out. We'd love to hear from you.</p>
      <a href="https://www.conduktor.io/contact">Contact Us</a>
    </main>
  </body>
</html>
`

const publicJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Open Roles | Conduktor</title>
  </head>
  <body>
    <main>
      <h1>Open Roles</h1>
      <article>
        <h2>Technical Support Engineer</h2>
        <a href="https://jobs.lever.co/conduktor/fb2601f5-a095-4df9-9edf-0cb5100fffef">Apply</a>
      </article>
    </main>
  </body>
</html>
`

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/conduktor/script.js')
  } catch {
    assert.fail('Expected Conduktor scraper module at ../../scraper/conduktor/script.js')
  }
}

test('Conduktor scraper pins the verified exact-name first-party careers and no-open-roles pages', async () => {
  const conduktor = await loadScriptModule()

  assert.equal(conduktor.SOURCE, 'conduktor')
  assert.equal(conduktor.COMPANY, 'Conduktor')
  assert.equal(conduktor.OFFICIAL_BRAND_NAME, 'Conduktor')
  assert.equal(conduktor.VERIFIED_ON, '2026-07-25')
  assert.equal(conduktor.CAREERS_PAGE_URL, 'https://www.conduktor.io/careers')
  assert.equal(conduktor.OPEN_ROLES_PAGE_URL, 'https://www.conduktor.io/careers/open-roles')
  assert.equal(conduktor.NO_OPEN_ROLES_HEADING, 'No Open Roles Right Now')
  assert.equal(conduktor.hasOfficialCareersPageSignal(careersPageHtml), true)
  assert.equal(conduktor.hasOfficialOpenRolesPageSignal(noOpenRolesHtml), true)
  assert.equal(conduktor.hasNoOpenRolesSignal(noOpenRolesHtml), true)
  assert.equal(conduktor.hasPublicJobListingSignal(noOpenRolesHtml), false)
  assert.equal(conduktor.hasPublicJobListingSignal(publicJobsHtml), true)
})

test('Conduktor returns no jobs only while the verified first-party open-roles page stays empty', async () => {
  const conduktor = await loadScriptModule()
  const requestedUrls = []

  const jobs = await conduktor.createConduktorScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === conduktor.CAREERS_PAGE_URL) {
        return { status: 200, url, html: careersPageHtml }
      }

      if (url === conduktor.OPEN_ROLES_PAGE_URL) {
        return { status: 200, url, html: noOpenRolesHtml }
      }

      throw new Error(`Unexpected Conduktor URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    conduktor.CAREERS_PAGE_URL,
    conduktor.OPEN_ROLES_PAGE_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Conduktor fails closed when the careers shell drifts or the delegated native inventory is unavailable', async () => {
  const conduktor = await loadScriptModule()

  await assert.rejects(
    conduktor.createConduktorScraper().run({
      fetchPage: async (url) => {
        if (url === conduktor.CAREERS_PAGE_URL) {
          return {
            status: 200,
            url,
            html: '<html><head><title>Unexpected</title></head><body>Placeholder</body></html>',
          }
        }

        throw new Error(`Unexpected Conduktor URL: ${url}`)
      },
    }),
    /verified careers page no longer matches/i,
  )

  await assert.rejects(
    conduktor.createConduktorScraper().run({
      fetchPage: async (url) => {
        if (url === conduktor.CAREERS_PAGE_URL) {
          return { status: 200, url, html: careersPageHtml }
        }

        if (url === conduktor.OPEN_ROLES_PAGE_URL) {
          return { status: 200, url, html: publicJobsHtml }
        }

        throw new Error(`Unexpected Conduktor URL: ${url}`)
      },
      fetchJson: async () => { throw new Error('Conduktor delegated native inventory unavailable') },
    }),
    /delegated native inventory unavailable/i,
  )

  await assert.rejects(
    conduktor.createConduktorScraper().run({
      fetchPage: async (url) => {
        if (url === conduktor.CAREERS_PAGE_URL) {
          return { status: 200, url, html: careersPageHtml }
        }

        if (url === conduktor.OPEN_ROLES_PAGE_URL) {
          return {
            status: 200,
            url,
            html: '<html><head><title>Open Roles | Conduktor</title></head><body><h1>Open Roles</h1></body></html>',
          }
        }

        throw new Error(`Unexpected Conduktor URL: ${url}`)
      },
    }),
    /verified no-open-roles surface/i,
  )
})
