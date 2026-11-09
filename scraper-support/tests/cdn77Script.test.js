import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-25T00:00:00.000Z'

const verifiedCareersHtml = `
<!doctype html>
<html lang="cs">
  <head>
    <meta name="author" content="(c) 2026 DataCamp Limited"/>
    <meta name="description" content="Jeden globální produkt | ~200 lidí | 0 pravidelných meetingů | 100% volnost v rozhodování"/>
    <title>Práce v CDN77.com | CDN77.jobs</title>
  </head>
  <body>
    <main>
      <a href="/#pracovni-nabidky">Pracovní nabídky</a>
      <a href="/#pracovni-nabidky">Koho zrovna hledáme</a>
      <div>
        <span>Všechny nabídky</span>
        <span>2</span>
      </div>
      <ul class="flex w-full flex-col divide-y border-t">
        <li>
          <a href="/nabidka/472710-software-engineer-performance-engineer" class="hover:bg-gray-light group relative block">
            <div>
              <div><span>Vývoj, Linux admins, Network</span></div>
              <h3>Software engineer / Performance engineer</h3>
            </div>
            <div>
              <span class="text-sm">Praha 10, Česko</span>
              <span class="text-sm">Práce na plný úvazek</span>
            </div>
          </a>
        </li>
        <li>
          <a href="/nabidka/472721-frontend-engineer" class="hover:bg-gray-light group relative block">
            <div>
              <div><span>Vývoj, Linux admins, Network</span></div>
              <h3>Frontend engineer</h3>
            </div>
            <div>
              <span class="text-sm">Praha 10, Česko</span>
              <span class="text-sm">Práce na plný úvazek</span>
            </div>
          </a>
        </li>
      </ul>
    </main>
  </body>
</html>
`

const indiaListingHtml = `
<!doctype html>
<html lang="en">
  <head>
    <meta name="author" content="(c) 2026 DataCamp Limited"/>
    <meta name="description" content="Jeden globální produkt | ~200 lidí | 0 pravidelných meetingů | 100% volnost v rozhodování"/>
    <title>Práce v CDN77.com | CDN77.jobs</title>
  </head>
  <body>
    <main>
      <a href="/#pracovni-nabidky">Pracovní nabídky</a>
      <a href="/#pracovni-nabidky">Koho zrovna hledáme</a>
      <span>Všechny nabídky</span>
      <span>1</span>
      <ul class="flex w-full flex-col divide-y border-t">
        <li>
          <a href="/nabidka/555001-node-js-engineer-india" class="hover:bg-gray-light group relative block">
            <div>
              <div><span>Vývoj, Linux admins, Network</span></div>
              <h3>Node.js engineer</h3>
            </div>
            <div>
              <span class="text-sm">Bengaluru, India</span>
              <span class="text-sm">Full time job</span>
            </div>
          </a>
        </li>
      </ul>
    </main>
  </body>
</html>
`

const loadCdn77Module = async () => {
  try {
    return await import('../../scraper/cdn77/script.js')
  } catch {
    assert.fail('Expected CDN77 scraper module at ../../scraper/cdn77/script.js')
  }
}

test('CDN77 pins the verified first-party jobs page and visible count contract', async () => {
  const cdn77 = await loadCdn77Module()

  assert.equal(cdn77.SOURCE, 'cdn77')
  assert.equal(cdn77.COMPANY_NAME, 'CDN77')
  assert.equal(cdn77.CAREERS_URL, 'https://www.cdn77.jobs/')
  assert.equal(cdn77.hasOfficialCareersPageSignal(verifiedCareersHtml), true)
  assert.equal(cdn77.extractVisibleJobCount(verifiedCareersHtml), 2)
  assert.equal(
    cdn77.buildAbsoluteUrl('/nabidka/472710-software-engineer-performance-engineer'),
    'https://www.cdn77.jobs/nabidka/472710-software-engineer-performance-engineer',
  )
})

test('CDN77 returns an honest zero-job result while the verified public inventory is Prague-only', async () => {
  const cdn77 = await loadCdn77Module()

  const cards = cdn77.extractListingCardsFromCareersHtml(verifiedCareersHtml)
  assert.equal(cards.length, 2)
  assert.equal(cards[0].title, 'Software engineer / Performance engineer')
  assert.equal(cards[0].location, 'Praha 10, Česko')
  assert.deepEqual(cdn77.mapIndiaCardsToJobs(cards, { scrapedAt: FIXED_SCRAPED_AT }), [])

  const requested = []
  const jobs = await cdn77.createCdn77Scraper().run({
    fetchText: async (url) => {
      requested.push(url)
      return verifiedCareersHtml
    },
    now: () => FIXED_SCRAPED_AT,
  })

  assert.deepEqual(requested, ['https://www.cdn77.jobs/'])
  assert.deepEqual(jobs, [])
})

test('CDN77 keeps future India cards when the verified first-party page starts exposing them', async () => {
  const cdn77 = await loadCdn77Module()

  const jobs = await cdn77.createCdn77Scraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async () => indiaListingHtml,
  })

  assert.deepEqual(jobs, [
    {
      title: 'Node.js engineer',
      company: 'CDN77',
      location: 'Bengaluru, India',
      city: 'Bengaluru',
      country: 'India',
      link: 'https://www.cdn77.jobs/nabidka/555001-node-js-engineer-india',
      applyUrl: 'https://www.cdn77.jobs/nabidka/555001-node-js-engineer-india',
      sourceUrl: 'https://www.cdn77.jobs/nabidka/555001-node-js-engineer-india',
      source: 'cdn77',
      jobId: '555001',
      requisitionId: '555001',
      department: 'Vývoj, Linux admins, Network',
      employmentType: 'Full time job',
      experienceRequired: null,
      jobDescription: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      scrapedAt: FIXED_SCRAPED_AT,
    },
  ])
})

test('CDN77 fails closed when the verified page signal drifts or the visible count contradicts the parsed cards', async () => {
  const cdn77 = await loadCdn77Module()

  await assert.rejects(
    cdn77.createCdn77Scraper().run({
      fetchText: async () => '<html><body><h1>Careers</h1></body></html>',
    }),
    /verified first-party jobs page/i,
  )

  await assert.rejects(
    cdn77.createCdn77Scraper().run({
      fetchText: async () => verifiedCareersHtml.replace('<span>2</span>', '<span>3</span>'),
    }),
    /visible job count|contract/i,
  )
})
