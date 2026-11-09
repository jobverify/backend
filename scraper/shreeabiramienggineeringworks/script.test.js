import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected SHREE ABIRAMI ENGGINEERING WORKS scraper module at ./script.js')
  }
}

const officialSearchResultPage = {
  url: 'https://www.bing.com/search?q=%22SHREE%20ABIRAMI%20ENGGINEERING%20WORKS%22',
  status: 200,
  text: `
    <!doctype html>
    <html lang="en">
      <head>
        <title>"SHREE ABIRAMI ENGGINEERING WORKS" - Search</title>
      </head>
      <body>
        <main>
          <ol id="b_results">
            <li class="b_algo">
              <h2><a href="https://www.indiamart.com/example/shree-abirami-engineering-works.html">Shree Abirami Engineering Works - IndiaMART</a></h2>
              <p>Directory listing only.</p>
            </li>
          </ol>
        </main>
      </body>
    </html>
  `,
}

const encodedTitleSearchResultPage = {
  ...officialSearchResultPage,
  text: officialSearchResultPage.text.replace(
    '<title>"SHREE ABIRAMI ENGGINEERING WORKS" - Search</title>',
    '<title>&quot;SHREE ABIRAMI ENGGINEERING WORKS&quot; - Search</title>',
  ),
}

test('SHREE ABIRAMI ENGGINEERING WORKS sentinel pins the verified missing first-party careers contract', async () => {
  const shreeabirami = await loadModule()

  assert.equal(shreeabirami.SOURCE, 'shreeabiramienggineeringworks')
  assert.equal(shreeabirami.COMPANY, 'SHREE ABIRAMI ENGGINEERING WORKS')
  assert.deepEqual(shreeabirami.CANDIDATE_COMPANY_URLS, [
    'https://www.shreeabirami.com/',
    'https://shreeabirami.com/',
    'https://www.shreeabirami.co.in/',
    'https://shreeabirami.co.in/',
    'https://www.shreeabirami.in/',
    'https://shreeabirami.in/',
  ])
  assert.equal(
    shreeabirami.isVerifiedNoFirstPartySearchResult(officialSearchResultPage),
    true,
  )
  assert.equal(
    shreeabirami.isVerifiedNoFirstPartySearchResult(encodedTitleSearchResultPage),
    true,
  )
  assert.equal(
    shreeabirami.isVerifiedNoResolvableFirstPartyDomain({
      url: 'https://www.shreeabirami.co.in/',
      ok: false,
      errorMessage: "The remote name could not be resolved: 'www.shreeabirami.co.in'",
    }),
    true,
  )
  assert.equal(
    shreeabirami.isVerifiedNoResolvableFirstPartyDomain({
      url: 'https://www.shreeabirami.in/',
      ok: false,
      errorMessage: 'getaddrinfo ENOTFOUND www.shreeabirami.in',
    }),
    true,
  )
})

test('SHREE ABIRAMI ENGGINEERING WORKS sentinel returns no jobs only while the verified no-first-party state holds', async () => {
  const shreeabirami = await loadModule()
  const requestedDomains = []
  const requestedSearches = []

  const jobs = await shreeabirami.createShreeAbiramiEnggineeringWorksScraper().run({
    probeUrl: async (url) => {
      requestedDomains.push(url)
      return {
        url,
        ok: false,
        errorMessage: `The remote name could not be resolved: '${new URL(url).hostname}'`,
      }
    },
    searchWeb: async (query) => {
      requestedSearches.push(query)
      return officialSearchResultPage
    },
  })

  assert.deepEqual(requestedDomains, shreeabirami.CANDIDATE_COMPANY_URLS)
  assert.deepEqual(requestedSearches, [shreeabirami.SEARCH_QUERY])
  assert.deepEqual(jobs, [])
})

test('SHREE ABIRAMI ENGGINEERING WORKS sentinel fails closed when a candidate domain resolves or a first-party search result appears', async () => {
  const shreeabirami = await loadModule()

  await assert.rejects(
    shreeabirami.createShreeAbiramiEnggineeringWorksScraper().run({
      probeUrl: async (url) => {
        if (url === shreeabirami.CANDIDATE_COMPANY_URLS[0]) {
          return {
            url,
            ok: true,
            finalUrl: url,
            status: 200,
            text: '<html><head><title>Shree Abirami</title></head><body><a href="/careers">Careers</a></body></html>',
          }
        }

        return {
          url,
          ok: false,
          errorMessage: `The remote name could not be resolved: '${new URL(url).hostname}'`,
        }
      },
      searchWeb: async () => officialSearchResultPage,
    }),
    /candidate first-party domain now resolves/i,
  )

  await assert.rejects(
    shreeabirami.createShreeAbiramiEnggineeringWorksScraper().run({
      probeUrl: async (url) => ({
        url,
        ok: false,
        errorMessage: `The remote name could not be resolved: '${new URL(url).hostname}'`,
      }),
      searchWeb: async () => ({
        ...officialSearchResultPage,
        text: `
          <!doctype html>
          <html lang="en">
            <head>
              <title>"SHREE ABIRAMI ENGGINEERING WORKS" - Search</title>
            </head>
            <body>
              <ol id="b_results">
                <li class="b_algo">
                  <h2><a href="https://www.shreeabirami.co.in/careers">SHREE ABIRAMI ENGGINEERING WORKS Careers</a></h2>
                </li>
              </ol>
            </body>
          </html>
        `,
      }),
    }),
    /first-party search result surfaced/i,
  )
})
