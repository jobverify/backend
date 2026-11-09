import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected LogRocket scraper module at ./script.js')
  }
}

const careersHtml = `
  <html>
    <head>
      <title data-next-head="">Careers | LogRocket</title>
      <link rel="canonical" href="https://logrocket.com/careers" />
    </head>
    <body>
      <main>
        <h2>LogRocket is growing. Welcome aboard.</h2>
        <section>
          <h3>Open Roles</h3>
        </section>
      </main>
      <script id="__NEXT_DATA__" type="application/json">
        {
          "props": {
            "pageProps": {
              "openings": [
                {
                  "id": "6d7fc949-6d48-4781-a0e4-77b4c48b5be8",
                  "title": "Developer Relations",
                  "location": "Boston or NYC",
                  "department": "Engineering",
                  "workType": "Full Time"
                },
                {
                  "id": "f6c33ede-1960-4a6c-bb64-29cfcba38a60",
                  "title": "Director of Growth",
                  "location": "Boston, MA",
                  "department": "Marketing",
                  "workType": "Full Time"
                },
                {
                  "id": "42d82bcb-7645-4efd-be5a-4983060e1571",
                  "title": "Lead Software Engineer",
                  "location": "Boston or NYC",
                  "department": "Engineering",
                  "workType": "Full Time"
                },
                {
                  "id": "cac67948-9675-4470-b98f-99471d6c6088",
                  "title": "Senior Product Designer",
                  "location": "Boston or NYC",
                  "department": "Product",
                  "workType": "Full Time"
                },
                {
                  "id": "0aa8b60f-1a74-4e53-b23a-8d5dc7c497a8",
                  "title": "Senior Software Engineer",
                  "location": "Boston or NYC",
                  "department": "Engineering",
                  "workType": "Full Time"
                },
                {
                  "id": "53742e5a-b861-4192-aaaa-a55b33cf5598",
                  "title": "Talent Network",
                  "location": "Remote - US or Boston, MA",
                  "department": "Talent Network",
                  "workType": "Full Time or Intern/Co-op"
                }
              ]
            }
          }
        }
      </script>
    </body>
  </html>
`

test('LogRocket scraper validates the verified first-party next-data openings contract', async () => {
  const logrocket = await loadModule()

  assert.equal(logrocket.SOURCE, 'logrocket')
  assert.equal(logrocket.COMPANY, 'LogRocket')
  assert.equal(logrocket.CAREERS_PAGE_URL, 'https://logrocket.com/careers')
  assert.equal(logrocket.VERIFIED_ON, '2026-07-25')
  assert.equal(logrocket.hasVerifiedCareersPageSignal(careersHtml), true)
  assert.deepEqual(logrocket.extractOpeningsFromNextData(careersHtml), [
    {
      id: '6d7fc949-6d48-4781-a0e4-77b4c48b5be8',
      title: 'Developer Relations',
      location: 'Boston or NYC',
      department: 'Engineering',
      workType: 'Full Time',
      label: 'Developer Relations Boston or NYC Engineering Full Time',
    },
    {
      id: 'f6c33ede-1960-4a6c-bb64-29cfcba38a60',
      title: 'Director of Growth',
      location: 'Boston, MA',
      department: 'Marketing',
      workType: 'Full Time',
      label: 'Director of Growth Boston, MA Marketing Full Time',
    },
    {
      id: '42d82bcb-7645-4efd-be5a-4983060e1571',
      title: 'Lead Software Engineer',
      location: 'Boston or NYC',
      department: 'Engineering',
      workType: 'Full Time',
      label: 'Lead Software Engineer Boston or NYC Engineering Full Time',
    },
    {
      id: 'cac67948-9675-4470-b98f-99471d6c6088',
      title: 'Senior Product Designer',
      location: 'Boston or NYC',
      department: 'Product',
      workType: 'Full Time',
      label: 'Senior Product Designer Boston or NYC Product Full Time',
    },
    {
      id: '0aa8b60f-1a74-4e53-b23a-8d5dc7c497a8',
      title: 'Senior Software Engineer',
      location: 'Boston or NYC',
      department: 'Engineering',
      workType: 'Full Time',
      label: 'Senior Software Engineer Boston or NYC Engineering Full Time',
    },
    {
      id: '53742e5a-b861-4192-aaaa-a55b33cf5598',
      title: 'Talent Network',
      location: 'Remote - US or Boston, MA',
      department: 'Talent Network',
      workType: 'Full Time or Intern/Co-op',
      label: 'Talent Network Remote - US or Boston, MA Talent Network Full Time or Intern/Co-op',
    },
  ])
  assert.equal(logrocket.hasIndiaOpenings(logrocket.extractOpeningsFromNextData(careersHtml)), false)
})

test('LogRocket scraper run() returns no jobs while the verified openings stay outside India', async () => {
  const logrocket = await loadModule()
  const requestedUrls = []

  const jobs = await logrocket.createLogRocketScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return careersHtml
    },
  })

  assert.deepEqual(requestedUrls, [logrocket.CAREERS_PAGE_URL])
  assert.deepEqual(jobs, [])
})

test('LogRocket scraper fails closed when the verified careers page contract drifts or India hiring appears', async () => {
  const logrocket = await loadModule()

  await assert.rejects(
    logrocket.createLogRocketScraper().run({
      fetchText: async () => '<html><body><h1>Placeholder</h1></body></html>',
    }),
    /verified logrocket careers page changed materially/i,
  )

  await assert.rejects(
    logrocket.createLogRocketScraper().run({
      fetchText: async () => careersHtml.replace('Boston or NYC', 'Bengaluru, India'),
    }),
    /india slice changed materially/i,
  )
})
