import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Renault Group scraper module at ./script.js')
  }
}

const homepageHtml = `
  <!doctype html>
  <html lang="en">
    <body>
      <main>
        <h1>Renault Group</h1>
        <p>Careers</p>
        <p>News about the group</p>
        <a href="https://www.renaultgroup.com/en/careers/">Careers</a>
      </main>
      <footer>
        <p>Legal notices</p>
        <p>Security and confidentiality</p>
      </footer>
    </body>
  </html>
`

const careersHtml = `
  <!doctype html>
  <html lang="en">
    <body>
      <main>
        <h1>A career at the centre of the automotive revolution</h1>
        <p>Joining Renault Group means being part of a pioneering automotive company.</p>
        <h2>Find your next job</h2>
        <a href="https://alliancewd.wd3.myworkdayjobs.com/renault-group-careers">View our offers</a>
        <p>ReKnow University</p>
      </main>
      <footer>
        <p>Legal notices</p>
        <p>Security and confidentiality</p>
      </footer>
    </body>
  </html>
`

const workdayBoardHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <link rel="canonical" href="https://alliancewd.wd3.myworkdayjobs.com/renault-group-careers" />
      <meta property="og:title" content="Careers | Renault Group" />
      <meta property="og:description" content="Since 1889, Renault Group has relied on a legacy of innovation to shape the future of mobility." />
      <script>
        window.workday = {
          tenant: "alliancewd",
          siteId: "renault-group-careers",
          requestLocale: "en-US",
          appName: "cxs",
        }
      </script>
    </head>
    <body>
      <main>
        <h1>Careers at Renault Group</h1>
      </main>
    </body>
  </html>
`

const currentWorkdayBoardHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <link rel="canonical" href="https://alliancewd.wd3.myworkdayjobs.com/renault-group-careers" />
      <meta property="og:title" content="Careers | Renault Group" />
      <meta property="og:description" content="Since 1898, Renault Group has relied on a legacy of innovation and unique industrial expertise." />
      <meta property="og:url" content="https://alliancewd.wd3.myworkdayjobs.com/renault-group-careers" />
    </head>
  </html>
`

test('Renault Group validates the verified homepage, careers page, and public Workday board', async () => {
  const renault = await loadModule()

  assert.equal(renault.SOURCE, 'renaultgroup')
  assert.equal(renault.COMPANY, 'Renault Group')
  assert.equal(renault.HOMEPAGE_URL, 'https://www.renaultgroup.com/en/')
  assert.equal(renault.CAREERS_URL, 'https://www.renaultgroup.com/en/careers/')
  assert.equal(
    renault.WORKDAY_BOARD_URL,
    'https://alliancewd.wd3.myworkdayjobs.com/renault-group-careers',
  )
  assert.equal(
    renault.WORKDAY_JOBS_API_URL,
    'https://alliancewd.wd3.myworkdayjobs.com/wday/cxs/alliancewd/renault-group-careers/jobs',
  )
  assert.equal(renault.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(renault.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(renault.hasOfficialWorkdayBoardSignal(workdayBoardHtml), true)
  assert.equal(renault.hasOfficialWorkdayBoardSignal(currentWorkdayBoardHtml), true)
})

test('Renault Group run delegates to the Workday engine after verifying the first-party surfaces', async () => {
  const renault = await loadModule()

  const requestedUrls = []
  const jobs = await renault.createRenaultGroupScraper({
    now: () => '2026-08-04T00:00:00.000Z',
  }).run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      if (url === renault.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
      if (url === renault.CAREERS_URL) return { status: 200, url, html: careersHtml }
      if (url === renault.WORKDAY_BOARD_URL) return { status: 200, url, html: workdayBoardHtml }
      throw new Error(`Unexpected Renault Group URL: ${url}`)
    },
    runWorkday: async (options) => {
      assert.equal(options.company, 'Renault Group')
      assert.equal(options.source, 'renaultgroup')
      assert.equal(
        options.baseUrl,
        'https://alliancewd.wd3.myworkdayjobs.com/renault-group-careers',
      )
      assert.match(options.scraperDir, /renaultgroup$/i)
      return [{
        title: 'Officer - Process Associate Accounts Payable',
        location: 'Chennai, India',
        link: 'https://alliancewd.wd3.myworkdayjobs.com/renault-group-careers/job/Chennai/Officer---Process-Associate-Accounts-Payable_JOBREQ_50268105',
        jobId: 'JOBREQ_50268105',
      }]
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://www.renaultgroup.com/en/',
    'https://www.renaultgroup.com/en/careers/',
    'https://alliancewd.wd3.myworkdayjobs.com/renault-group-careers',
  ])
  assert.deepEqual(jobs, [{
    title: 'Officer - Process Associate Accounts Payable',
    location: 'Chennai, India',
    link: 'https://alliancewd.wd3.myworkdayjobs.com/renault-group-careers/job/Chennai/Officer---Process-Associate-Accounts-Payable_JOBREQ_50268105',
    jobId: 'JOBREQ_50268105',
    company: 'Renault Group',
    source: 'renaultgroup',
    scrapedAt: '2026-08-04T00:00:00.000Z',
  }])
})

test('Renault Group fails closed when a trusted first-party surface changes materially', async () => {
  const renault = await loadModule()

  await assert.rejects(
    renault.createRenaultGroupScraper().run({
      fetchPage: async () => ({ status: 200, url: 'https://www.renaultgroup.com/en/', html: '<html><body><h1>Unexpected homepage</h1></body></html>' }),
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    renault.createRenaultGroupScraper().run({
      fetchPage: async (url) => {
        if (url === renault.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        return { status: 200, url, html: '<html><body><h1>Unexpected careers page</h1></body></html>' }
      },
    }),
    /verified careers page/i,
  )

  await assert.rejects(
    renault.createRenaultGroupScraper().run({
      fetchPage: async (url) => {
        if (url === renault.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === renault.CAREERS_URL) return { status: 200, url, html: careersHtml }
        return { status: 200, url, html: '<html><body><h1>Unexpected Workday shell</h1></body></html>' }
      },
    }),
    /verified Workday board/i,
  )
})


test('Renault accepts current footer and corrected founding year while retaining the exact Workday handoff', async () => {
  const r = await loadModule()
  const signal = new AbortController().signal
  const home = '<title>Renault Group</title><a href="/en/careers/">Careers</a><footer>Legal information</footer>'
  const board = workdayBoardHtml.replace('Since 1889', 'Since 1898')
  await r.run({signal, fetchPage: async url => ({status:200,url,html:url===r.HOMEPAGE_URL?home:url===r.CAREERS_URL?careersHtml:board}),runWorkday:async options=>{assert.equal(options.signal,signal);return []}})
  await assert.rejects(r.run({fetchPage:async url=>({status:200,url,html:url===r.HOMEPAGE_URL?home:careersHtml.replaceAll(r.WORKDAY_BOARD_URL,'https://unrelated.wd3.myworkdayjobs.com/en-US/jobs')})}), /handoff|careers page/i)
})

test('Renault accepts the current careers headline and official international handoff with the current Workday base', async () => {
  const renault = await loadModule()
  const currentCareers = careersHtml
    .replace('A career at the centre of the automotive revolution', 'A career at the center of the automotive industry transformation')
    .replace('https://alliancewd.wd3.myworkdayjobs.com/renault-group-careers', 'https://www.renaultgroup.com/en/careers/our-international-vacancies/')
  assert.equal(renault.hasOfficialCareersSignal(currentCareers), true)
  assert.equal(renault.WORKDAY_BOARD_URL, 'https://alliancewd.wd3.myworkdayjobs.com/renault-group-careers')
  const signal = new AbortController().signal
  const result = await renault.run({
    signal,
    fetchPage: async url => ({status:200,url,html:url===renault.HOMEPAGE_URL?homepageHtml:url===renault.CAREERS_URL?currentCareers:currentWorkdayBoardHtml}),
    runWorkday: async options => {
      assert.equal(options.baseUrl, 'https://alliancewd.wd3.myworkdayjobs.com/renault-group-careers')
      assert.equal(options.signal, signal)
      return [{title:'Assistant Manager - BOP',jobId:'JOBREQ_50265566-1',country:'India'}]
    },
  })
  assert.equal(result.length, 1)
  await assert.rejects(renault.run({
    fetchPage: async url => ({status:200,url,html:url===renault.HOMEPAGE_URL?homepageHtml:currentCareers.replace('/en/careers/our-international-vacancies/', '/unverified-jobs/')}),
    runWorkday: async () => {throw new Error('Must not delegate a missing handoff')},
  }), /careers|handoff/i)
})
