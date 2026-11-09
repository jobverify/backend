import assert from 'node:assert/strict'
import test from 'node:test'
import {fixture,replay,editHTML} from './fixtureReplay.js'
import {createPublicLeverSource,PUBLIC_LEVER_PROFILES as profiles} from './nativeCareers.js'
import {corroborateCurrentWorksites} from './routeEvidence.js'
import {geography} from '../declaredJobFeeds/nativeData.js'
const p=profiles.verygoodsecurityindia
const edit=(page,change)=>{const value=JSON.parse(Buffer.from(page.bodyBase64,'base64'));change(value);const text=JSON.stringify(value);return {...page,bodyBase64:Buffer.from(text).toString('base64'),html:text,text}}
const run=(r,profile=p,options={})=>createPublicLeverSource(profile).run({...r.options,...options})
globalThis.fetch=async()=>{throw Error('Only original replay and labelled synthetic boundary mutations')}

test('an unrelated malformed group cannot erase a conflicting posting or supported independent positives',async()=>{
 const first=fixture.oracle.verygoodsecurityindia.records[0]
 const r=replay((url,page)=>url===p.publicGroupedAPIURL?edit(page,groups=>{
  for(const group of groups)for(const job of group.postings)if(job.id===first.id)job.text='Conflicting published title'
  groups.push({...groups[0],postings:[]})
 }):page)
 const jobs=await run(r,{...p,countryFilter:'Global'}),a=r.audits[0],held=a.observations.find(job=>job.jobId===first.id)
 assert.equal(a.closing.nativeGroupedCollectionComplete,false)
 assert.equal(held.sourceCurrentNativePostingIdentityQualified,false)
 assert.ok(held.sourceNativeGroupedDeclarations.some(row=>row.originalRecord.text==='Conflicting published title'))
 assert.equal(jobs.some(job=>job.jobId===first.id),false)
 assert.ok(jobs.some(job=>job.jobId!==first.id),'Unrelated supported posts survive collection incompleteness')
})

test('a declared grouped-only posting keeps its complete own pair when the paginated index is incomplete',async()=>{
 const first=fixture.oracle.verygoodsecurityindia.records[0]
 const r=replay((url,page)=>url===p.publicAPIURL?edit(page,rows=>{rows.splice(rows.findIndex(row=>row.id===first.id),1)}):page)
 const jobs=await run(r,{...p,countryFilter:'Global'}),a=r.audits[0],job=jobs.find(row=>row.jobId===first.id)
 assert.equal(a.closing.nativeListingComplete,false)
 assert.equal(a.observations.length,18)
 assert.ok(job,'A published grouped ID with matching original native and own role is a supported discovery')
 assert.deepEqual(job.sourceNativeRecord,first.originalNative)
 assert.ok(job.sourceNativeGroupedDeclarations.length)
 assert.equal(a.authoritativeSourceTotal,null)
})

test('a restored empty proxy is an observed selected-channel empty array without employer-wide zero authority',async()=>{
 const r=replay((url,page)=>url===profiles.ionic.nativeProxyURL?edit(page,model=>{model.ok=true;model.data=[]}):page)
 const jobs=await run(r,profiles.ionic),a=r.audits[0]
 assert.equal(jobs.length,0);assert.equal(a.closing.nativeFeedUnavailable,false)
 assert.equal(a.closing.nativeListingComplete,true)
 assert.equal(a.sourceScopeComplete,false);assert.equal(a.authoritativeSourceTotal,null);assert.equal(a.authoritativeIndiaFacetCount,null)
})

test('a restored nonempty proxy retains records and holds a foreign board before any own request',async()=>{
 const native=fixture.oracle.netomi.records[0].originalNative
 const r=replay((url,page)=>url===profiles.ionic.nativeProxyURL?edit(page,model=>{model.ok=true;model.data=[native]}):page)
 const jobs=await run(r,profiles.ionic),a=r.audits[0]
 assert.equal(jobs.length,0);assert.equal(a.observations.length,1)
 assert.deepEqual(a.observations[0].sourceNativeListingRecord,native)
 assert.equal(a.observations[0].sourceCurrentNativePostingIdentityQualified,false)
 assert.ok(!r.requests.includes(native.hostedUrl))
})

test('VGS resolves the actual secondary Bay Area label from paired current native primary-country evidence',async()=>{
 const r=replay(),jobs=await run(r),a=r.audits[0]
 const id='4f565c0a-7a1c-4f43-ba97-0559658661dc',job=a.observations.find(row=>row.jobId===id)
 assert.equal(job.country,'United States')
 assert.equal(job.sourceCountryScopeUnresolved,false)
 assert.ok(job.sourceNativeLocationCountryCorroborations.some(row=>row.location==='San Francisco Bay Area'&&row.country==='United States'&&row.nativePostingIds.length>0))
 assert.deepEqual(job.sourceNativeJobPosting,fixture.oracle.verygoodsecurityindia.records.find(row=>row.id===id).originalSchema)
 assert.equal(jobs.some(row=>row.jobId===id),false,'All resolved worksites are foreign; employer-wide zero remains unqualified')
})

test('generic remote labels, placeholder countries and ambiguous primary labels cannot corroborate a secondary country',()=>{
 for(const scenario of ['generic','invalid-country','ambiguous']){
  const name=scenario==='generic'?'Global Remote':'Unspecified Worksite'
  const make=(id,country,location,allLocations=[location])=>{
   const record={country,categories:{location,allLocations}},schema={jobLocation:allLocations.map(addressLocality=>({address:{addressLocality}}))}
   return {jobId:id,sourceNativePhase:'opening',sourceNativeDetailQualified:true,sourceCurrentNativePostingIdentityQualified:true,
    sourceNativeRecord:record,sourceNativeJobPosting:schema,...geography(p,record,schema)}
  }
  const target=make('target','US','United States',['United States',name]),refs=[make('ref',scenario==='invalid-country'?'ZZ':'IN',name)]
  if(scenario==='ambiguous')refs.push(make('second-ref','US',name))
  const jobs=[target,...refs],map=new Map(jobs.map(job=>[job.jobId,job]))
  corroborateCurrentWorksites(p,{phase:'opening',nativePostIds:jobs.map(job=>job.jobId)},map,[])
  assert.equal(target.sourceCountryScopeUnresolved,true,scenario)
  assert.equal(target.country,null,scenario)
  assert.deepEqual(target.sourceNativeLocationCountryCorroborations,[],scenario)
 }
})

test('an explicit owned city can match a comma-qualified place without borrowing a remote headquarters city or conflicting country',()=>{
 const record={country:'IN',categories:{location:'Bengaluru, India',allLocations:['Bengaluru, India']}}
 let geo=geography(p,record,{jobLocation:{address:{addressLocality:'Bengaluru',addressCountry:'IN'}}})
 assert.equal(geo.city,'Bengaluru');assert.equal(geo.country,'India')
 geo=geography(p,record,{jobLocation:{address:{addressLocality:'Bengaluru',addressCountry:'US'}}})
 assert.equal(geo.sourceNativeCountryConflict,true);assert.equal(geo.country,null)
 geo=geography(p,{country:'US',categories:{location:'Remote',allLocations:['Remote']}},{jobLocation:{address:{addressLocality:'San Francisco',addressCountry:'US'}}})
 assert.equal(geo.city,null)
})

test('a restored Ionic proxy can retain an independently paired positive while its board index remains missing',async()=>{
 const original=fixture.oracle.netomi.records[0],profile=profiles.ionic,url=profile.literalCachedRoleReferences[0],id=new URL(url).pathname.split('/').at(-1)
 const rewrite=value=>JSON.parse(JSON.stringify(value).replaceAll(original.id,id).replaceAll('https://jobs.lever.co/netomi','https://jobs.lever.co/Ionic').replaceAll('Netomi','Ionic'))
 const record=rewrite(original.originalNative);record.id=id;record.hostedUrl=url;record.applyUrl=url+'/apply'
 const schema=rewrite(original.originalSchema);schema.hiringOrganization.name='Ionic'
 const html='<html><head><title>Ionic</title><meta property="og:url" content="'+url+'"><link rel="canonical" href="'+url+'"><script type="application/ld+json">'+JSON.stringify(schema).replaceAll('</script','<\\/script')+'</script></head><body></body></html>'
 const page=(url,text)=>({url,status:200,headers:{'content-type':'application/json'},bodyBase64:Buffer.from(text).toString('base64'),html:text,text,syntheticBoundaryEntity:true})
 const api='https://api.lever.co/v0/postings/Ionic/'+id
 const extra=new Map([[api,page(api,JSON.stringify(record))],[url,page(url,html)]])
 const r=replay((url,response)=>url===profile.nativeProxyURL?edit(response,model=>{model.ok=true;model.data=[record]}):response,extra)
 const jobs=await run(r,profile),a=r.audits[0]
 assert.equal(a.closing.nativeListingComplete,false)
 assert.equal(a.closing.nativeBoardMissing,true)
 assert.equal(jobs.length,1)
 assert.equal(jobs[0].jobId,id);assert.deepEqual(jobs[0].sourceNativeRecord,record)
 assert.equal(a.sourceScopeComplete,false);assert.equal(a.authoritativeSourceTotal,null)
})

test('a proxy top-level error retains its full original model and cannot become empty inventory evidence',async()=>{
 const model={ok:false,error:'Upstream unavailable',data:[]}
 const r=replay((url,page)=>url===profiles.ionic.nativeProxyURL?editHTML(page,()=>JSON.stringify(model)):page)
 await run(r,profiles.ionic);const phase=r.audits[0].closing
 assert.deepEqual(phase.originalNativeProxy,model)
 assert.equal(phase.nativeFeedUnavailable,true);assert.equal(phase.nativeListingComplete,false)
})

test('an explicit grouped-channel error holds collection completeness without erasing supported own records',async()=>{
 const r=replay((url,page)=>url===p.publicGroupedAPIURL?edit(page,groups=>{groups[0].error='Partial upstream result'}):page)
 const jobs=await run(r,{...p,countryFilter:'Global'}),phase=r.audits[0].closing
 assert.equal(phase.nativeGroupedCollectionComplete,false);assert.equal(phase.nativeListingComplete,false)
 assert.equal(jobs.length,18)
 assert.equal(r.audits[0].sourceScopeComplete,false)
})

for(const phase of ['opening','closing'])test('review R1: a null flat-feed member in '+phase+' preserves all independently paired roles',async()=>{
 const r=replay((url,page,visit)=>url===p.publicAPIURL&&visit===(phase==='opening'?1:2)?edit(page,rows=>{rows.push(null)}):page)
 const jobs=await run(r,{...p,countryFilter:'Global'}),audit=r.audits[0]
 assert.equal(audit[phase].nativeListingComplete,false)
 assert.equal(audit.observations.length,18)
 assert.equal(jobs.length,18)
 assert.ok(audit[phase].originalNativeFeed[0].includes(null))
 assert.equal(r.requests.filter(url=>/^https:\/\/api\.lever\.co\/v0\/postings\/verygoodsecurity\/[0-9a-f-]{36}$/.test(url)).length,36)
 assert.ok(audit.observations.every(job=>job.sourceNativeDetailQualified&&job.sourceCurrentNativePostingIdentityQualified))
})

const groupContradictions={
 descriptionBody:'<p>This advertised role requires a contradictory permanent relocation.</p>',
 lists:[{text:'Mandatory relocation',content:'<p>A conflicting current requirement.</p>'}],
 workplaceType:'review-conflicting-workplace',
 salaryRange:{currency:'INR',interval:'year',min:123456,max:234567},
 createdAt:1234567890000,
}
for(const [field,value]of Object.entries(groupContradictions))test('review R2: conflicting grouped '+field+' holds only its role beside unrelated malformed data',async()=>{
 const first=fixture.oracle.verygoodsecurityindia.records[0]
 const r=replay((url,page)=>url===p.publicGroupedAPIURL?edit(page,groups=>{
  for(const group of groups)for(const record of group.postings)if(record.id===first.id)record[field]=structuredClone(value)
  groups.push({title:'Unrelated malformed group',postings:null})
 }):page)
 const jobs=await run(r,{...p,countryFilter:'Global'}),audit=r.audits[0],held=audit.observations.find(job=>job.jobId===first.id)
 assert.equal(audit.closing.nativeListingComplete,false)
 assert.equal(held.sourceCurrentNativePostingIdentityQualified,false)
 assert.ok(held.sourceNativeIssues.some(issue=>issue.includes('grouped collection/own post conflict: '+field)))
 assert.deepEqual(held.sourceNativeRecord,first.originalNative)
 assert.ok(held.sourceNativeGroupedDeclarations.some(row=>JSON.stringify(row.originalRecord[field])===JSON.stringify(value)))
 assert.equal(jobs.some(job=>job.jobId===first.id),false)
 assert.equal(jobs.length,17,'Every unrelated valid role remains eligible')
})

test('review R3: headquarters, unspecified and aggregate worksite labels never borrow an India country',()=>{
 for(const name of ['Headquarters','HQ','Head office','Unspecified Worksite','Unspecified location','Multiple locations','Multiple worksites','Unknown','Not specified','N/A','TBD','Various locations','All locations']){
  const make=(id,country,location,allLocations=[location])=>{
   const record={country,categories:{location,allLocations}},schema={jobLocation:allLocations.map(addressLocality=>({address:{addressLocality}}))}
   return {jobId:id,sourceNativePhase:'opening',sourceNativeDetailQualified:true,sourceCurrentNativePostingIdentityQualified:true,
    sourceNativeRecord:record,sourceNativeJobPosting:schema,...geography(p,record,schema)}
  }
  const target=make('target','US','United States',['United States',name]),owner=make('owner','IN',name)
  const originals=[structuredClone(target.sourceNativeJobPosting),structuredClone(owner.sourceNativeJobPosting)],map=new Map([['target',target],['owner',owner]])
  corroborateCurrentWorksites(p,{phase:'opening',nativePostIds:['target','owner']},map,[])
  assert.equal(target.country,null,name)
  assert.equal(target.sourceCountryScopeUnresolved,true,name)
  assert.deepEqual(target.sourceNativeLocationCountryCorroborations,[],name)
  assert.deepEqual([target.sourceNativeJobPosting,owner.sourceNativeJobPosting],originals,name+' originals stay unchanged')
 }
})
