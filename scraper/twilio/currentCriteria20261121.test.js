import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import test from 'node:test'
import assert from 'node:assert/strict'
import {eightfoldDocument} from '../../scraper-support/utils/recruitmentEightfoldData.js'
import {selectCurrentTwilioContract} from './currentNative20261115.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-criteria-20261121.json.gz',import.meta.url))))
const packets=new Map(fixture.packets.map(packet=>[packet.url,packet]))
const HOME='https://www.twilio.com/en-us/careers',BOARD='https://jobs.twilio.com/careers'
const DONE=Object.freeze({stage:'next-independent-native-read-after-complete-current-role'})
const body=packet=>Buffer.from(packet.bodyBase64,'base64').toString()
const page=(url,text=body(packets.get(url)))=>({url,status:packets.get(url).status,html:text,text})
const native=(text,edit)=>{const value=JSON.parse(text);edit(value.data);return JSON.stringify(value)}
const published=(text,edit)=>{
 const node=eightfoldDocument(text).entries.map(({node})=>node).find(node=>node.tag==='script'&&node.attrs.type==='application/ld+json'&&JSON.parse(node.raw)['@type']==='JobPosting')
 assert.ok(node);const value=JSON.parse(node.raw);edit(value);return text.replace(node.raw,JSON.stringify(value))
}
async function replay(t,edit=text=>text){
 t.mock.method(globalThis,'fetch',()=>assert.fail('No network in original criteria regression'))
 const calls=[],added=[],{descriptor,readNative}=selectCurrentTwilioContract(page(BOARD),{source:'twilio'})
 const read=async url=>{calls.push(url);const packet=packets.get(url);if(!packet)throw DONE;return page(url,edit(body(packet),url))}
 let error
 try{await readNative(descriptor,{readPage:read,readRenderer:read,readNativeJson:read,permit:()=>true,matchingEmployer:value=>value==='Twilio',addJob:value=>added.push(value),recordRead:()=>{},inventoryRead:()=>{},unresolved:()=>{},remainingRequests:()=>48-calls.length,officialBinding:{officialURL:HOME,declaredURL:BOARD,page:page(HOME)},recheckOfficialBinding:()=>read(HOME),now:fixture.capturedAt})}catch(caught){error=caught}
 assert.equal(added.length,0,'The saved acquisition ends before independent closing proof; it cannot certify a role')
 return{calls,error}
}
test('current original complete Twilio role criteria preserve the exact reviewed company paragraph presentation pair',async t=>{
 for(const packet of fixture.packets)assert.equal(createHash('sha256').update(Buffer.from(packet.bodyBase64,'base64')).digest('hex'),packet.sha256)
 const{error}=await replay(t);assert.equal(error,DONE)
})
for(const[name,change,reason]of[
 ['one-sided full criterion',(text,url)=>url.includes('/position_details?')?native(text,row=>{row.jobDescription+='<p>A mandatory original professional licence.</p>'}):text,/complete native\/published criteria differ/],
 ['unknown matching authority inside the company presentation',(text,url)=>url.includes('/position_details?')?native(text,row=>{row.jobDescription=row.jobDescription.replace('embody our values','require a Canadian licence and embody our values')}):url.includes('/careers/job/')?published(text,row=>{row.description=row.description.replace('embody our values','require a Canadian licence and embody our values')}):text,/complete native\/published criteria differ/],
 ['punctuation change outside the exact company paragraph',(text,url)=>url.includes('/position_details?')?native(text,row=>{row.jobDescription+='<p>Maintain O'+String.fromCharCode(8217)+'Neill validation.</p>'}):url.includes('/careers/job/')?published(text,row=>{row.description+=" Maintain O'Neill validation."}):text,/complete native\/published criteria differ/],
 ['foreign published employer',(text,url)=>url.includes('/careers/job/')?published(text,row=>{row.hiringOrganization.name='Another Company'}):text,/published employer\/account contradiction/],
 ['foreign published applicant country',(text,url)=>url.includes('/careers/job/')?published(text,row=>{row.applicantLocationRequirements[0].name='Canada'}):text,/published applicant country contradiction/],
 ['contradictory native country',(text,url)=>url.includes('/position_details?')?native(text,row=>{row.standardizedLocations=['US']}):text,/native listing\/full role identity fields changed/],
 ['unknown original criteria field',(text,url)=>url.includes('/position_details?')?native(text,row=>{row.additionalQualifications='A mandatory licence'}):text,/unreviewed native full role fields/],
])test('current Twilio presentation pair holds '+name,async t=>{const{error}=await replay(t,change);assert.match(error?.message??'',reason)})
