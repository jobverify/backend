import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/envisionenterprisesolutions/script.js')

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Envision - Technology Solutions for Marine Logistics, Transportation, and Manufacturing</title>
  </head>
  <body>
    <h1>Envision Enterprise Solutions</h1>
    <p>Industry-specific technology solutions.</p>
  </body>
</html>
`

const contactHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Contact Us | Envision Contact Us | Envision Contact</title>
  </head>
  <body>
    <h1>Contact Us</h1>
    <p><strong><em>Jobs/Career</em></strong> Apply for a job or explore career opportunities through our <a href="/about-us/join-us">Join us page</a>.</p>
  </body>
</html>
`

const joinUsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Join Us | Careers | Career at Envision | Work with Envision</title>
  </head>
  <body>
    <h1>Explore your career opportunity with Envision by filling out this form</h1>
    <iframe
      aria-label="Envision Careers"
      src="https://forms.zohopublic.com/envisionmiddleeast/form/EnvisionCareers/formperma/Ybf-DNkQfm6gr6T7PtjR6MPNZkJxuGmDs6sX_Lum8jc">
    </iframe>
    <p>Life @ Envision</p>
  </body>
</html>
`

const sitemapXml = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://www.envisionesl.com/</loc></url>
  <url><loc>https://www.envisionesl.com/about-us/contact-us</loc></url>
  <url><loc>https://www.envisionesl.com/about-us/join-us</loc></url>
</urlset>
`

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/envisionenterprisesolutions/catalog.js')
  } catch {
    assert.fail(
      'Expected Envision Enterprise Solutions catalog module at ../../scraper/envisionenterprisesolutions/catalog.js',
    )
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/envisionenterprisesolutions/script.js')
  } catch {
    assert.fail(
      'Expected Envision Enterprise Solutions scraper module at ../../scraper/envisionenterprisesolutions/script.js',
    )
  }
}

test('Envision Enterprise Solutions local catalog captures the verified form-only careers handoff', async () => {
  const { ENVISION_ENTERPRISE_SOLUTIONS_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const scriptModule = await loadScriptModule()

  assert.equal(defaultCatalog, ENVISION_ENTERPRISE_SOLUTIONS_CATALOG)
  assert.equal(ENVISION_ENTERPRISE_SOLUTIONS_CATALOG.source, 'envisionenterprisesolutions')
  assert.equal(ENVISION_ENTERPRISE_SOLUTIONS_CATALOG.companyName, 'Envision Enterprise Solutions')
  assert.equal(ENVISION_ENTERPRISE_SOLUTIONS_CATALOG.officialBrandName, 'Envision Enterprise Solutions')
  assert.equal(ENVISION_ENTERPRISE_SOLUTIONS_CATALOG.adapter, 'script')
  assert.equal(ENVISION_ENTERPRISE_SOLUTIONS_CATALOG.homepageUrl, 'https://www.envisionesl.com/')
  assert.equal(
    ENVISION_ENTERPRISE_SOLUTIONS_CATALOG.contactPageUrl,
    'https://www.envisionesl.com/about-us/contact-us',
  )
  assert.equal(
    ENVISION_ENTERPRISE_SOLUTIONS_CATALOG.companyCareerPage,
    'https://www.envisionesl.com/about-us/join-us',
  )
  assert.equal(
    ENVISION_ENTERPRISE_SOLUTIONS_CATALOG.atsPlatform,
    'official-company-careers-form-handoff',
  )
  assert.equal(
    ENVISION_ENTERPRISE_SOLUTIONS_CATALOG.paginationStrategy,
    'homepage-plus-contact-page-plus-join-us-form-validation',
  )
  assert.equal(
    ENVISION_ENTERPRISE_SOLUTIONS_CATALOG.extractionStrategy,
    'verified-homepage+verified-contact-jobs-career-handoff+verified-join-us-zoho-form-without-public-openings+fail-closed-sentinel',
  )
  assert.equal(ENVISION_ENTERPRISE_SOLUTIONS_CATALOG.companyDomain, 'envisionesl.com')
  assert.equal(ENVISION_ENTERPRISE_SOLUTIONS_CATALOG.verifiedOn, '2026-07-18')
  assert.equal(ENVISION_ENTERPRISE_SOLUTIONS_CATALOG.modulePath, modulePath)
  assert.match(ENVISION_ENTERPRISE_SOLUTIONS_CATALOG.verifiedSurfaceSummary, /Saturday, July 18, 2026/i)
  assert.match(ENVISION_ENTERPRISE_SOLUTIONS_CATALOG.verifiedSurfaceSummary, /Jobs\/Career/i)
  assert.match(ENVISION_ENTERPRISE_SOLUTIONS_CATALOG.verifiedSurfaceSummary, /Zoho form/i)
  assert.deepEqual(scriptModule.PROVIDER_METADATA, ENVISION_ENTERPRISE_SOLUTIONS_CATALOG)

  const report = generateCompanyCoverageReport({
    csvText: 'Envision Enterprise Solutions\n',
    catalog: [ENVISION_ENTERPRISE_SOLUTIONS_CATALOG],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})

test('Envision Enterprise Solutions stays fail-closed while join-us remains a form-only first-party surface', async () => {
  const envision = await loadScriptModule()

  assert.equal(envision.SOURCE, 'envisionenterprisesolutions')
  assert.equal(envision.COMPANY, 'Envision Enterprise Solutions')
  assert.equal(envision.HOMEPAGE_URL, 'https://www.envisionesl.com/')
  assert.equal(envision.CONTACT_URL, 'https://www.envisionesl.com/about-us/contact-us')
  assert.equal(envision.CAREERS_URL, 'https://www.envisionesl.com/about-us/join-us')
  assert.equal(envision.SITEMAP_URL, 'https://www.envisionesl.com/sitemap.xml')
  assert.equal(envision.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(envision.hasOfficialContactSignal(contactHtml), true)
  assert.equal(envision.hasJoinUsFormSignal(joinUsHtml), true)
  assert.equal(envision.hasOfficialSitemapSignal(sitemapXml), true)
  assert.equal(envision.hasPublicJobsSignal(joinUsHtml), false)

  const jobs = await envision.run({
    fetchText: async (url) => {
      if (url === envision.HOMEPAGE_URL) return homepageHtml
      if (url === envision.CONTACT_URL) return contactHtml
      if (url === envision.CAREERS_URL) return joinUsHtml
      if (url === envision.SITEMAP_URL) return sitemapXml
      throw new Error(`Unexpected Envision URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
})

test('Envision Enterprise Solutions fails closed when public openings start appearing on the join-us surface', async () => {
  const envision = await loadScriptModule()

  await assert.rejects(
    envision.run({
      fetchText: async (url) => {
        if (url === envision.HOMEPAGE_URL) return homepageHtml
        if (url === envision.CONTACT_URL) return contactHtml
        if (url === envision.SITEMAP_URL) return sitemapXml
        if (url === envision.CAREERS_URL) {
          return `
            <!doctype html>
            <html lang="en">
              <head><title>Join Us | Careers | Career at Envision | Work with Envision</title></head>
              <body>
                <h1>Open Positions</h1>
                <article><h2>Software Engineer</h2><a href="/apply/software-engineer">Apply</a></article>
              </body>
            </html>
          `
        }

        throw new Error(`Unexpected Envision URL: ${url}`)
      },
    }),
    /public jobs surface changed materially/i,
  )
})
