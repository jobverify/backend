import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!-- Load Tailwind CSS from CDN -->
<script src="https://cdn.tailwindcss.com"></script>
<script>
    tailwind.config = {
        theme: {
            extend: {
                colors: {
                    'navy': {
                        '700': '#003366',
                        '900': '#001f3f'
                    },
                    'maroon': {
                        '600': '#C00000',
                        '700': '#A00000'
                    }
                }
            }
        }
    };
</script>
<style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    body {
        font-family: 'Inter', sans-serif;
    }
</style>
<body class="bg-white text-gray-800 antialiased">
  <header>
    <a href="#" class="logo">SymboSystems LLC</a>
    <a href="#" onclick="showPage('home'); return false;">Home</a>
    <a href="#" onclick="showPage('about'); return false;">About</a>
    <a href="#" onclick="showPage('buy'); return false;">Buyers</a>
    <a href="#" onclick="showPage('sell'); return false;">Sellers</a>
    <a href="#" onclick="showPage('contact'); return false;">Contact</a>
  </header>
  <main>
    <h1>Innovative Real Estate Solutions</h1>
    <p>Experience seamless transactions and expert guidance for buyers and sellers from start to finish.</p>
    <h2>About SymboSystems LLC</h2>
    <p>At SymboSystems LLC, we are redefining the real estate experience.</p>
    <p>Our Mission</p>
    <p>Our Values</p>
    <p>Empowering Home Buyers</p>
    <p>Terms of Service</p>
  </main>
</body>
`

const blockedRoutePage = {
  status: 403,
  url: 'https://www.symbosystems.com/careers',
  html: `<?xml version="1.0" encoding="UTF-8"?><Error><Code>AccessDenied</Code><Message>Access Denied</Message></Error>`,
}

const publicJobsPage = {
  status: 200,
  url: 'https://www.symbosystems.com/careers',
  html: `
    <html>
      <body>
        <h1>Careers at Symbo Systems</h1>
        <p>Current Openings</p>
        <a href="https://jobs.lever.co/symbosystems/platform-engineer">Apply now</a>
      </body>
    </html>
  `,
}

const loadModule = async () => import('./script.js')

test('Symbo Systems sentinel recognizes the verified homepage and blocked careers-route surface', async () => {
  const symboSystems = await loadModule()

  assert.equal(symboSystems.SOURCE, 'symbosystems')
  assert.equal(symboSystems.COMPANY, 'Symbo Systems')
  assert.equal(symboSystems.HOMEPAGE_URL, 'https://www.symbosystems.com/')
  assert.deepEqual(symboSystems.CHECKED_ROUTE_URLS, [
    'https://www.symbosystems.com/careers',
    'https://www.symbosystems.com/careers/',
    'https://www.symbosystems.com/career',
    'https://www.symbosystems.com/career/',
    'https://www.symbosystems.com/jobs',
    'https://www.symbosystems.com/jobs/',
    'https://www.symbosystems.com/join-us',
    'https://www.symbosystems.com/join-us/',
    'https://www.symbosystems.com/openings',
    'https://www.symbosystems.com/openings/',
    'https://www.symbosystems.com/apply',
    'https://www.symbosystems.com/apply/',
    'https://www.symbosystems.com/work-with-us',
    'https://www.symbosystems.com/work-with-us/',
  ])

  assert.equal(symboSystems.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(symboSystems.hasFirstPartyCareerLikeLink(homepageHtml), false)
  assert.equal(symboSystems.hasPublicJobsSignal(homepageHtml), false)
  assert.equal(symboSystems.isVerifiedBlockedCareersRoute(blockedRoutePage), true)
})

test('Symbo Systems sentinel returns no jobs while the verified first-party surface stays unchanged', async () => {
  const symboSystems = await loadModule()
  const requestedUrls = []

  const jobs = await symboSystems.createSymboSystemsScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === symboSystems.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (symboSystems.CHECKED_ROUTE_URLS.includes(url)) {
        return { ...blockedRoutePage, url }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    symboSystems.HOMEPAGE_URL,
    ...symboSystems.CHECKED_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Symbo Systems sentinel fails closed when the homepage or careers routes drift into a jobs surface', async () => {
  const symboSystems = await loadModule()

  await assert.rejects(
    symboSystems.createSymboSystemsScraper().run({
      fetchPage: async (url) => {
        if (url === symboSystems.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Placeholder</h1></body></html>',
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /official homepage/i,
  )

  await assert.rejects(
    symboSystems.createSymboSystemsScraper().run({
      fetchPage: async (url) => {
        if (url === symboSystems.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: homepageHtml.replace(
              '<a href="#" onclick="showPage(\'contact\'); return false;">Contact</a>',
              '<a href="/careers">Careers</a>',
            ),
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /careers or jobs link/i,
  )

  await assert.rejects(
    symboSystems.createSymboSystemsScraper().run({
      fetchPage: async (url) => {
        if (url === symboSystems.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === symboSystems.CHECKED_ROUTE_URLS[0]) {
          return publicJobsPage
        }

        if (symboSystems.CHECKED_ROUTE_URLS.slice(1).includes(url)) {
          return { ...blockedRoutePage, url }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /careers routes changed materially|public jobs/i,
  )
})
