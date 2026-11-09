import assert from 'node:assert/strict'
import test from 'node:test'
import {run,OUR_DATA_TEAM_URL,OUR_HIRING_PARTNER_URL,PUBLIC_ORGANIZATION_URL} from '../../scraper/globalorizon/script.js'
const homepage='<title>GlobalOrizon - AI based Human Scaling</title><meta property="og:site_name" content="GlobalOrizon"/><a href="/platforms/the-hiring-partner">The Hiring Partner</a><a href="#">Careers <span>Hiring</span></a>'
const product='<title>The Hiring Partner | GlobalOrizon</title><a href="https://thehiringpartner.com">Visit</a><a href="#">Careers <span>Hiring</span></a>'
const missing='<title>GlobalOrizon - AI based Human Scaling</title><h1>404</h1><h2>This page could not be found.</h2>'
const fetchPage=async url=>({url,status:url===OUR_DATA_TEAM_URL||url===OUR_HIRING_PARTNER_URL||url===PUBLIC_ORGANIZATION_URL?404:200,html:url===PUBLIC_ORGANIZATION_URL?'{"success":false,"message":"Organization not found"}':url===OUR_DATA_TEAM_URL||url===OUR_HIRING_PARTNER_URL?missing:url.endsWith('/platforms/the-hiring-partner')?product:homepage})
const missingText=async()=>{throw Object.assign(new Error('HTTP 404'),{status:404})}
test('GlobalOrizon verifies retired role pages, removed employer feed and the current placeholder before returning empty',async()=>assert.deepEqual(await run({fetchText:missingText,fetchPage}),[]))
test('GlobalOrizon refuses empty success when a real careers destination appears',async()=>await assert.rejects(run({fetchText:missingText,fetchPage:async url=>({...await fetchPage(url),html:(await fetchPage(url)).html.replace('href="#"','href="/careers"')})}),/current|career/i))
test('GlobalOrizon refuses a live or unavailable employer feed in the retirement fallback',async()=>{for(const status of [200,500])await assert.rejects(run({fetchText:missingText,fetchPage:async url=>({...await fetchPage(url),...(url===PUBLIC_ORGANIZATION_URL?{status}: {})})}),/organization|feed/i)})
test('GlobalOrizon preserves unrelated transport failures without invoking retirement checks',async()=>{const error=new Error('HTTP 503');await assert.rejects(run({fetchText:async()=>{throw error},fetchPage:async()=>assert.fail('unexpected fallback')}),e=>e===error)})
