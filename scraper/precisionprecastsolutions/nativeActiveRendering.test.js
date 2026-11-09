import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
const packet=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/2026-10-31-native-packets.json.gz',import.meta.url))))
const read=url=>{const row=packet.requests.find(row=>row.url===url);assert.ok(row,'Unrecorded '+url);return row.body}
import {extractPublicJobs,CAREERS_URL} from './script.js'
const html=read(CAREERS_URL)
test('active captured cards preserve full native requirements and qualifications',()=>{const jobs=extractPublicJobs(html);assert.equal(jobs.length,6);assert.match(jobs[0].jobDescription,/Qualification/);assert.ok(jobs.every(j=>j.country==null))})
test('hidden card children stay raw and cannot enter public JD or skill fields',()=>{for(const attr of ['hidden','inert','aria-hidden="true"','style="display:none"','style="opacity:0"']){const changed=html.replace('<div class="card-body">','<div class="card-body"><p '+attr+'>CONTROLLED_HIDDEN_REQUIREMENT</p>'),job=extractPublicJobs(changed)[0];assert.equal(job.jobDescription.includes('CONTROLLED_HIDDEN_REQUIREMENT'),false,attr);assert.match(job.rawNativeRoleEvidence.descriptionHtml,/CONTROLLED_HIDDEN_REQUIREMENT/);assert.equal(job.requiredSkills.some(s=>s.includes('CONTROLLED_HIDDEN_REQUIREMENT')),false)}})
test('page CSS visibility and comments apply within the actual bound native panel',()=>{const changed=html.replace('<div class="card-body">','<div class="card-body"><p class="controlled-hide">CONTROLLED_HIDDEN_REQUIREMENT</p>')+'<style>.controlled-hide{visibility:hidden}</style>';assert.equal(extractPublicJobs(changed)[0].jobDescription.includes('CONTROLLED_HIDDEN_REQUIREMENT'),false);const copied=html.replace('<div class="card-body">','<div class="card-body"><!--<p>CONTROLLED_HIDDEN_REQUIREMENT</p>-->');assert.equal(extractPublicJobs(copied)[0].jobDescription.includes('CONTROLLED_HIDDEN_REQUIREMENT'),false)})
