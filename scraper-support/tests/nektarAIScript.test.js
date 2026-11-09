import assert from 'node:assert/strict'
import test from 'node:test'

const careersLandingHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | Nektar - Close Revenue Faster with Better CRM Data</title>
  </head>
  <body>
    <main>
      <h1>Come solve challenging problems with an exceptional team; Explore a career at Nektar</h1>
      <p>Join our dynamic and ambitious team that’s helping B2B sales teams work smarter!</p>
      <a href="https://coda.io/@anusha-laksh/open-roles-for-website-publication">See open roles</a>
      <a href="https://coda.io/form/Kick-start-your-career-with-us_dfLGyijCu1N">Apply online</a>
      <h2>Questions about joining Nektar ?</h2>
      <p>Drop a line at careers@nektar.ai</p>
    </main>
  </body>
</html>
`

const openRolesHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Open Roles @ Nektar.ai</title>
  </head>
  <body>
    <p>JavaScript required</p>
    <h1>Open Roles</h1>
    <h2>What’s it like to work at Nektar?</h2>
    <p>True to our mission, our culture prioritises working smart.</p>
    <h2>Need to get in touch?</h2>
    <p>Email us at careers@nektar.ai</p>
  </body>
</html>
`

const applyFormHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Kick start your career with us!</title>
  </head>
  <body>
    <p>JavaScript required</p>
    <p>We’re sorry, but Superhuman Docs doesn't work properly without JavaScript enabled.</p>
  </body>
</html>
`

const confirmedEmptyOpenRolesHtml = openRolesHtml.replace('</body>', '<p>There are currently no open roles.</p></body>')

const openRolesHtmlWithJob = `
${openRolesHtml}
<section>
  <h2>Senior AI Engineer</h2>
  <a href="https://coda.io/form/Kick-start-your-career-with-us_dfLGyijCu1N">Apply now</a>
</section>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/nektarai/script.js')
  } catch {
    assert.fail('Expected Nektar AI scraper module at ../../scraper/nektarai/script.js')
  }
}

test('Nektar ignores product demo text inside scripts when detecting public roles', async () => {
  const nektar = await loadModule()
  const shell = `<script>window.demo = '<p>Reader Reactions shows you how your writing might come across before you turn it in. Pick your reader (like your manager), and it suggests what they might take away and what questions they might have.</p>';</script>`
  assert.equal(nektar.pageExposesPublicJobListings(openRolesHtml + shell), false)
  assert.equal(nektar.pageExposesPublicJobListings(openRolesHtmlWithJob + shell), true)
  assert.equal(nektar.pageExposesPublicJobListings(openRolesHtml + '<script type="application/ld+json">{"@type":"JobPosting","title":"Engineer"}</script>'), true)
})

test('Nektar culture and application pages return an empty discovery snapshot, not an authoritative empty listing', async () => {
  const nektar = await loadModule()
  const jobs = await nektar.run({
    fetchPage: async url => ({ status: 200,
      url: url === nektar.CAREERS_URL ? nektar.OPEN_ROLES_URL : url,
      html: url === nektar.CAREERS_URL ? openRolesHtml : applyFormHtml,
    }),
  })

  assert.deepEqual(jobs, [])
})

test('Nektar AI helper contract stays pinned to the verified careers landing page and Coda handoff', async () => {
  const nektar = await loadModule()

  assert.equal(nektar.SOURCE, 'nektarai')
  assert.equal(nektar.COMPANY, 'Nektar AI')
  assert.equal(nektar.OFFICIAL_BRAND_NAME, 'Nektar.ai')
  assert.equal(nektar.VERIFIED_ON, '2026-09-13')
  assert.equal(nektar.HOMEPAGE_URL, 'https://nektar.ai/')
  assert.equal(nektar.CAREERS_URL, 'https://nektar.ai/careers/')
  assert.deepEqual(nektar.FIRST_PARTY_TIMEOUT_URLS, [
    'https://nektar.ai/',
    'https://nektar.ai/careers/',
  ])
  assert.equal(
    nektar.OPEN_ROLES_URL,
    'https://coda.io/@anusha-laksh/open-roles-for-website-publication',
  )
  assert.equal(
    nektar.APPLY_FORM_URL,
    'https://coda.io/form/Kick-start-your-career-with-us_dfLGyijCu1N',
  )
  assert.match(nektar.VERIFIED_SURFACE_SUMMARY, /culture and contact copy/i)

  assert.equal(nektar.hasOfficialCareersLandingSignal(careersLandingHtml), true)
  assert.deepEqual(nektar.extractOfficialCodaTargets(careersLandingHtml), {
    openRolesUrl: nektar.OPEN_ROLES_URL,
    applyFormUrl: nektar.APPLY_FORM_URL,
  })
  assert.equal(nektar.hasOfficialOpenRolesSignal(openRolesHtml), true)
  assert.equal(nektar.hasOfficialApplyFormSignal(applyFormHtml), true)
  assert.equal(nektar.pageExposesPublicJobListings(openRolesHtml), false)
  assert.equal(nektar.pageExposesPublicJobListings(openRolesHtmlWithJob), true)
  assert.equal(nektar.isExpectedTimedOutSurface({ errorKind: 'timeout', status: null, html: null }), true)
  assert.equal(nektar.isExpectedTimedOutSurface({ errorKind: 'dns' }), false)
})

test('Nektar AI returns [] when the current first-party routes time out but the verified Coda handoff stays in an explicit current no-open-roles state', async () => {
  const nektar = await loadModule()
  const requestedUrls = []

  const jobs = await nektar.createNektarAIScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === nektar.CAREERS_URL || url === nektar.HOMEPAGE_URL) {
        return {
          status: null,
          url,
          html: null,
          errorKind: 'timeout',
        }
      }

      if (url === nektar.OPEN_ROLES_URL) {
        return {
          status: 200,
          url: 'https://docs.superhuman.com/@anusha-laksh/open-roles-for-website-publication',
          html: confirmedEmptyOpenRolesHtml,
        }
      }

      if (url === nektar.APPLY_FORM_URL) {
        return {
          status: 200,
          url: 'https://docs.superhuman.com/form/Kick-start-your-career-with-us_dfLGyijCu1N',
          html: applyFormHtml,
        }
      }

      throw new Error(`Unexpected Nektar AI URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    nektar.CAREERS_URL,
    nektar.HOMEPAGE_URL,
    nektar.OPEN_ROLES_URL,
    nektar.APPLY_FORM_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Nektar AI returns [] while the verified careers redirect and Coda pages stay in an explicit current no-open-roles state', async () => {
  const nektar = await loadModule()
  const requestedUrls = []

  const jobs = await nektar.createNektarAIScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === nektar.CAREERS_URL) {
        return {
          status: 200,
          url: nektar.OPEN_ROLES_URL,
          html: confirmedEmptyOpenRolesHtml,
        }
      }

      if (url === nektar.APPLY_FORM_URL) {
        return {
          status: 200,
          url,
          html: applyFormHtml,
        }
      }

      throw new Error(`Unexpected Nektar AI URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    nektar.CAREERS_URL,
    nektar.APPLY_FORM_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Nektar AI fails closed when the verified landing page or open-roles doc starts exposing public jobs', async () => {
  const nektar = await loadModule()

  await assert.rejects(
    nektar.createNektarAIScraper().run({
      fetchPage: async (url) => {
        if (url === nektar.CAREERS_URL) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Careers</h1><a href=\"https://example.com\">Apply</a></body></html>',
          }
        }

        throw new Error(`Unexpected Nektar AI URL: ${url}`)
      },
    }),
    /careers surface/i,
  )

  await assert.rejects(
    nektar.createNektarAIScraper().run({
      fetchPage: async (url) => {
        if (url === nektar.CAREERS_URL) {
          return {
            status: 200,
            url: nektar.OPEN_ROLES_URL,
            html: openRolesHtmlWithJob,
          }
        }

        if (url === nektar.APPLY_FORM_URL) {
          return {
            status: 200,
            url,
            html: applyFormHtml,
          }
        }

        throw new Error(`Unexpected Nektar AI URL: ${url}`)
      },
    }),
    /public job listings/i,
  )
})
