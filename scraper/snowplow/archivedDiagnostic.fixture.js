// Test-only DERIVED response scheduling for data-only archived diagnostics.
// Callbacks prepare input data here; the production diagnostic accepts data only.
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {diagnoseArchivedSnowplow} from './currentNative.js'
export async function inspectRetainedPackets(packets,mutate=()=>{},stringCalls=false){
 const groups=new Map()
 for(const packet of packets){const url=packet.requestUrl??packet.url,values=groups.get(url)??[];if(packet.body===undefined&&!packet.bodyBase64)continue;values.push(packet);groups.set(url,values)}
 const inputs=[]
 for(const [url,values]of groups)for(let at=0;at<4;at++){
  const p=values[Math.min(at,values.length-1)],bytes=p.bodyBase64?Buffer.from(p.bodyBase64,'base64'):Buffer.from(p.body)
  if(p.sha256)assert.equal(createHash('sha256').update(bytes).digest('hex'),p.sha256,'Immutable original packet hash before any DERIVED change')
  const response={status:p.status,url:p.finalUrl??p.url,contentType:p.contentType,body:await new Response(bytes).text()}
  const prior=Array.from({length:at},()=>stringCalls?url:{url,init:{method:'GET',headers:url.includes('/api/')?{companyIdentifier:'snowplow'}:{}}})
  mutate(response,url,prior);inputs.push({requestUrl:url,...response})
 }
 const result=await diagnoseArchivedSnowplow(inputs)
 assert.equal(result.diagnosticOnly,true);assert.equal(result.publicRequests,0);assert.equal(result.evidence.firstParty,false);assert.equal(result.evidence.listingComplete,false);assert.equal(result.evidence.verifiedAt,null)
 return{...result,jobs:result.modelJobs,evidence:result.modelEvidence,transport:{calls:result.requests}}
}
