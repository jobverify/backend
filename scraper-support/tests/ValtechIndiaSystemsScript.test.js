import assert from 'node:assert/strict'
import test from 'node:test'
import { SOURCE,COMPANY,CAREER_LANDING_URL,JOBS_URL,JOBS_API_URL,INDIA_COUNTRY_TAG,hasOfficialCareerLandingSignal,hasOfficialJobsPageSignal,extractJobsApiUrl,buildIndiaJobsApiUrl,decodeCorporatePayload,extractJobListingsFromApi,createValtechindiasystemsScraper } from '../../scraper/valtechindiasystems/script.js'

const landing='<title>Career | Valtech</title><h1>Wanted: Innovators, Thinkers, Doers</h1><a href="/en-in/career/jobs/">Joblist</a>'
const jobs='<title>Jobs | Valtech</title><react data-url="/joblist/getjsonresult?id=1571&amp;language=en-IN&amp;limit=100" data-react-component-name="JobsPage"></react>'
test('Valtech verifies current corporate career signals and discovers the active double-encoded joblist contract',()=>{
 assert.equal(SOURCE,'valtechindiasystems');assert.equal(COMPANY,'Valtech');assert.equal(INDIA_COUNTRY_TAG,'india')
 assert.equal(CAREER_LANDING_URL,'https://www.valtech.com/en-in/career/');assert.equal(JOBS_URL,CAREER_LANDING_URL+'jobs/');assert.equal(hasOfficialCareerLandingSignal(landing),true);assert.equal(hasOfficialJobsPageSignal(jobs),true);assert.equal(extractJobsApiUrl(jobs),JOBS_API_URL)
 assert.equal(buildIndiaJobsApiUrl(),JOBS_API_URL+'&offset=0&country=india')
 const value={filters:[],list:[]};assert.deepEqual(decodeCorporatePayload(JSON.stringify(JSON.stringify(value))),value)
})
test('corporate country taxonomy supplies country but never a fabricated native requisition',()=>{
 const rows=extractJobListingsFromApi({filters:[{value:'country',tags:[{value:'india',text:'India'}]}],list:[{id:123,title:'Engineer',url:'/en-in/career/jobs/4944510101/',offices:['Bengaluru'],tags:['india']},{id:124,title:'Unknown country',url:'/en-in/career/jobs/2/',offices:['Bengaluru'],tags:[]}]})
 assert.equal(rows[0].country,'India');assert.equal(rows[0].requisitionId,null);assert.equal(rows[0].location,'Bengaluru');assert.equal(rows[1].country,null)
})
test('corporate verification excludes inert identity and source-only legacy fetchText cannot bypass response checks',async()=>{
 assert.equal(hasOfficialCareerLandingSignal('<template>'+landing+'</template>'),false);assert.equal(hasOfficialJobsPageSignal('<template>'+jobs+'</template>'),false)
 await assert.rejects(createValtechindiasystemsScraper().run({fetchText:async()=>landing}),/requires fetchPage/)
 const calls=[];await assert.rejects(createValtechindiasystemsScraper().run({fetchPage:async url=>{calls.push(url);return{url,status:200,contentType:'text/html',body:'<title>Other company</title>'}}}),/verified Valtech careers landing page/);assert.equal(calls.length,2)
})
