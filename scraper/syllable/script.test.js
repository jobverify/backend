import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { resolveZeroJobOutcome } from '../../scraper-support/runner.js'
import { decorateJobsWithProviderMetadata } from '../../scraper-support/providers/index.js'
import assert from 'node:assert/strict'
import test from 'node:test'
import { run, extractListingCards } from './script.js'

const careers = '<title>Careers at Syllable AI - AI Infrastructure &amp; Agent Platform</title><h1>Build the Future of AI Infrastructure</h1><p>Open Positions</p><a href="https://ats.rippling.com/syllable-corporation/jobs">View Open Positions</a>'
const data = {props:{pageProps:{apiData:{jobBoard:{slug:'syllable-corporation',companyName:'Syllable Corporation',boardURL:'https://ats.rippling.com/syllable-corporation/jobs'},jobBoardSlug:'syllable-corporation'},dehydratedState:{queries:[{queryKey:['board','syllable-corporation','job-posts',false,{searchQuery:'',departments:[],workplaceType:null,country:'',state:'',city:'',page:0,pageSize:20}],state:{status:'success',error:null,data:{items:[],page:0,pageSize:20,totalItems:0,totalPages:0}}}]}}},query:{jobBoardSlug:'syllable-corporation'}}
const board = value => '<title>Syllable Corporation</title><h1>Syllable Corporation</h1><h4>There are currently no open roles.</h4><a>Powered by Rippling</a><script id="__NEXT_DATA__" type="application/json">'+JSON.stringify(value)+'</script>'

test('Syllable validates the exact Rippling board and successful unfiltered zero-role query', async () => {
  const jobs = await run({fetchText:async url => url === 'https://syllable.ai/careers' ? careers : board(data)})
  assert.deepEqual(jobs, [])
  const decorated = decorateJobsWithProviderMetadata(jobs, {source:'syllable',companyName:'Syllable',countryFilter:'India'})
  assert.equal(readInventoryEvidence(decorated)?.reportedTotal, 0)
  assert.equal(resolveZeroJobOutcome({provider:{zeroResultPolicy:'evidence-required'}}, decorated, []), 'verified-empty')
})

test('Syllable rejects unverified and contradictory zero-role states', () => {
  for (const alter of [d=>{d.props.pageProps.apiData.jobBoard.slug='another-company'},d=>{d.props.pageProps.dehydratedState.queries[0].state.data.totalItems=1},d=>{d.props.pageProps.dehydratedState.queries[0].queryKey[4].country='US'},d=>{d.props.pageProps.dehydratedState.queries[0].state.status='error'}]) {
    const invalid = structuredClone(data);alter(invalid)
    assert.throws(()=>extractListingCards(board(invalid)),/verified|trusted/i)
  }
  assert.throws(()=>extractListingCards(board({})),/verified|trusted/i)
})

test('Syllable does not infer no roles from missing listing links alone', () => {
  assert.throws(()=>extractListingCards('<title>Syllable Corporation</title><h1>Syllable Corporation</h1><p>View job</p><a>Powered by Rippling</a>'),/verified|trusted/i)
})
