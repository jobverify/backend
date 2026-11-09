import assert from 'node:assert/strict'
import test from 'node:test'
import { run, buildSearchResultsPageUrl, buildJobDetailUrl } from '../../scraper/rocketindia/script.js'

const row = (id, country = 'India') => ({ reqId: id, jobId: id, title: 'Engineer ' + id,
  country, cityStateCountry: country === 'India' ? 'Chennai, Tamil Nadu, India' : 'Detroit, Michigan, United States of America',
  applyUrl: 'https://quickenloans.wd5.myworkdayjobs.com/rocket_india/job/Chennai-TN/Engineer_' + id + '/apply',
})
const response = (jobs, totalHits = jobs.length) => ({ status: 200, totalHits, hits: jobs.length, data: { jobs, aggregations: [] } })
const bootstrap = (jobs, totalHits) => '<script>var phApp = phApp || ' + JSON.stringify({
  widgetApiEndpoint: 'https://careers.rocket.com/widgets', country: 'in', deviceType: 'desktop', locale: 'en_in', pageName: 'search-results',
}) + '; phApp.ddo = ' + JSON.stringify({ eagerLoadRefineSearch: response(jobs, totalHits) }) + '</script>'

test('Rocket uses the India homepage handoff for listing and detail routes', () => {
  assert.equal(buildSearchResultsPageUrl(), 'https://careers.rocket.com/in/en/search-results')
  assert.equal(new URL(buildJobDetailUrl(row('R-1'))).pathname, '/in/en/job/R-1/Engineer-R-1')
})

test('Rocket collects all 20 India-board jobs using the advertised India locale', async () => {
  const raw = Array.from({ length: 20 }, (_, index) => row('R-' + index))
  const urls = []
  const jobs = await run({ detailEnrichmentBudgetMs: 0,
    fetchText: async url => {
      urls.push(url)
      assert.equal(url, 'https://careers.rocket.com/in/en/search-results')
      return bootstrap(raw.slice(0, 10), 20)
    },
    fetchJson: async (url, options) => {
      assert.equal(url, 'https://careers.rocket.com/widgets')
      const body = JSON.parse(options.body)
      assert.equal(body.country, 'in')
      assert.equal(body.lang, 'en_in')
      assert.equal(body.from, 0)
      assert.ok(options.signal)
      return { refineSearch: response(raw) }
    },
  })
  assert.equal(urls.length, 1)
  assert.equal(jobs.length, 20)
  assert.equal(new Set(jobs.map(job => job.jobId)).size, 20)
  assert.ok(jobs.every(job => job.country === 'India' && job.sourceListingComplete === false && job.applyUrl.includes('/rocket_india/')))
})

test('Rocket still checks complete raw inventory before applying the India filter', async () => {
  const raw = [row('R-1'), row('R-2', 'United States of America')]
  const jobs = await run({ detailEnrichmentBudgetMs: 0, useWidgetApi: false,
    fetchText: async () => bootstrap(raw, 2),
  })
  assert.deepEqual(jobs.map(job => job.jobId), ['R-1'])
  await assert.rejects(run({ detailEnrichmentBudgetMs: 0, useWidgetApi: false,
    fetchText: async url => bootstrap(new URL(url).searchParams.has('from') ? [] : raw, 3),
  }), /empty page.*2.*3/i)
})

test('Rocket bounds native detail concurrency at two without changing explicit caller concurrency',async () => {
  const raw=[row('R-1'),row('R-2')]
  const measure=async override=>{
    let active=0,maximum=0
    const jobs=await run({detailEnrichmentBudgetMs:1000,...override,fetchText:async url=>{
      if(url.endsWith('/search-results'))return bootstrap(raw)
      const native=raw.find(job=>url.includes('/job/'+job.reqId+'/'))
      active++;maximum=Math.max(maximum,active)
      await new Promise(resolve=>setTimeout(resolve,15))
      active--
      return '<script>phApp.ddo = '+JSON.stringify({jobDetail:{data:{job:{...native,ml_country:'India',
        ml_Description:'Build reliable native services with the current engineering team.'}}}})+'</script>'
    }})
    assert.ok(jobs.every(job=>job.sourceDetailComplete===true))
    return maximum
  }
  assert.equal(await measure({}),2)
  assert.equal(await measure({detailConcurrency:1}),1)
})
