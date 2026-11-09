import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const careersHtml = `
<!doctype html>
<html lang="de">
  <head>
    <title>Ausbildung & Karriere</title>
  </head>
  <body>
    <main>
      <h2>Ausbildung & Karriere</h2>
      <p>Weltweit beschaeftigen wir mehr als 3.000 Mitarbeiter.</p>
      <p>Finden Sie Ihren Job auf unserer Stellenboerse.</p>
      <p>bewerbung@schwing.de</p>
      <a href="https://schwing-stetter.com/de_de/unternehmen/ausbildung-karriere/stetter/stellenboerse.html">Stetter Stellenboerse</a>
    </main>
  </body>
</html>
`

const liveishCareersHtml = `
<!doctype html>
<html lang="de">
  <head>
    <title>Ausbildung & Karriere</title>
  </head>
  <body>
    <main>
      <h2>Ausbildung & Karriere</h2>
      <p>Weltweit beschäftigen wir mehr als 3.000 Mitarbeiter.</p>
      <p>Finden Sie Ihren Job auf unserer Stellenbörse.</p>
      <p>bewerbung@schwing.de</p>
      <a href="https://schwing-stetter.com/de_de/unternehmen/ausbildung-karriere/stetter/stellenboerse.html">Stetter Stellenbörse</a>
    </main>
  </body>
</html>
`

const stetterBoardHtml = `
<!doctype html>
<html lang="de">
  <head>
    <title>Stellenboerse</title>
  </head>
  <body>
    <main>
      <h4>Unternehmen</h4>
      <p>Stetter GmbH</p>
      <p>Dr.-Karl-Lenz-Strasse 70</p>
      <p>87700 Memmingen / Germany</p>
      <p>info@STETTER.de</p>
      <p>Copyright © 2024 SCHWING GmbH / Stetter GmbH</p>
    </main>
  </body>
</html>
`

test('Schwing Stetter scraper recognizes the verified official careers shell and empty Stetter board', async () => {
  const schwingStetter = await loadModule()
  assert.ok(schwingStetter, 'Expected Schwing Stetter scraper module at ./script.js')

  assert.equal(schwingStetter.SOURCE, 'schwingstetter')
  assert.equal(schwingStetter.COMPANY, 'Schwing Stetter')
  assert.equal(
    schwingStetter.CAREERS_URL,
    'https://schwing-stetter.com/de_de/unternehmen/ausbildung-karriere.html',
  )
  assert.equal(
    schwingStetter.STETTER_BOARD_URL,
    'https://schwing-stetter.com/de_de/unternehmen/ausbildung-karriere/stetter/stellenboerse.html',
  )
  assert.equal(schwingStetter.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(schwingStetter.hasOfficialCareersSignal(liveishCareersHtml), true)
  assert.equal(schwingStetter.hasOfficialStetterBoardSignal(stetterBoardHtml), true)
  assert.equal(schwingStetter.pageExposesPublicJobListings(stetterBoardHtml), false)
  assert.equal(
    schwingStetter.pageExposesPublicJobListings(`
      <html>
        <body>
          <article>
            <h2>Servicetechniker</h2>
            <a href="/de_de/jobs/servicetechniker.html">Jetzt bewerben</a>
          </article>
        </body>
      </html>
    `),
    true,
  )
})

test('Schwing Stetter scraper returns no jobs while the verified official Stetter board remains empty', async () => {
  const schwingStetter = await loadModule()
  assert.ok(schwingStetter, 'Expected Schwing Stetter scraper module at ./script.js')

  const requestedUrls = []
  const jobs = await schwingStetter.createSchwingStetterScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === schwingStetter.CAREERS_URL) return careersHtml
      if (url === schwingStetter.STETTER_BOARD_URL) return stetterBoardHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    schwingStetter.CAREERS_URL,
    schwingStetter.STETTER_BOARD_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Schwing Stetter scraper fails closed when the verified official careers surfaces change or expose jobs', async () => {
  const schwingStetter = await loadModule()
  assert.ok(schwingStetter, 'Expected Schwing Stetter scraper module at ./script.js')

  await assert.rejects(
    schwingStetter.createSchwingStetterScraper().run({
      fetchText: async (url) => {
        if (url === schwingStetter.CAREERS_URL) {
          return '<html><body><h1>Karriere</h1></body></html>'
        }

        return stetterBoardHtml
      },
    }),
    /verified official careers surface/i,
  )

  await assert.rejects(
    schwingStetter.createSchwingStetterScraper().run({
      fetchText: async (url) => {
        if (url === schwingStetter.CAREERS_URL) return careersHtml
        if (url === schwingStetter.STETTER_BOARD_URL) {
          return `
            <html>
              <body>
                <main>
                  <p>Stetter GmbH</p>
                  <p>Dr.-Karl-Lenz-Strasse 70</p>
                  <p>87700 Memmingen / Germany</p>
                  <p>info@STETTER.de</p>
                  <article>
                    <h2>Servicetechniker</h2>
                    <a href="/de_de/jobs/servicetechniker.html">Jetzt bewerben</a>
                  </article>
                  <p>Copyright © 2024 SCHWING GmbH / Stetter GmbH</p>
                </main>
              </body>
            </html>
          `
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /public job listings/i,
  )
})
