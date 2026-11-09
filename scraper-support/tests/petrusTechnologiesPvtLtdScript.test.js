import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../scraper/petrustechnologiespvtltd/fixtures',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const verifiedHomepageShellHtml = readFixture('homepage-shell.html')
const verifiedComponentsBundleJs = readFixture('components-bundle.js')
const verifiedAboutComponentHtml = readFixture('about-us.html')
const verifiedContactComponentHtml = readFixture('contact-us.html')

const expectedPublicJobRouteUrls = [
  'https://www.petrustechnologies.com/careers',
  'https://www.petrustechnologies.com/careers/',
  'https://www.petrustechnologies.com/career',
  'https://www.petrustechnologies.com/career/',
  'https://www.petrustechnologies.com/jobs',
  'https://www.petrustechnologies.com/jobs/',
]

const loadModule = async () => {
  try {
    return await import('../../scraper/petrustechnologiespvtltd/script.js')
  } catch {
    assert.fail('Expected Petrus Technologies Pvt Ltd scraper module at ../../scraper/petrustechnologiespvtltd/script.js')
  }
}

test('Petrus Technologies Pvt Ltd recognizes the verified Petrus shell, route bundle, and zero-job component surfaces', async () => {
  const petrus = await loadModule()

  assert.equal(petrus.SOURCE, 'petrustechnologiespvtltd')
  assert.equal(petrus.COMPANY, 'Petrus Technologies Pvt Ltd')
  assert.equal(petrus.HOMEPAGE_URL, 'https://www.petrustechnologies.com/')
  assert.equal(petrus.ABOUT_COMPONENT_URL, 'https://www.petrustechnologies.com/components/about-us.html')
  assert.equal(petrus.CONTACT_COMPONENT_URL, 'https://www.petrustechnologies.com/components/contact-us.html')
  assert.deepEqual(petrus.PUBLIC_JOB_ROUTE_URLS, expectedPublicJobRouteUrls)
  assert.equal(petrus.hasOfficialShellSignal(verifiedHomepageShellHtml), true)
  assert.equal(petrus.extractComponentScriptPath(verifiedHomepageShellHtml), 'js/components.js')
  assert.equal(petrus.hasVerifiedBundleSignal(verifiedComponentsBundleJs), true)
  assert.equal(petrus.hasBundlePublicJobsSignal(verifiedComponentsBundleJs), false)
  assert.equal(petrus.hasAboutComponentSignal(verifiedAboutComponentHtml), true)
  assert.equal(petrus.hasContactComponentSignal(verifiedContactComponentHtml), true)
  assert.equal(petrus.hasPublicJobsSignal(verifiedAboutComponentHtml), false)
  assert.equal(petrus.hasPublicJobsSignal(verifiedContactComponentHtml), false)
  assert.equal(
    petrus.isVerifiedPublicJobShell({
      status: 200,
      url: petrus.PUBLIC_JOB_ROUTE_URLS[0],
      html: verifiedHomepageShellHtml,
    }),
    true,
  )
  assert.equal(
    petrus.isVerifiedPublicJobShell({
      status: 200,
      url: petrus.PUBLIC_JOB_ROUTE_URLS[0],
      html: '<html><head><title>Careers</title></head><body><h1>Current Openings</h1><a href="/apply">Apply now</a></body></html>',
    }),
    false,
  )
})

test('Petrus Technologies Pvt Ltd returns no jobs while the verified first-party zero-job contract remains unchanged', async () => {
  const petrus = await loadModule()
  const requestedPages = []
  const requestedText = []

  const jobs = await petrus.createPetrusTechnologiesPvtLtdScraper().run({
    fetchPage: async (url) => {
      requestedPages.push(url)

      if (url === petrus.HOMEPAGE_URL) {
        return { status: 200, url, html: verifiedHomepageShellHtml }
      }

      if (petrus.PUBLIC_JOB_ROUTE_URLS.includes(url)) {
        return { status: 200, url, html: verifiedHomepageShellHtml }
      }

      throw new Error(`Unexpected page URL: ${url}`)
    },
    fetchText: async (url) => {
      requestedText.push(url)

      if (url === 'https://www.petrustechnologies.com/js/components.js') {
        return verifiedComponentsBundleJs
      }

      if (url === petrus.ABOUT_COMPONENT_URL) {
        return verifiedAboutComponentHtml
      }

      if (url === petrus.CONTACT_COMPONENT_URL) {
        return verifiedContactComponentHtml
      }

      throw new Error(`Unexpected text URL: ${url}`)
    },
  })

  assert.deepEqual(requestedPages, [
    petrus.HOMEPAGE_URL,
    ...petrus.PUBLIC_JOB_ROUTE_URLS,
  ])
  assert.deepEqual(requestedText, [
    'https://www.petrustechnologies.com/js/components.js',
    petrus.ABOUT_COMPONENT_URL,
    petrus.CONTACT_COMPONENT_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Petrus Technologies Pvt Ltd fails closed when the shell, route bundle, components, or public-job routes change materially', async () => {
  const petrus = await loadModule()

  await assert.rejects(
    petrus.createPetrusTechnologiesPvtLtdScraper().run({
      fetchPage: async (url) => {
        if (url === petrus.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><head><title>Unexpected</title></head><body>No trusted shell</body></html>' }
        }

        return { status: 200, url, html: verifiedHomepageShellHtml }
      },
      fetchText: async (url) => {
        if (url === petrus.ABOUT_COMPONENT_URL) return verifiedAboutComponentHtml
        if (url === petrus.CONTACT_COMPONENT_URL) return verifiedContactComponentHtml
        return verifiedComponentsBundleJs
      },
    }),
    /verified official shell/i,
  )

  await assert.rejects(
    petrus.createPetrusTechnologiesPvtLtdScraper().run({
      fetchPage: async () => ({ status: 200, url: petrus.HOMEPAGE_URL, html: verifiedHomepageShellHtml }),
      fetchText: async (url) => {
        if (url === petrus.ABOUT_COMPONENT_URL) return verifiedAboutComponentHtml
        if (url === petrus.CONTACT_COMPONENT_URL) return verifiedContactComponentHtml
        return "const PAGE_FILES = {'about-us': 'components/about-us.html', 'contact-us': 'components/contact-us.html', careers: 'components/careers.html'}"
      },
    }),
    /route bundle changed materially or now exposes public jobs/i,
  )

  await assert.rejects(
    petrus.createPetrusTechnologiesPvtLtdScraper().run({
      fetchPage: async () => ({ status: 200, url: petrus.HOMEPAGE_URL, html: verifiedHomepageShellHtml }),
      fetchText: async (url) => {
        if (url === petrus.ABOUT_COMPONENT_URL) {
          return '<html><body><h1>About Us</h1><p>No verified Life at Petrus surface remains here.</p></body></html>'
        }
        if (url === petrus.CONTACT_COMPONENT_URL) return verifiedContactComponentHtml
        return verifiedComponentsBundleJs
      },
    }),
    /about component/i,
  )

  await assert.rejects(
    petrus.createPetrusTechnologiesPvtLtdScraper().run({
      fetchPage: async () => ({ status: 200, url: petrus.HOMEPAGE_URL, html: verifiedHomepageShellHtml }),
      fetchText: async (url) => {
        if (url === petrus.ABOUT_COMPONENT_URL) return verifiedAboutComponentHtml
        if (url === petrus.CONTACT_COMPONENT_URL) {
          return '<html><body><p>No verified Petrus contact signals remain here.</p></body></html>'
        }
        return verifiedComponentsBundleJs
      },
    }),
    /contact component/i,
  )

  await assert.rejects(
    petrus.createPetrusTechnologiesPvtLtdScraper().run({
      fetchPage: async (url) => {
        if (url === petrus.HOMEPAGE_URL) {
          return { status: 200, url, html: verifiedHomepageShellHtml }
        }

        if (url === petrus.PUBLIC_JOB_ROUTE_URLS[0]) {
          return {
            status: 200,
            url,
            html: '<html><head><title>Careers</title></head><body><h1>Current Openings</h1><a href="/apply">Apply now</a></body></html>',
          }
        }

        return { status: 200, url, html: verifiedHomepageShellHtml }
      },
      fetchText: async (url) => {
        if (url === petrus.ABOUT_COMPONENT_URL) return verifiedAboutComponentHtml
        if (url === petrus.CONTACT_COMPONENT_URL) return verifiedContactComponentHtml
        return verifiedComponentsBundleJs
      },
    }),
    /public-job route changed materially or now exposes jobs/i,
  )
})
