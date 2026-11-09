import assert from 'node:assert/strict'
import test from 'node:test'

const loadAJSKModule = async () => {
  try {
    return await import('../../scraper/ajsk/script.js')
  } catch {
    assert.fail('Expected AJSK scraper module at ../../scraper/ajsk/script.js')
  }
}

const officialHomepageHtml = `
<!doctype html>
<html lang="de">
  <head>
    <meta charset="UTF-8">
    <title>AJSK GmbH</title>
  </head>
  <body>
    <a href="#content">Zum Inhalt springen</a>
    <nav>
      <a href="https://www.ajsk.com/">Home</a>
      <a href="https://www.ajsk.com/kontakt/">Kontakt</a>
      <a href="https://www.ajsk.com/impressum/">Impressum</a>
    </nav>
    <main id="content">
      <p>Herzlich willkommen bei der AJSK GmbH! Wir sind ein fuehrendes Unternehmen im Bereich Gesundheit und Wellness, das sich auf hochwertige Vitamine und Nahrungsergaenzungsmittel spezialisiert hat.</p>
      <h4>Unser Shop - Montcalia.ch</h4>
      <a href="https://www.montcalia.ch/">Jetzt einkaufen bei Montcalia.ch</a>
      <h4>Kontaktieren Sie uns</h4>
      <a href="https://www.ajsk.com/?page_id=1213">Kontakt</a>
    </main>
    <footer>
      <p>AJSK GmbH</p>
      <p>Gewerbestrasse 10 CH-6330 Cham Schweiz</p>
      <p>&copy; 2026 AJSK GmbH • Erstellt mit GeneratePress</p>
    </footer>
  </body>
</html>
`

const pagesApiPayload = [
  {
    id: 1213,
    slug: 'kontakt',
    link: 'https://www.ajsk.com/kontakt/',
    title: { rendered: 'Kontakt' },
  },
  {
    id: 1210,
    slug: 'impressum',
    link: 'https://www.ajsk.com/impressum/',
    title: { rendered: 'Impressum' },
  },
  {
    id: 1165,
    slug: 'home-4',
    link: 'https://www.ajsk.com/',
    title: { rendered: 'Home' },
  },
]

const missingCareerRouteHtml = `
<!doctype html>
<html lang="de">
  <head>
    <meta charset="UTF-8">
    <title>Seite nicht gefunden &#8211; AJSK GmbH</title>
  </head>
  <body>
    <a href="#content">Zum Inhalt springen</a>
    <nav>
      <a href="https://www.ajsk.com/">Home</a>
      <a href="https://www.ajsk.com/kontakt/">Kontakt</a>
      <a href="https://www.ajsk.com/impressum/">Impressum</a>
    </nav>
    <main id="content">
      <h1>Hoppla! Diese Seite konnte leider nicht gefunden werden.</h1>
      <p>Es sieht so aus, als ob an dieser Stelle nichts gefunden wurde. Wie waere es mit einer Suche?</p>
      <label>Suche nach:</label>
    </main>
    <footer>
      <p>AJSK GmbH</p>
      <p>&copy; 2026 AJSK GmbH • Erstellt mit GeneratePress</p>
    </footer>
  </body>
</html>
`

const publicJobsRouteHtml = `
<!doctype html>
<html lang="de">
  <head>
    <title>Karriere - AJSK GmbH</title>
  </head>
  <body>
    <main>
      <h1>Offene Stellen</h1>
      <p>Join our team</p>
      <a href="/apply">Apply now</a>
    </main>
  </body>
</html>
`

test('AJSK sentinel pins the verified homepage, WordPress pages inventory, and missing first-party careers routes', async () => {
  const ajsk = await loadAJSKModule()

  assert.equal(ajsk.SOURCE, 'ajsk')
  assert.equal(ajsk.COMPANY, 'AJSK')
  assert.equal(ajsk.VERIFIED_AT, '2026-07-15')
  assert.equal(ajsk.HOMEPAGE_URL, 'https://www.ajsk.com/')
  assert.equal(ajsk.PAGES_API_URL, 'https://www.ajsk.com/wp-json/wp/v2/pages?per_page=100')
  assert.deepEqual(ajsk.NO_PUBLIC_CAREERS_ROUTE_URLS, [
    'https://www.ajsk.com/careers/',
    'https://www.ajsk.com/career/',
    'https://www.ajsk.com/jobs/',
    'https://www.ajsk.com/join-us/',
    'https://www.ajsk.com/work-with-us/',
    'https://www.ajsk.com/openings/',
    'https://www.ajsk.com/karriere/',
    'https://www.ajsk.com/stellen/',
  ])

  assert.equal(ajsk.hasOfficialHomepageSignal(officialHomepageHtml), true)
  assert.equal(ajsk.hasPublicJobsSignal(officialHomepageHtml), false)
  assert.equal(ajsk.hasCareerRouteLinkSignal(officialHomepageHtml), false)
  assert.equal(ajsk.hasVerifiedPagesInventoryShape(pagesApiPayload), true)
  assert.equal(
    ajsk.isVerifiedMissingCareerRoute({
      status: 404,
      url: 'https://www.ajsk.com/karriere/',
      html: missingCareerRouteHtml,
    }),
    true,
  )
})

test('AJSK sentinel returns no jobs while the verified first-party site exposes no public careers surface', async () => {
  const ajsk = await loadAJSKModule()
  const requestedUrls = []
  const requestedJson = []

  const jobs = await ajsk.createAJSKScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === ajsk.HOMEPAGE_URL) {
        return { status: 200, url, html: officialHomepageHtml }
      }

      if (ajsk.NO_PUBLIC_CAREERS_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: missingCareerRouteHtml }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJson.push(url)

      if (url === ajsk.PAGES_API_URL) {
        return pagesApiPayload
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    ajsk.HOMEPAGE_URL,
    ...ajsk.NO_PUBLIC_CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(requestedJson, [ajsk.PAGES_API_URL])
  assert.deepEqual(jobs, [])
})

test('AJSK sentinel fails closed when the homepage, page inventory, or first-party routes drift into a public careers surface', async () => {
  const ajsk = await loadAJSKModule()

  await assert.rejects(
    ajsk.createAJSKScraper().run({
      fetchPage: async (url) => {
        if (url === ajsk.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: '<html><head><title>AJSK GmbH</title></head><body><h1>Jobs</h1></body></html>',
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
      fetchJson: async () => pagesApiPayload,
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    ajsk.createAJSKScraper().run({
      fetchPage: async (url) => {
        if (url === ajsk.HOMEPAGE_URL) {
          return { status: 200, url, html: officialHomepageHtml }
        }

        if (ajsk.NO_PUBLIC_CAREERS_ROUTE_URLS.includes(url)) {
          return { status: 404, url, html: missingCareerRouteHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
      fetchJson: async () => [
        ...pagesApiPayload,
        {
          id: 1400,
          slug: 'karriere',
          link: 'https://www.ajsk.com/karriere/',
          title: { rendered: 'Karriere' },
        },
      ],
    }),
    /verified wordpress pages inventory/i,
  )

  await assert.rejects(
    ajsk.createAJSKScraper().run({
      fetchPage: async (url) => {
        if (url === ajsk.HOMEPAGE_URL) {
          return { status: 200, url, html: officialHomepageHtml }
        }

        if (url === ajsk.NO_PUBLIC_CAREERS_ROUTE_URLS[0]) {
          return { status: 200, url, html: publicJobsRouteHtml }
        }

        if (ajsk.NO_PUBLIC_CAREERS_ROUTE_URLS.slice(1).includes(url)) {
          return { status: 404, url, html: missingCareerRouteHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
      fetchJson: async () => pagesApiPayload,
    }),
    /verified no-public-careers surface/i,
  )
})
