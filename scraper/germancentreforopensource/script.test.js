import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_URL,
  COMPANY,
  HOMEPAGE_URL,
  SOURCE,
  createGermanCentreForOpenSourceScraper,
  hasOfficialCareersSignal,
  hasOfficialHomepageSignal,
  hasPublicJobsSignal,
  matchesVerifiedNoJobsSurface,
} from './script.js'

const homepageHtml = `
  <!doctype html>
  <html lang="de">
    <head>
      <title>ZenDiS Startseite: Gemeinsam. Digital. SouverÃ¤n. - ZenDiS | Zentrum Digitale SouverÃ¤nitÃ¤t</title>
      <link rel="canonical" href="https://www.zendis.de/">
    </head>
    <body>
      <header>
        <a href="/">Logo Zendis â€“ Zur Startseite</a>
        <nav>
          <a href="/karriere">Karriere</a>
        </nav>
      </header>
      <main>
        <h1>Digitale SouverÃ¤nitÃ¤t ist HandlungsfÃ¤higkeit</h1>
        <p>Mit einem umfassenden SouverÃ¤nitÃ¤tspaket aus Plattform, Produkten und Beratung unterstÃ¼tzt das Zentrum fÃ¼r Digitale SouverÃ¤nitÃ¤t der Ã–ffentlichen Verwaltung (ZenDiS) Bund, LÃ¤nder und Kommunen.</p>
      </main>
    </body>
  </html>
`

const careersHtml = `
  <!doctype html>
  <html lang="de">
    <head>
      <title>Karriere: Digitale SouverÃ¤nitÃ¤t ist Teamwork - ZenDiS | Zentrum Digitale SouverÃ¤nitÃ¤t</title>
      <link rel="canonical" href="https://www.zendis.de/karriere">
    </head>
    <body>
      <header>
        <a href="/">Logo Zendis â€“ Zur Startseite</a>
      </header>
      <main>
        <h1>Digitale SouverÃ¤nitÃ¤t ist Teamwork</h1>
        <h2>Offene Stellen</h2>
        <p>Wir freuen uns auf Gestalterinnen und Weiterdenkerinnen mit GrÃ¼ndergeist und Eigenverantwortung.</p>
        <h2>Recruiting Kontakt</h2>
        <p>Esther AndrÃ©</p>
        <p>Recruiterin</p>
        <a href="mailto:recruiting@zendis.de">recruiting@zendis.de</a>
        <a href="/faq">Hast Du Fragen? Finde eine Antwort in unseren FAQ.</a>
        <div id="recruitee-careers"></div>
        <script>
          window.recruitee = { companies: [105958] }
        </script>
        <script src="https://jobs-widget.recruiteecdn.com/widget.js"></script>
      </main>
    </body>
  </html>
`

test('ZenDiS sentinel constants and helpers stay pinned to the verified first-party surface', () => {
  assert.equal(SOURCE, 'germancentreforopensource')
  assert.equal(COMPANY, 'German centre for open source')
  assert.equal(HOMEPAGE_URL, 'https://www.zendis.de/')
  assert.equal(CAREERS_URL, 'https://www.zendis.de/karriere')
  assert.equal(hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(hasOfficialCareersSignal(careersHtml), true)
  assert.equal(hasPublicJobsSignal(homepageHtml), false)
  assert.equal(hasPublicJobsSignal(careersHtml), false)
  assert.equal(matchesVerifiedNoJobsSurface(homepageHtml, careersHtml), true)
})

test('ZenDiS sentinel returns [] only while the verified careers page remains a no-listings surface', async () => {
  const requestedUrls = []
  const jobs = await createGermanCentreForOpenSourceScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === HOMEPAGE_URL) return homepageHtml
      if (url === CAREERS_URL) return careersHtml
      if (url === 'https://api.recruitee.com/c/105958/careers/offers/') {
        return JSON.stringify({ offers: [] })
      }
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    HOMEPAGE_URL,
    CAREERS_URL,
    'https://api.recruitee.com/c/105958/careers/offers/',
  ])
  assert.deepEqual(jobs, [])
})

test('ZenDiS sentinel fails closed when the careers route starts exposing public jobs', async () => {
  await assert.rejects(
    createGermanCentreForOpenSourceScraper().run({
      fetchText: async (url) => {
        if (url === CAREERS_URL) {
          return `
            <html>
              <head><title>Karriere - ZenDiS</title></head>
              <body>
                <h1>Karriere</h1>
                <h2>Current Openings</h2>
                <a href="/karriere/platform-engineer">Apply now</a>
              </body>
            </html>
          `
        }

        return homepageHtml
      },
    }),
    /public careers page now appears to expose job listings/i,
  )
})

test('ZenDiS sentinel fails closed when the verified careers identity drifts', async () => {
  await assert.rejects(
    createGermanCentreForOpenSourceScraper().run({
      fetchText: async (url) => {
        if (url === CAREERS_URL) {
          return `
            <html>
              <head><title>Karriere - ZenDiS</title></head>
              <body>
                <h1>Karriere</h1>
                <p>Join us.</p>
              </body>
            </html>
          `
        }

        return homepageHtml
      },
    }),
    /careers page no longer matches the verified no-listings public surface/i,
  )
})
