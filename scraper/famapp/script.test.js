import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const homepageHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>FamApp by Trio</title>
    </head>
    <body>
      <main>
        <h1>FamApp by Trio (formerly FamPay)</h1>
        <h2>Want to shape finance for the next gen?</h2>
        <a href="/careers/">Careers</a>
      </main>
      <footer>
        <p>Address: 3rd Floor, Obeya Verve, HSR Layout, Bengaluru, Karnataka 560102</p>
      </footer>
    </body>
  </html>
`

const careersHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Careers | FamApp</title>
    </head>
    <body>
      <main>
        <h1>#JoinTheFam</h1>
        <h2>So like, what does Fam do?</h2>
        <p>Challenge the status quo.</p>
        <p>Warning: our perks might make your friends mad</p>
        <p>Free therapy with mental health professionals</p>
        <p>FamApp by Trio (formerly FamPay)</p>
        <a href="https://www.famapp.in/jobs/">View openings</a>
      </main>
    </body>
  </html>
`

test('FamApp validates the verified homepage and careers page with the known first-party Fam jobs handoff', async () => {
  const famapp = await loadModule()
  assert.ok(famapp, 'FamApp scraper module should load')

  assert.equal(famapp.SOURCE, 'famapp')
  assert.equal(famapp.COMPANY, 'FamApp by Trio')
  assert.equal(famapp.HOMEPAGE_URL, 'https://www.famapp.in/')
  assert.equal(famapp.CAREERS_URL, 'https://www.famapp.in/careers/')
  assert.equal(famapp.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(famapp.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(famapp.hasPublicJobsSignal(careersHtml), true)
  assert.equal(famapp.hasKnownFirstPartyJobsHandoffSignal(careersHtml), true)
})

test('FamApp run reads the known first-party jobs handoff instead of returning an unchecked empty list', async () => {
  const famapp = await loadModule()
  const { readFile } = await import('node:fs/promises')
  const jobsHtml = await readFile(new URL('./fixtures/jobs.html', import.meta.url), 'utf8')
  const client = await readFile(new URL('./fixtures/jobs-client.js', import.meta.url), 'utf8')
  const groups = JSON.parse(await readFile(new URL('./fixtures/lever-grouped.json', import.meta.url), 'utf8'))
  const requestedUrls = []
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
  assert.deepEqual(requestedUrls.slice(0, 3), [
    famapp.HOMEPAGE_URL, famapp.CAREERS_URL, famapp.JOBS_URL,
  ])
  assert.equal(jobs.length, 16)
})

test('FamApp fails closed when the homepage or careers page changes materially or starts exposing direct job links', async () => {
  const famapp = await loadModule()
  assert.ok(famapp, 'FamApp scraper module should load')

  await assert.rejects(
    famapp.createFamAppScraper().run({
      fetchPage: async () => ({ status: 200, url: 'https://www.famapp.in/', html: '<html><body><h1>Unexpected homepage</h1></body></html>' }),
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    famapp.createFamAppScraper().run({
      fetchPage: async (url) => {
        if (url === famapp.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        return { status: 200, url, html: '<html><body><h1>Unexpected careers page</h1></body></html>' }
      },
    }),
    /verified careers page/i,
  )

  await assert.rejects(
    famapp.createFamAppScraper().run({
      fetchPage: async (url) => {
        if (url === famapp.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        return {
          status: 200,
          url,
          html: careersHtml.replace(
            '</main>',
            '<a href="https://boards.greenhouse.io/famapp">View openings</a></main>',
          ),
        }
      },
    }),
    /now appears to expose a direct public jobs surface/i,
  )
})


test('FamApp follows the current client jobs handoff and returns the complete live India Lever inventory', async () => {
  const famapp = await loadModule()
  const { readFile } = await import('node:fs/promises')
  const fixture = (name) => readFile(new URL('./fixtures/' + name, import.meta.url), 'utf8')
  const pages = new Map([
    ['https://www.famapp.in/', await fixture('homepage.html')],
    ['https://www.famapp.in/careers/', await fixture('careers.html')],
    ['https://www.famapp.in/jobs/', await fixture('jobs.html')],
  ])
  const client = await fixture('jobs-client.js')
  const grouped = JSON.parse(await fixture('lever-grouped.json'))
  const postings = grouped.flatMap((group) => group.postings)
  const requestedPages = []
  const requestedApi = []
  const jobs = await famapp.run({
    fetchPage: async (url) => {
      requestedPages.push(url)
      return { status: 200, url, html: pages.get(url) ?? (url.endsWith('/46b0e91d4324e433.js') ? client : '/* unrelated client bundle */') }
    },
    fetchJson: async (url) => {
      requestedApi.push(url)
      if (url === 'https://api.lever.co/v0/postings/fampay?group=team&mode=json') return grouped
      const parsed = new URL(url)
      return postings.slice(Number(parsed.searchParams.get('skip')), Number(parsed.searchParams.get('skip')) + Number(parsed.searchParams.get('limit')))
    },
    now: () => '2026-10-08T18:15:00.000Z',
  })
  assert.equal(jobs.length, 16)
  assert.deepEqual(jobs.map((job) => job.jobId).sort(), postings.map((job) => job.id).sort())
  assert.ok(jobs.every((job) => job.country === 'India' && job.source === 'famapp' && job.jobDescription))
  assert.ok(requestedPages.includes('https://www.famapp.in/jobs/'))
  assert.ok(requestedPages.some((url) => url.endsWith('/46b0e91d4324e433.js')))
  assert.equal(requestedApi.length, 2)
})
