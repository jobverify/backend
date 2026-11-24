import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {isVerifiedMissingCareersRoute} from '../scraper/protechsoft/script.js'
const bytes=gunzipSync(fs.readFileSync(new URL('./fixtures/protechsoft-current-404-20261120.html.gz',import.meta.url)))
assert.equal(bytes.length,1281)
assert.equal(createHash('sha256').update(bytes).digest('hex'),'e2a20cb1e09aecb06e2ca755f96e109184424a83f26b957bc66fbfd3bc7b4b15')
const html=bytes.toString('utf8')
test('Protechsoft original current HTTP404 known missing-route shell is classified as missing',()=>{
 assert.equal(isVerifiedMissingCareersRoute({status:404,html}),true)
})
test('Protechsoft historical HTTP200 soft404 shell remains supported',()=>{
 assert.equal(isVerifiedMissingCareersRoute({status:200,html}),true)
})
test('Protechsoft denial,redirect and server errors never become a verified missing route',()=>{
 for(const status of [301,302,401,403,429,500,503])assert.equal(isVerifiedMissingCareersRoute({status,html}),false,String(status))
})
test('Protechsoft missing route with a published native JobPosting remains held',()=>{
 assert.equal(isVerifiedMissingCareersRoute({status:404,html:html+'<script type="application/ld+json">{"@type":"JobPosting","title":"Engineer","description":"Full role criteria"}</script>'}),false)
})
test('Protechsoft missing route with a first-party recruitment handoff remains held',()=>{
 assert.equal(isVerifiedMissingCareersRoute({status:404,html:html+'<a href="/jobs">Current jobs</a>'}),false)
})
