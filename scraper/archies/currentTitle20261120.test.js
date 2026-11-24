import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync}from'node:zlib'
import {readCurrentArchiesCorporate,HOMEPAGE_URL}from'./currentNative20261117.js'
const html=gunzipSync(fs.readFileSync(new URL('./fixtures/current-safe-home-20261120.html.gz',import.meta.url))).toString('utf8')
test('current own Archies homepage title retains canonical organization and declared About without inventing role inventory',()=>{
 const model=readCurrentArchiesCorporate(html,HOMEPAGE_URL)
 assert.equal(model.title,'Buy Gifts, Greeting Cards, Cakes & Flowers Online | Archies')
 assert.equal(model.nativeInventoryQualified,false);assert.equal(model.corporateCountryIsRoleCountry,false)
 assert.equal(model.nativeAboutDeclaration.attrs.href,'/pages/about');assert.equal(model.nativeJobPostingModels.length,0)
})
for(const[label,change]of[
 ['foreign title',body=>body.replace('Buy Gifts, Greeting Cards, Cakes &amp; Flowers Online | Archies','Other Employer')],
 ['duplicate title',body=>body.replace('</head>','<title>Buy Gifts, Greeting Cards, Cakes &amp; Flowers Online | Archies</title></head>')],
 ['canonical',body=>body.replace('rel="canonical" href="https://archiesonline.com/"','rel="canonical" href="https://other.example/"')],
 ['base',body=>body.replace('</head>','<base href="https://other.example/"></head>')],
 ['foreign structured employer',body=>body.replaceAll('"name": "Archies Online"','"name": "Other Employer"')],
])test('current Archies title does not bypass '+label,()=>assert.throws(()=>readCurrentArchiesCorporate(change(html),HOMEPAGE_URL),/corporate|employer|Expected/))
test('current Archies title cannot suppress a newly declared native vacancy',()=>{
 const changed=html.replace('</head>','<script type="application/ld+json">{"@type":"JobPosting","title":"Actual new role"}</script></head>')
 assert.throws(()=>readCurrentArchiesCorporate(changed,HOMEPAGE_URL),/JobPosting.*review/)
})
