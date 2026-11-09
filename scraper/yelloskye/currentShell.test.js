import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {run,hasVerifiedAppShell} from './script.js'
const html=readFileSync(new URL('./fixtures/current-homepage.html',import.meta.url),'utf8')
const bundle='var routes=(a=>(a.HOME="/",a.PLATFORM="/platform",a.ABOUT="/about",a.BOOK_DEMO="/book-demo",a))(routes||{}); children:"YelloSKYE";path:"/solutions/construction-monitoring";document.getElementById("root")'
const fetcher=(js=bundle)=>async url=>({status:200,url:url.includes('/assets/')?url:'https://www.yelloskye.ai'+new URL(url).pathname,html:url.includes('/assets/')?js:html})
test('YelloSKYE accepts the current canonical identity and verifies the public application bundle before returning an empty discovery snapshot',async()=>{assert.equal(hasVerifiedAppShell(html),true);let assets=0;const fetchPage=async url=>{if(url.includes('/assets/'))assets++;return fetcher()(url)};assert.deepEqual(await run({fetchPage}),[]);assert.equal(assets,1)})
test('YelloSKYE detects new career routes and job boards inside its client application',async()=>{for(const extra of [';a.CAREERS="/careers"',';path:"/jobs"',';"https://jobs.lever.co/yelloskye"'])await assert.rejects(run({fetchPage:fetcher(bundle+extra)}),/public jobs/i)})
test('YelloSKYE refuses empty or unrelated client bundles',async()=>{await assert.rejects(run({fetchPage:fetcher('export {}')}),/bundle/i)})
