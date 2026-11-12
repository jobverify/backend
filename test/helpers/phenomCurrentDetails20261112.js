import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { createPhenomScraper } from '../../scraper-support/phenom/engine.js'
import { reviewedPhenomTitleBindingsForSource } from '../../scraper-support/phenom/reviewedTitleBindings20261108.js'

export const { cases } = JSON.parse(gunzipSync(readFileSync(new URL('../test-data/phenom-current-partial-details-20261112.json.gz', import.meta.url))))
const modules = { abb: 'abb.workday', cisco: 'cisco', questglobal: 'questglobal', royalenfield: 'royalenfield', thermofisherscientific: 'thermofisherscientific' }
const getScraper = async source => source === 'nttdataservices'
  ? createPhenomScraper({ source, companyName: 'NTT Data Services', baseUrl: 'https://careers.nttdata.com',
    searchPath: '/global/en/search-results', scraperDir: fileURLToPath(new URL('../../scraper/nttdataservices', import.meta.url)),
    nativeBoundModelTitlePreference: true, nativeReviewedTitleBindings: reviewedPhenomTitleBindingsForSource(source),
    nativeConcatenatedStateCountry: true, nativeCityCountryLiteral: true, nativeCommaCityLiteral: true })
  : import(new URL('../../scraper/' + modules[source] + '/script.js', import.meta.url))
export const replay = async (sample, html = sample.html) => {
  const scraper = await getScraper(sample.source)
  const page = '<script>phApp.ddo = ' + JSON.stringify({ eagerLoadRefineSearch: { status: 200, totalHits: 1, hits: 1,
    data: { jobs: [sample.listing], aggregations: [{ field: 'country', value: { India: 1 } }] } } }) + '</script>'
  return scraper.run({ maxPages: 1, maxJobs: 1, detailEnrichmentBudgetMs: 5000, fetchText: async url => {
    if (url.includes('/search-results')) return page
    assert.equal(url, sample.sourceUrl, 'Only the independently captured listing role may be fetched')
    return html
  } })
}
export const changedDetail = (sample, mutate) => {
  const model = structuredClone(sample)
  mutate(model)
  return '<link rel="canonical" href="' + model.canonical + '">'
    + '<script>phApp.ddo = ' + JSON.stringify({ jobDetail: { data: { job: model.structured } } }).replaceAll('<', '\\u003c') + '</script>'
    + (model.posting ? '<script type="application/ld+json">' + JSON.stringify(model.posting).replaceAll('<', '\\u003c') + '</script>' : '')
}

