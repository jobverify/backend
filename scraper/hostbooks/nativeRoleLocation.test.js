import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run,extractOpeningSections,extractOpeningSummaryRows,CAREERS_URL} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const packet=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/2026-10-31-native-packets.json.gz',import.meta.url))))[0]
const replay=html=>run({fetchText:async url=>{assert.equal(url,CAREERS_URL);return html??packet.body},now:()=> '2026-10-31T08:00:00.000Z'})
test('actual HostBooks opening rows bind nine roles and retain all mixed-markup native workplace labels',async()=>{
 const jobs=await replay()
 assert.equal(jobs.length,9);assert.ok(jobs.every(j=>j.location&&j.jobDescription&&j.postingDate==='2022-11-14'))
 assert.ok(!jobs.some(j=>/Raj Kumar|Solutions|Sitemap|About HostBooks/.test(j.title)))
 const java=jobs.find(j=>j.title==='Java Developer'),finance=jobs.find(j=>j.title==='Finance Manager')
 assert.equal(java.location,'Gurugram');assert.equal(java.country,null);assert.equal(java.department,'Development')
 assert.equal(finance.location,'Gurugram');assert.equal(finance.country,null)
 assert.equal(java.nativeRoleId,'javadev');assert.equal(java.requisitionId,null)
 assert.equal(java.sourceUrl,CAREERS_URL+'#currentOpening-modal')
 assert.equal(java.nativeLocationEvidence[0].label,'Work Location')
 const channel=jobs.find(j=>j.title==='Channel Sales - Channel Partner Manager')
 assert.equal(channel.country,'India');assert.equal(channel.city,null);assert.match(channel.location,/^Pan India Location/)
 const inside=jobs.find(j=>j.title==='Inside Sales - Relationship Manager')
 assert.equal(inside.location,'Gurugram & Bangalore');assert.equal(inside.city,null);assert.equal(inside.country,null)
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
 assert.equal(jobs.nativeCollectionEvidence.nativeOpeningRowCount,9)
})
test('HostBooks table header text cannot become part of the first role title or erase its native date',()=>{
 const rows=extractOpeningSummaryRows(packet.body)
 assert.ok(rows.has('Java Developer'));assert.equal(rows.get('Java Developer').postingDate,'2022-11-14')
 assert.ok(!rows.has('Job Title Post Date Experience Java Developer'))
})
test('a second current role supports nested value markup without borrowing another role location',async()=>{
 const html=packet.body.replace('<strong>Work Location:</strong>Gurugram','<strong>Work Location:</strong><span>Gurugram</span>')
 const jobs=await replay(html)
 assert.equal(jobs.find(j=>j.title==='Java Developer').location,'Gurugram')
 assert.equal(jobs.find(j=>j.title==='Finance Manager').location,'Gurugram')
})
test('hidden role location cannot become a positive workplace and corporate contacts cannot fill it',async()=>{
 const jobs=await replay(packet.body.replace('<p><strong>Work Location:</strong>Gurugram</p>','<p hidden><strong>Work Location:</strong>Gurugram</p>'))
 const java=jobs.find(j=>j.title==='Java Developer');assert.equal(java.location,null);assert.equal(java.country,null)
})
test('an authoritative foreign label is retained without adding India',async()=>{
 const jobs=await replay(packet.body.replace('<strong>Work Location:</strong>Gurugram','<strong>Work Location:</strong>Toronto, Canada'))
 const java=jobs.find(j=>j.title==='Java Developer');assert.equal(java.location,'Toronto, Canada');assert.equal(java.country,'Canada')
})
test('conflicting role-owned workplace statements fail closed',async()=>{
 await assert.rejects(replay(packet.body.replace('<p><strong>Work Location:</strong>Gurugram</p>','<p><strong>Work Location:</strong>Gurugram</p><p><strong>Location:</strong>Toronto, Canada</p>')))
})
test('footer and testimonial headings never become additional current openings',()=>{
 const jobs=extractOpeningSections(packet.body+'<h5>Another footer heading</h5><p>Location: Mumbai, India</p>')
 assert.equal(jobs.length,9);assert.ok(!jobs.some(j=>j.title==='Another footer heading'))
})
test('an unrelated footer table cannot become an opening inventory',async()=>{
 const footer='<table><tr><td>Unrelated Footer Role</td><td>14 Nov, 2022</td><td>4 years</td><td>View Job</td></tr></table><h5>Unrelated Footer Role</h5><p>Work Location: Toronto, Canada</p>'
 const jobs=await replay(packet.body+footer)
 assert.equal(jobs.length,9);assert.ok(!jobs.some(j=>j.title==='Unrelated Footer Role'))
})
