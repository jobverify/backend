import assert from 'node:assert/strict'
import test from 'node:test'

const careersLandingHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Career Opportunities at Croma | Buy Electronic Appliances online | Croma</title>
    <link rel="canonical" href="https://www.croma.com/careers-at-croma/" />
    <meta
      name="description"
      content="Be a part of retail revolution, Be a part of Croma. Join our team! Need help to know how? Contact us to learn more about the different job opportunities offered at Croma"
    />
  </head>
  <body>
    <h1>Croma Careers at Croma</h1>
    <nav>
      <a href="/careers-at-croma">OVERVIEW</a>
      <a href="/cultureAndValues">EMBODYING TATA CULTURE & VALUES</a>
      <a href="/whyJoinCroma">WHY JOIN CROMA?</a>
      <a href="/current-opening">CURRENT OPENINGS</a>
    </nav>
    <p>Disclaimer</p>
    <p>
      Croma (Infiniti Retail Limited) would like to inform all persons seeking employment that it
      never seeks nor solicits any payment for the purposes of recruitment.
    </p>
    <script>
      window.__INITIAL_DATA__ = {
        "brandReducer": {
          "brandData": {
            "data": {
              "contentSlots": {
                "contentSlot": [
                  {
                    "components": {
                      "component": [
                        {
                          "uid": "PWACurrentOpeningsLink",
                          "url": "\\/current-opening"
                        }
                      ]
                    }
                  }
                ]
              }
            }
          }
        }
      }
    </script>
  </body>
</html>
`

const currentOpeningsHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Join Croma | Job Openings at Croma</title>
    <link rel="canonical" href="https://www.croma.com/current-opening/" />
  </head>
  <body>
    <h1>Croma Current Openings</h1>
    <h2>CURRENT OPENINGS/CAREER OPPORTUNITIES</h2>
    <p>About Croma</p>
    <p>Apply Now</p>
    <h3>Contact Details - Talent Acquisition Team</h3>

    <h3>North</h3>
    <table>
      <tr>
        <th>Name</th>
        <th>Email Id</th>
        <th>Location/City</th>
      </tr>
      <tr>
        <td>Virendra Pratap Singh</td>
        <td><a href="mailto:%20virendra.singh@croma.com">virendra.singh@croma.com</a></td>
        <td>North (Delhi/NCR/U.P/Punjab)</td>
      </tr>
      <tr>
        <td>Amit Parihar</td>
        <td><a href="mailto:%20amit.parihar@croma.com">amit.parihar@croma.com</a></td>
        <td>Haryana / Punjab</td>
      </tr>
    </table>

    <h3>West</h3>
    <table>
      <tr>
        <th>Name</th>
        <th>Email Id</th>
        <th>Location/City</th>
      </tr>
      <tr>
        <td>Bhoomika Laniya</td>
        <td><a href="mailto:%20bhoomika.laniya@croma.com">bhoomika.laniya@croma.com</a></td>
        <td>Ahmedabad</td>
      </tr>
    </table>

    <h3>South</h3>
    <table>
      <tr>
        <th>Name</th>
        <th>Email Id</th>
        <th>Location/City</th>
      </tr>
      <tr>
        <td>Priya Nair</td>
        <td><a href="mailto:%20priya.nair@croma.com">priya.nair@croma.com</a></td>
        <td>Bangalore</td>
      </tr>
      <tr>
        <td>Gayatri G</td>
        <td><a href="mailto:%20gayatri.g@croma.com">gayatri.g@croma.com</a></td>
        <td>Chennai</td>
      </tr>
    </table>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/croma/script.js')
  } catch {
    assert.fail('Expected Croma scraper module at ../../scraper/croma/script.js')
  }
}

test('Croma sentinel validates the verified first-party careers landing and recruiter handoff shell', async () => {
  const croma = await loadModule()

  assert.equal(croma.SOURCE, 'croma')
  assert.equal(croma.COMPANY, 'Croma')
  assert.equal(croma.CAREERS_URL, 'https://www.croma.com/careers-at-croma/')
  assert.equal(croma.CURRENT_OPENINGS_URL, 'https://www.croma.com/current-opening/')
  assert.equal(croma.hasOfficialCareersLandingSignal(careersLandingHtml), true)
  assert.equal(croma.extractCurrentOpeningsUrl(careersLandingHtml), croma.CURRENT_OPENINGS_URL)
  assert.equal(croma.hasOfficialCurrentOpeningsSignal(currentOpeningsHtml), true)
  assert.equal(croma.hasPublicJobBoardSignal(currentOpeningsHtml), false)
  assert.deepEqual(croma.extractRecruiterEmails(currentOpeningsHtml), [
    'virendra.singh@croma.com',
    'amit.parihar@croma.com',
    'bhoomika.laniya@croma.com',
    'priya.nair@croma.com',
    'gayatri.g@croma.com',
  ])
})

test('Croma sentinel returns no jobs while the verified first-party shell still routes applicants to recruiter contacts', async () => {
  const croma = await loadModule()
  const requestedUrls = []

  const jobs = await croma.createCromaScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === croma.CAREERS_URL) return careersLandingHtml
      if (url === croma.CURRENT_OPENINGS_URL) return currentOpeningsHtml

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    croma.CAREERS_URL,
    croma.CURRENT_OPENINGS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Croma sentinel fails closed when the careers shell or current openings handoff changes materially', async () => {
  const croma = await loadModule()

  await assert.rejects(
    croma.createCromaScraper().run({
      fetchText: async (url) => {
        if (url === croma.CAREERS_URL) {
          return '<html><body><h1>Careers</h1></body></html>'
        }

        return currentOpeningsHtml
      },
    }),
    /verified Croma careers surface/i,
  )

  await assert.rejects(
    croma.createCromaScraper().run({
      fetchText: async (url) => {
        if (url === croma.CAREERS_URL) {
          return careersLandingHtml.replace('\\/current-opening', '\\/jobs-board')
        }

        return currentOpeningsHtml
      },
    }),
    /verified current openings handoff/i,
  )

  await assert.rejects(
    croma.createCromaScraper().run({
      fetchText: async (url) => {
        if (url === croma.CAREERS_URL) return careersLandingHtml
        if (url === croma.CURRENT_OPENINGS_URL) {
          return `${currentOpeningsHtml}
            <article class="job-card">
              <h3>Store Operations Lead</h3>
              <a href="/current-opening/store-operations-lead">Apply Now</a>
            </article>
            <script type="application/ld+json">{"@type":"JobPosting","title":"Store Operations Lead"}</script>`
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /public jobs surface/i,
  )
})
