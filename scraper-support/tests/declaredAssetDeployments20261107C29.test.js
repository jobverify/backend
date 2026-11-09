import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createDeclaredJobFeedScraper, DECLARED_JOB_FEED_PROFILES} from '../native-sources/declaredJobFeeds/nativeCareers.js'
import {fixture} from '../native-sources/declaredJobFeeds/fixtureReplay.js'
import {readInventoryEvidence} from '../utils/inventoryEvidence.js'

// Genuine corporate and asset bytes have their own original capture receipts.
// Pairing them with the older native corpus is offline regression input only.
const deployment=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/currentNative20261107C29/declared-assets.json.gz',import.meta.url))))
const originals=new Map(fixture.entities.map(row=>[row.receipt.url,row]))
const current=new Map(deployment.responses.map(row=>[row.receipt.url,row]))
const body=(page,change)=>({...page,bodyBase64:Buffer.from(change(Buffer.from(page.bodyBase64,'base64').toString('utf8'))).toString('base64')})
const run=async(source,{legacy=false,change=(_url,page)=>page,configure=()=>{}}={})=>{
  const profile=structuredClone(DECLARED_JOB_FEED_PROFILES[source]);configure(profile)
  const requests=[],audits=[],visits=new Map()
  const fetchPage=async url=>{
    requests.push(url)
    const occurrence=(visits.get(url)||0)+1;visits.set(url,occurrence)
    const entity=(!legacy&&current.get(url))||originals.get(url)
    assert.ok(entity,'Offline deployment control forbids an unretained URL: '+url)
    const page={url,status:entity.receipt.status,headers:structuredClone(entity.receipt.headers),bodyBase64:entity.bodyBase64}
    return change(url,page,occurrence)
  }
  let jobs,error
  try{jobs=await createDeclaredJobFeedScraper(profile).run({fetchPage,onAudit:audit=>audits.push(audit),now:()=>fixture.capturedAt+'T15:30:00.000Z'})}catch(caught){error=caught}
  assert.equal(audits.length,1,'A terminal source audit is still required: '+error?.message)
  return{profile,requests,audit:audits[0],jobs,error}
}
const qualified=result=>{
  assert.ifError(result.error)
  assert.equal(result.audit.opening.publisherQualified,true,JSON.stringify(result.audit.opening.issues))
  assert.equal(result.audit.closing.publisherQualified,true,JSON.stringify(result.audit.closing.issues))
  const expected=fixture.oracle[result.profile.source].records
  assert.equal(result.audit.observations.length,expected.length)
  assert.equal(result.audit.observations.filter(row=>row.sourceCurrentNativePostingIdentityQualified&&row.jobDescription).length,expected.length)
  assert.equal(result.audit.sourceScopeComplete,false)
  assert.equal(result.audit.lifecycleCleanupAllowed,false)
  assert.equal(readInventoryEvidence(result.jobs).listingComplete,false)
  assert.equal(readInventoryEvidence(result.jobs).reportedTotal,null)
}
const held=result=>{
  assert.equal(result.audit.closing?.publisherQualified??false,false)
  assert.ok(!result.jobs||result.jobs.length===0)
  assert.ok(result.audit.observations.every(row=>!row.sourceCurrentNativePostingIdentityQualified))
}
for(const source of ['cymulate','plivo']){
  test(source+': exact current declaration qualifies publisher and preserves original observations',async()=>{
    const result=await run(source);qualified(result)
    assert.ok(result.requests.includes(deployment.sources[source].scriptURL))
  })
  test(source+': prior genuine reviewed deployment remains accepted',async()=>qualified(await run(source,{legacy:true})))
  test(source+': changed bytes at the reviewed deployment URL remain held',async()=>{
    const asset=deployment.sources[source].scriptURL
    held(await run(source,{change:(url,page)=>url===asset?body(page,text=>text+'\n/* synthetic changed entity */'):page}))
  })
  test(source+': unreviewed declared deployment is not fetched or qualified',async()=>{
    const declaration=deployment.sources[source],unknown=declaration.scriptSpecifier+'-unreviewed'
    const result=await run(source,{change:(url,page)=>url===DECLARED_JOB_FEED_PROFILES[source].primaryURL?body(page,text=>text.replaceAll(declaration.scriptSpecifier,unknown)):page})
    held(result);assert.ok(!result.requests.includes(declaration.scriptURL))
  })
}

const plivo=deployment.sources.plivo
const plivoHTML=change=>(url,page)=>url===DECLARED_JOB_FEED_PROFILES.plivo.primaryURL?body(page,change):page
test('Plivo: ambiguous matching Astro components are held',async()=>held(await run('plivo',{change:plivoHTML(html=>html+'<astro-island component-url="'+plivo.scriptSpecifier+'"></astro-island>')})))
test('Plivo: an inert template declaration cannot replace the real component',async()=>held(await run('plivo',{change:plivoHTML(html=>html.replaceAll(plivo.scriptSpecifier,'/_astro/unreviewed.js')+'<template><astro-island component-url="'+plivo.scriptSpecifier+'"></astro-island></template>')})))
test('Plivo: document base cannot change the reviewed component authority',async()=>held(await run('plivo',{change:plivoHTML(html=>html.replace('<head>','<head><base href="https://unreviewed.invalid/">'))})))
test('Plivo: a wrong final asset URL cannot supply provenance',async()=>held(await run('plivo',{change:(url,page)=>url===plivo.scriptURL?{...page,url:'https://unreviewed.invalid/asset.js'}:page})))
test('Plivo: missing original asset bytes remain held',async()=>held(await run('plivo',{change:(url,page)=>url===plivo.scriptURL?{...page,bodyBase64:undefined}:page})))
test('Plivo: duplicate reviewed deployment configuration is held',async()=>held(await run('plivo',{configure:profile=>{profile.declaration.reviewedAlternates=[plivo,plivo]}})))
test('Plivo: a relative configured asset URL is held',async()=>held(await run('plivo',{configure:profile=>{profile.declaration.reviewedAlternates=[{...plivo,scriptURL:plivo.scriptSpecifier}]}})))
test('Plivo: more than three reviewed alternate deployments is held',async()=>held(await run('plivo',{configure:profile=>{profile.declaration.reviewedAlternates=[plivo,plivo,plivo,plivo]}})))
test('Plivo: a closing declaration change revokes current posting identity',async()=>held(await run('plivo',{change:(url,page,visit)=>url===DECLARED_JOB_FEED_PROFILES.plivo.primaryURL&&visit===2?body(page,html=>html.replaceAll(plivo.scriptSpecifier,'/_astro/unreviewed.js')):page})))

const cymulate=deployment.sources.cymulate
const cymulateHTML=change=>(url,page)=>url===DECLARED_JOB_FEED_PROFILES.cymulate.primaryURL?body(page,change):page
test('Cymulate: duplicate active reviewed declarations remain held',async()=>held(await run('cymulate',{change:cymulateHTML(html=>html+'<script src="'+cymulate.scriptSpecifier+'"></script>')})))
test('Cymulate: invalid authored integrity cannot qualify pinned bytes',async()=>held(await run('cymulate',{change:cymulateHTML(html=>html.replace('id="careers-search-script-js"','id="careers-search-script-js" integrity="sha512-invalid"'))})))
test('Cymulate: an inert template script does not qualify the publisher',async()=>held(await run('cymulate',{change:cymulateHTML(html=>html.replaceAll(cymulate.scriptSpecifier,cymulate.scriptSpecifier+'-unreviewed')+'<template><script src="'+cymulate.scriptSpecifier+'"></script></template>')})))

// Synthetic namespace boundaries on retained HTML; never public source facts.
const reviewedIsland='<astro-island component-url="'+plivo.scriptSpecifier+'" client="load"></astro-island>'
const replacePlivoComponent=markup=>plivoHTML(html=>html.replaceAll(plivo.scriptSpecifier,'/_astro/unreviewed.js')+markup)
test('Plivo: an SVG namesake cannot supply an HTML Astro declaration',async()=>held(await run('plivo',{change:replacePlivoComponent('<svg>'+reviewedIsland+'</svg>')})))
test('Plivo: a MathML namesake cannot supply an HTML Astro declaration',async()=>held(await run('plivo',{change:replacePlivoComponent('<math>'+reviewedIsland+'</math>')})))
test('Plivo: foreign namesakes do not make a real HTML component ambiguous',async()=>qualified(await run('plivo',{change:plivoHTML(html=>html+'<svg>'+reviewedIsland+'</svg><math>'+reviewedIsland+'</math>')})))
test('Plivo: SVG foreignObject preserves a genuine HTML component',async()=>qualified(await run('plivo',{change:replacePlivoComponent('<svg><foreignObject>'+reviewedIsland+'</foreignObject></svg>')})))
test('Plivo: MathML HTML annotation integration preserves a genuine component',async()=>qualified(await run('plivo',{change:replacePlivoComponent('<math><annotation-xml encoding="text/html">'+reviewedIsland+'</annotation-xml></math>')})))
test('Plivo: MathML text integration preserves a genuine HTML component',async()=>qualified(await run('plivo',{change:replacePlivoComponent('<math><mtext>'+reviewedIsland+'</mtext></math>')})))
