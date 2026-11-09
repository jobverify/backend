// Offline genuine-current workflow helper; never used by production run.
import fs from 'node:fs'
import assert from 'node:assert/strict'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {run} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
export const currentFixture=()=>JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-default-20261107.json.gz',import.meta.url))))
export const outputOf=jobs=>({jobs:[...jobs],inventory:readInventoryEvidence(jobs),observations:readSourceObservationEvidence(jobs,'mykaarma'),nativeCollectionEvidence:jobs.nativeCollectionEvidence??null})
export async function replayCurrent({change=()=>{},options={},strictOrder=true,runner=run}={}){
 const fixture=currentFixture(),packets=fixture.packets.map(p=>({...p,body:Buffer.from(p.bodyBase64,'base64')})),calls=[],audits=[];for(const p of packets){assert.equal(p.body.length,p.bodyBytes);assert.equal(createHash('sha256').update(p.body).digest('hex'),p.bodySHA256)}change(packets)
 const byURL=new Map(),cursor=new Map();for(const p of packets){if(!byURL.has(p.requestedURL))byURL.set(p.requestedURL,[]);byURL.get(p.requestedURL).push(p)}let clock=0
 const fetchImpl=async(url,init)=>{const n=cursor.get(url)||0,p=byURL.get(url)?.[n];cursor.set(url,n+1);assert.ok(p,'Uncaptured public request '+url);if(strictOrder)assert.equal(url,packets[calls.length].requestedURL);assert.deepEqual({method:init.method,redirect:init.redirect,credentials:init.credentials,headers:init.headers,body:init.body??null,signalPresent:!!init.signal},p.sourceInit);calls.push(url);const response=new Response(p.body,{status:p.status,headers:{'content-type':p.contentType}});Object.defineProperty(response,'url',{value:p.finalURL});return response}
 try{const jobs=await runner({fetchImpl,now:()=>{assert.ok(clock<fixture.expected.nativeCollectionEvidence.clocks.length,'Uncaptured source clock');return fixture.expected.nativeCollectionEvidence.clocks[clock++]},onAudit:a=>audits.push(a),...options});return{jobs,output:outputOf(jobs),calls,audits,clock,fixture}}catch(error){throw{error,calls,audits,clock}}
}
export function mutateNext(packet,change){let text=packet.body.toString();text=text.replace(/(<script[^>]*id="__NEXT_DATA__"[^>]*>)([\s\S]*?)(<\/script>)/,(_,a,b,c)=>{const n=JSON.parse(b);change(n,n.props.pageProps.apiData);return a+JSON.stringify(n)+c});packet.body=Buffer.from(text)}
