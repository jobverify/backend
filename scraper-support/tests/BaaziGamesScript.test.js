import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/baazigames/script.js')

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>BaaziGames</title>
  </head>
  <body>
    <h1>Baazi Games</h1>
    <p>Founded in 2014, Baazi Games has established itself as a pioneer in the online gaming space.</p>
    <p>Contact Us</p>
    <p>Email: talent.acquisition@moonshinetechnology.com</p>
  </body>
</html>
`

const contactHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Contact Us | Baazi Games</title>
  </head>
  <body>
    <h1>Contact Us</h1>
    <p>Email: talent.acquisition@moonshinetechnology.com</p>
    <form>
      <input name="first_name">
      <input name="email">
      <textarea name="message"></textarea>
    </form>
  </body>
</html>
`

const blockedCareersHtml = `
AccessDenied
Access Denied
`

const publicCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | Baazi Games</title>
  </head>
  <body>
    <h1>Open Roles</h1>
    <a href="/jobs/lead-engineer">Lead Engineer</a>
  </body>
</html>
`

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/baazigames/catalog.js')
  } catch {
    assert.fail('Expected Baazi Games catalog module at ../../scraper/baazigames/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/baazigames/script.js')
  } catch {
    assert.fail('Expected Baazi Games scraper module at ../../scraper/baazigames/script.js')
  }
}

test('Baazi Games local catalog captures the verified no-public-jobs first-party surface', async () => {
  const { BAAZI_GAMES_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(BAAZI_GAMES_CATALOG)

  assert.equal(defaultCatalog, BAAZI_GAMES_CATALOG)
  assert.equal(provider.source, 'baazigames')
  assert.equal(provider.companyName, 'Baazi Games')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.baazigames.com/')
  assert.equal(provider.companyDomain, 'baazigames.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-contact-page-plus-blocked-careers-route-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-contact-page+talent-email-only+blocked-careers-route-return-empty',
  )
  assert.equal(provider.verifiedOn, '2026-08-01')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /talent\.acquisition@moonshinetechnology\.com/i)
  assert.match(provider.verifiedSurfaceSummary, /AccessDenied/i)
})

test('Baazi Games keeps a denied careers inventory unavailable after validated marketing and contact pages', async () => {
  const baazi = await loadScriptModule()
  const requestedUrls = []

  assert.equal(baazi.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(baazi.hasOfficialContactSignal(contactHtml), true)
  assert.equal(baazi.isBlockedCareersRoute(blockedCareersHtml), true)
  assert.equal(baazi.hasPublicJobsSignal(homepageHtml), false)
  assert.equal(baazi.hasPublicJobsSignal(publicCareersHtml), true)

  await assert.rejects(baazi.createBaaziGamesScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === baazi.HOMEPAGE_URL) return homepageHtml
      if (url === baazi.CONTACT_URL) return contactHtml
      if (url === baazi.CAREERS_URL) return blockedCareersHtml
      throw new Error(`Unexpected Baazi URL: ${url}`)
    },
  }), error => error.code === 'access_denied' && error.failureKind === 'incomplete_listing' && error.inventoryEvidence.reportedTotal === null)

  assert.deepEqual(requestedUrls, [
    baazi.HOMEPAGE_URL,
    baazi.CONTACT_URL,
    baazi.CAREERS_URL,
  ])
})

test('Baazi Games rejects the live 403 AccessDenied careers response with unknown inventory', async () => {
  const baazi = await loadScriptModule()

  await assert.rejects(baazi.createBaaziGamesScraper().run({
    fetchPage: async (url) => {
      if (url === baazi.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
      if (url === baazi.CONTACT_URL) return { status: 200, url, html: contactHtml }
      if (url === baazi.CAREERS_URL) return { status: 403, url, html: '<?xml version="1.0"?><Error><Code>AccessDenied</Code><Message>Access Denied</Message></Error>' }
      throw new Error(`Unexpected Baazi URL: ${url}`)
    },
  }), error => error.code === 'access_denied' && error.status === 403 && error.abortRetries === true
    && error.inventoryEvidence.listingComplete === false && error.inventoryEvidence.indiaFacetCount === null)
})

test('Baazi Games scraper fails closed when a public jobs surface appears on the exact-name domain', async () => {
  const baazi = await loadScriptModule()

  await assert.rejects(
    baazi.createBaaziGamesScraper().run({
      fetchText: async (url) => {
        if (url === baazi.HOMEPAGE_URL) return homepageHtml
        if (url === baazi.CONTACT_URL) return contactHtml
        return publicCareersHtml
      },
    }),
    /public jobs surface/i,
  )
})


test('Baazi unavailable primary remains recorded when the current employer feed cannot be verified', async () => {
  const source = await import('../../scraper/baazigames/script.js')
  await assert.rejects(source.run({fetchPage:async url => ({status:200,url,html:'<title>BaaziGames | No Games Available at the Moment</title><p>No games are available at the moment</p>'})}), error => error.failureKind === 'incomplete_listing' && /current job inventory is unavailable/i.test(error.primaryInventoryUnavailable))
  await assert.rejects(source.run({fetchPage:async url => ({status:403,url,html:'AccessDenied Access Denied'})}), /HTTP 403/)
})
