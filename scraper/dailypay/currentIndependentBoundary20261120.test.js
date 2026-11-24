import './currentHandoff20261120.test.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import {fixture,replay,appEdit,element,BOARD,ID} from './currentConfiguredBoard20261120.test.js'

const JOBS=fixture.responses[1].requestedUrl,CLIENT=fixture.responses[2].requestedUrl
const exact=(source,old,next)=>{assert.equal(source.split(old).length,2,'Unique genuine independently reviewed current target');assert.notEqual(next,old);return source.replace(old,()=>next)}
const closing=(url,op)=>(response,current,n)=>{if(current===url&&n===1)response.text=op(response.text)}
async function held(change){let changed=false,error;try{await replay((q,u,n)=>{const before=JSON.stringify(q);change(q,u,n);changed ||= before!==JSON.stringify(q)})}catch(e){error=e}assert(changed,'Independent regression targets actual current bytes');assert(error,'Disconnected current handoff must refuse configured zero');assert.equal(error.nativeContradiction,true);assert.equal(error.failureKind,'parser_or_contract_error')}

test('The native exact own bare HTTPS root backlink remains the same current DailyPay publisher',async()=>{
 const r=await replay((response,url)=>{if(url===BOARD)response.text=appEdit(response.text,model=>{assert.equal(model.organization.publicWebsite,'https://www.dailypay.com/');model.organization.publicWebsite='https://dailypay.com/'})})
 assert.equal(r.evidence.status,'complete-inventory');assert.equal(r.audit.companyIndiaTotal,null)
 for(const phase of r.audit.observations)assert.equal(phase.board.organizationBinding.website,'https://dailypay.com/')
})

test('Actual own Article mainEntityOfPage cannot identify another path on the same origin',()=>held(closing(JOBS,html=>element(html,n=>n.tag==='script'&&n.attrs.type==='application/ld+json'&&JSON.parse(n.raw)['@type']==='Article',(source,n)=>{
 const value=JSON.parse(n.raw);assert.equal(value.mainEntityOfPage['@type'],'WebPage');assert.equal(new URL(value.mainEntityOfPage['@id']).pathname,'/jobs/');value.mainEntityOfPage['@id']='https://www.dailypay.com/other-careers/';return exact(source,n.raw,JSON.stringify(value))
}))))

for(const[label,old,next]of[
 ['initialization already disabled','isInitialized: false','isInitialized: true'],
 ['frame existence unconditionally true','return container != null && iframe != null;','return true;'],
 ['unreachable initialize body','initialize: () => {','initialize: () => { return;'],
 ['unreachable actual DOM append','container.appendChild(iframe);','return; container.appendChild(iframe);'],
 ['automatic settings disabled by intermediate overlay','{}, window.__Ashby.defaultSettings, settingsFromUrlParameters,','{}, window.__Ashby.defaultSettings, settingsFromUrlParameters, {autoLoad:false},'],
 ['default single-role selection','jobPostingId: undefined','jobPostingId: "'+ID+'"'],
 ['bound actual iframe source replacement','container.appendChild(iframe);','const reviewedFrameSource=iframe.setAttribute.bind(iframe);reviewedFrameSource("src","https://other.invalid/");container.appendChild(iframe);'],
 ['base path replacement before actual URL construction','const urlForIframe = new URL(baseJobBoardUrl);','baseJobBoardUrl = `${baseJobBoardUrl}/other-role`;const urlForIframe = new URL(baseJobBoardUrl);']
])test('Independent current embed finding: '+label,()=>held(closing(CLIENT,s=>exact(s,old,next))))
