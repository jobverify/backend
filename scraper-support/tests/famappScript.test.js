import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h2>FamApp by Trio</h2>
      <p>FamApp by Trio (formerly FamPay) focuses on financial inclusion of the next generation.</p>
      <section>
        <h3>Want to shape finance for the next gen?</h3>
        <a href="/careers/">Join the Fam</a>
      </section>
      <footer>
        <p>Address: 3rd Floor, Obeya Verve, HSR Layout, Bengaluru, Karnataka 560102</p>
      </footer>
    </main>
  </body>
</html>
`

const careersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <p>#JoinTheFam</p>
      <h1>Be a part of the team setting the bar for new-world work culture</h1>
      <h2>So like, what does Fam do?</h2>
      <h3>Challenge the status quo</h3>
      <p>Warning: our perks might make your friends mad</p>
      <p>Free therapy with mental health professionals</p>
      <p>FamApp by Trio (formerly FamPay) focuses on financial inclusion of the next generation.</p>
      <a href="/jobs/">View openings</a>
    </main>
  </body>
</html>
`

const loadFamAppModule = async () => {
  try {
    return await import('../../scraper/famapp/script.js')
  } catch {
    assert.fail('Expected FamApp scraper module at ../../scraper/famapp/script.js')
  }
}

test('FamApp accepts its verified identity and consumes the complete first-party Lever jobs handoff', async () => {
  const famapp = await loadFamAppModule()
  const { readFile } = await import('node:fs/promises')
  const fixture = (name) => readFile(new URL('../../scraper/famapp/fixtures/' + name, import.meta.url), 'utf8')
  const jobsHtml = await fixture('jobs.html')
  const client = await fixture('jobs-client.js')
  const groups = JSON.parse(await fixture('lever-grouped.json'))
  const requestedUrls = []

  assert.equal(famapp.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(famapp.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(famapp.hasPublicJobsSignal(careersHtml), true)
  assert.equal(famapp.hasKnownFirstPartyJobsHandoffSignal(careersHtml), true)

  const jobs = await famapp.run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      const html = url === famapp.HOMEPAGE_URL ? homepageHtml
        : url === famapp.CAREERS_URL ? careersHtml
          : url === famapp.JOBS_URL ? jobsHtml
            : url.endsWith('/46b0e91d4324e433.js') ? client : '/* unrelated client bundle */'
      return { status: 200, url, html }
    },
    fetchJson: async (url) => url === famapp.LEVER_API_URL ? groups : groups.flatMap((group) => group.postings),
  })

  assert.deepEqual(requestedUrls.slice(0, 3), [famapp.HOMEPAGE_URL, famapp.CAREERS_URL, famapp.JOBS_URL])
  assert.equal(jobs.length, 16)
})

test('FamApp fails closed when the official homepage identity changes', async () => {
  const famapp = await loadFamAppModule()

  await assert.rejects(
    famapp.createFamAppScraper().run({
      fetchPage: async (url) => {
        if (url === famapp.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><body>Unrelated homepage</body></html>' }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified official homepage/i,
  )
})

test('FamApp fails closed when the careers page starts exposing a direct public jobs surface', async () => {
  const famapp = await loadFamAppModule()
  const careersWithPublicJobs = careersHtml.replace(
    '</main>',
    '<a href="https://jobs.lever.co/famapp/role">Apply now</a></main>',
  )

  await assert.rejects(
    famapp.createFamAppScraper().run({
      fetchPage: async (url) => {
        if (url === famapp.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === famapp.CAREERS_URL) {
          return { status: 200, url, html: careersWithPublicJobs }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /direct public jobs surface/i,
  )
})
