import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREER_PAGE_URL,
  buildSearchUrl,
  createSevenElevenScraper,
  pageIndicatesIndiaFalsePositive,
} from '../../scraper/seveneleven/script.js'

test('pageIndicatesIndiaFalsePositive recognizes the current India to Indiana false-positive flow on 7-Eleven careers', () => {
  const html = `
    <section id="search-results" data-location="India" data-total-results="5048">
      <h1><span>5048 job results found in India</span></h1>
      <article class="search-result">
        <a href="/job/michigan-city/store-crew/45445/78116575648">Store Crew</a>
        <span>5830 FRANKLIN STREET, MICHIGAN CITY, Indiana, 46360, United States</span>
      </article>
    </section>
  `

  assert.equal(buildSearchUrl(), CAREER_PAGE_URL)
  assert.equal(pageIndicatesIndiaFalsePositive(html), true)
  assert.equal(
    pageIndicatesIndiaFalsePositive(`
      <section id="search-results" data-location="India" data-total-results="1">
        <h1><span>1 job results found in India</span></h1>
        <article class="search-result">
          <span>Bangalore, Karnataka, India</span>
        </article>
      </section>
    `),
    false,
  )
})

test('run validates the current 7-Eleven public India false-positive flow and returns an empty result set', async () => {
  const requestedUrls = []
  const scraper = createSevenElevenScraper()

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return `
        <section id="search-results" data-location="India" data-total-results="5048">
          <h1><span>5048 job results found in India</span></h1>
          <article class="search-result">
            <a href="/job/cincinnati/store-crew/45445/74783066720">Store Crew</a>
            <span>5830 FRANKLIN STREET, MICHIGAN CITY, Indiana, 46360, United States</span>
          </article>
        </section>
      `
    },
  })

  assert.deepEqual(requestedUrls, [CAREER_PAGE_URL])
  assert.deepEqual(jobs, [])
})

test('run throws when the 7-Eleven careers page no longer matches the expected India false-positive flow', async () => {
  const scraper = createSevenElevenScraper()

  await assert.rejects(
    scraper.run({
      fetchText: async () => '<main>Unexpected careers experience</main>',
    }),
    /India false-positive flow/i,
  )
})
