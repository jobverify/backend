import assert from 'node:assert/strict'
import test from 'node:test'

const loadHyundaiMotorIndiaModule = async () => {
  try {
    return await import('../../scraper/hyundaimotorindia/script.js')
  } catch {
    assert.fail('Expected Hyundai Motor India scraper module at ../../scraper/hyundaimotorindia/script.js')
  }
}

const emptySearchPayload = {
  jobSearchResult: [],
  totalJobs: 0,
}

test('buildSearchRequestPayload keeps Hyundai Motor India requests on the official SuccessFactors jobs API contract', async () => {
  const {
    SEARCH_API_URL,
    SEARCH_PAGE_URL,
    buildSearchRequestPayload,
  } = await loadHyundaiMotorIndiaModule()

  assert.equal(
    SEARCH_PAGE_URL,
    'https://careers.hyundai.co.in/search/?createNewAlert=false&q=&locationsearch=',
  )
  assert.equal(
    SEARCH_API_URL,
    'https://careers.hyundai.co.in/services/recruiting/v1/jobs',
  )

  assert.deepEqual(buildSearchRequestPayload(), {
    keywords: '',
    locale: 'en_US',
    pageNumber: 0,
    sortBy: 'recent',
  })
})

test('extractSearchResults returns no Hyundai Motor India listings when the official jobs API reports zero openings', async () => {
  const {
    extractSearchResults,
    extractSearchSummary,
  } = await loadHyundaiMotorIndiaModule()

  assert.deepEqual(extractSearchResults(emptySearchPayload), [])
  assert.deepEqual(extractSearchSummary(emptySearchPayload), {
    totalJobCount: 0,
    pageSize: 0,
  })
})

test('run returns an empty array without attempting detail fetches when Hyundai Motor India has no live public openings', async () => {
  const {
    SEARCH_API_URL,
    createHyundaiMotorIndiaScraper,
  } = await loadHyundaiMotorIndiaModule()

  const requests = []
  const jobs = await createHyundaiMotorIndiaScraper().run({
    fetchJson: async (url, options = {}) => {
      requests.push({
        url,
        method: options.method || 'GET',
        body: options.body || null,
      })

      if (url !== SEARCH_API_URL) {
        throw new Error(`Unexpected Hyundai Motor India URL: ${url}`)
      }

      return emptySearchPayload
    },
  })

  assert.deepEqual(requests, [{
    url: SEARCH_API_URL,
    method: 'POST',
    body: JSON.stringify({
      keywords: '',
      locale: 'en_US',
      pageNumber: 0,
      sortBy: 'recent',
    }),
  }])
  assert.deepEqual(jobs, [])
})
