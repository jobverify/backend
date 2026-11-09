import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {createMetricStreamScraper,hasOfficialHomepageSignal,HOMEPAGE_URL,CAREERS_PAGE_URL} from './script.js'
import {readNativeDocument,decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'

// Private external real response fixture: do not copy into source/test-data or
// export it in a test report. This exercises only the first homepage gate.
const fixtureURL=new URL('../../../artifacts/scraper-all-repair-2026-11-06/metricstream-current-homepage-probe-20261108/local-only/response-1.body',import.meta.url)
const privateFixtureAvailable=fs.existsSync(fixtureURL)
const privateFixtureSkip=privateFixtureAvailable?false:'private genuine homepage capture is not shipped with source'
const fixtureBytes=privateFixtureAvailable?fs.readFileSync(fixtureURL):Buffer.alloc(0),sha=s=>createHash('sha256').update(s).digest('hex')
if(privateFixtureAvailable){
 assert.equal(fixtureBytes.length,271908,'exact authorized public homepage bytes')
 assert.equal(sha(fixtureBytes),'3f9ad502fe4fa5cd241820b8b7e8362dec05ae5fa487335eb78969c9b470d541','exact authorized public homepage digest')
}
const homepage=new TextDecoder().decode(fixtureBytes)
const HOME='https://www.metricstream.com/',CAREERS='https://www.metricstream.com/about-us/careers.htm'
assert.equal(HOMEPAGE_URL,HOME)
assert.equal(CAREERS_PAGE_URL,CAREERS)
const homepageGuardSHA256='5d505acb918db582f3db99b3c502bc295f0ccb7424d7d26ce53d2731ed51e023'
const visibleText=html=>{const d=readVisibleNativeDocument(html,{strict:true});return d.text(d.nodes(n=>n.tag==='root')[0])}
const activeOwnCareers=html=>{
 const d=readVisibleNativeDocument(html,{strict:true})
 return d.nodes(n=>n.tag==='a'&&typeof n.attrs.href==='string'&&/\bcareers?\b/i.test(d.text(n))).some(n=>{
  try{return new URL(n.attrs.href,HOME).href===CAREERS}catch{return false}
 })
}
const publicFactoryRead=async html=>{
 const calls=[],sentinel=Object.freeze(Object.create(null)),unexpected=Object.freeze(Object.create(null))
 const fetchText=async url=>{
  if(url===HOME&&calls.length===0){calls.push(HOME);return html}
  if(url===CAREERS&&calls.length===1){calls.push(CAREERS);throw sentinel}
  throw unexpected
 }
 const scraper=createMetricStreamScraper({fetchText,fetchLinkedInText:async()=>{throw unexpected},getSearchPages:async()=>{throw unexpected}})
 let thrown
 try{await scraper.run()}catch(error){thrown=error}
 return{calls,sentinel,unexpected,thrown}
}

test('actual pinned current homepage passes the public homepage predicate with its visible own careers binding',{skip:privateFixtureSkip},()=>{
 assert.ok(/\bMetricStream\b/i.test(visibleText(homepage)),'genuine visible employer brand is present')
 assert.equal(activeOwnCareers(homepage),true,'genuine visible active exact configured careers anchor is present')
 assert.equal(hasOfficialHomepageSignal(homepage),true,'reviewed current homepage profile must be recognized')
})

test('normal public MetricStream factory advances from exact current homepage to exact declared careers opaque sentinel only',{skip:privateFixtureSkip},async()=>{
 const result=await publicFactoryRead(homepage)
 assert.ok(result.thrown===result.sentinel,'the exact opaque declared-careers sentinel must survive; homepage failure is RED')
 assert.deepEqual(result.calls,[HOME,CAREERS],'only two exact same-employer URL reads are allowed; no career parse, native/job read or jobs claimed')
})

const mutations=[
 ['unknown current title',html=>{
  const d=readNativeDocument(html),titles=d.nodes(n=>n.tag==='title')
  assert.equal(titles.length,1,'one genuine active title for the mutation')
  const changed=html.replace(/(<title\b[^>]*>)([\s\S]*?)(<\/title\s*>)/gi,(all,open,raw,close)=>raw===titles[0].raw?open+'Unreviewed Future Marketing Profile | MetricStream'+close:all)
  assert.ok(changed!==html,'unknown-title mutation affects the genuine active title')
  assert.equal(readNativeDocument(changed).nodes(n=>n.tag==='title'&&n.raw===titles[0].raw).length,0,'the actual active head title is changed, not just another repeated string')
  assert.ok(/\bMetricStream\b/i.test(visibleText(changed))&&activeOwnCareers(changed),'other current employer and careers evidence is retained')
  return changed
 }],
 ['hidden visible employer brand while title and active own careers remain',html=>{
  let inBody=false,changes=0
  const changed=html.replace(/<!--[\s\S]*?-->|<(script|style|title|textarea|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>|<[^>]+>|[^<]+/gi,part=>{
   if(/^<body\b/i.test(part))inBody=true
   if(/^<\/body\b/i.test(part))inBody=false
   if(!inBody||part.startsWith('<'))return part
   return part.replace(/\bMetricStream\b/gi,text=>{changes++;return '<span hidden>'+text+'</span>'})
  })
  assert.ok(changes>0&&changed!==html,'genuine body brand text is hidden, not a fixture substitute')
  assert.equal(/\bMetricStream\b/i.test(visibleText(changed)),false,'no visible employer brand remains')
  assert.equal(activeOwnCareers(changed),true,'exact active careers authority remains otherwise intact')
  return changed
 }],
 ['foreign replacement for every actual own careers anchor',html=>{
  let changes=0
  const changed=html.replace(/(<a\b[^>]*\bhref\s*=\s*)(["'])([^"']*)\2/gi,(all,prefix,quote,value)=>{
   let url
   try{url=new URL(decodeNativeEntities(value),HOME)}catch{return all}
   if(url.href!==CAREERS)return all
   changes++;return prefix+quote+'https://unreviewed.example/careers'+quote
  })
  assert.ok(changes>0&&changed!==html,'mutation affects genuine own careers anchors')
  assert.equal(activeOwnCareers(changed),false,'no current visible exact own careers anchor survives')
  assert.ok(/\bMetricStream\b/i.test(visibleText(changed)),'visible employer brand remains')
  return changed
 }],
 ['visible verification challenge despite preserved current title brand and own careers',html=>{
  const changed=html.replace(/(<body\b[^>]*>)/i,'$1<section id="challenge-running">Verify you are human to continue</section>')
  assert.ok(changed!==html,'challenge mutation affects genuine document body')
  assert.ok(/verify you are human to continue/i.test(visibleText(changed)),'challenge is active visible text')
  assert.ok(/\bMetricStream\b/i.test(visibleText(changed))&&activeOwnCareers(changed),'other current profile signals are deliberately preserved')
  return changed
 }],
]
for(const[name,mutate]of mutations)test('current homepage profile rejects '+name+' before any careers read',{skip:privateFixtureSkip},async()=>{
 const changed=mutate(homepage)
 assert.equal(hasOfficialHomepageSignal(changed),false,'negative current profile remains unrecognized')
 const result=await publicFactoryRead(changed)
 assert.ok(result.thrown!==result.sentinel&&result.thrown!==result.unexpected&&result.thrown instanceof Error,'strict public homepage guard must reject before any further route')
 assert.equal(sha(result.thrown.message),homepageGuardSHA256,'the existing fixed first-homepage guard is preserved')
 assert.deepEqual(result.calls,[HOME],'negative profile cannot advance to careers, ATS, LinkedIn or application')
})


// Synthetic current-profile authority controls. These do not exercise the
// intentionally preserved historical homepage conjunction or claim browser use.
const currentAuthorityFixture='<html><head><title>GRC That Thinks, Advises &amp; Acts | MetricStream</title></head><body><p>MetricStream</p><nav><a href="https://www.metricstream.com/about-us/careers.htm">Careers</a></nav></body></html>'
const currentAuthorityOverride="event.preventDefault();location.href='https://unreviewed.example/careers'"
const currentAuthorityVariants=[
 ['conflicting duplicate base href',()=>currentAuthorityFixture.replace('</head>','<base href="https://www.metricstream.com/" href="https://unreviewed.example/"></head>')],
 ['conflicting duplicate careers anchor href',()=>currentAuthorityFixture.replace('href="https://www.metricstream.com/about-us/careers.htm"','href="https://www.metricstream.com/about-us/careers.htm" HREF="https://unreviewed.example/careers"')],
 // A sole direct-onclick link is already filtered. This regression requires
 // rejecting an overriding current careers link even when an ordinary sibling
 // points to the same destination and would otherwise hide it during dedup.
 ['direct onclick override beside ordinary same-authority sibling',()=>currentAuthorityFixture.replace('</nav>','<a href="https://www.metricstream.com/about-us/careers.htm" onclick="'+currentAuthorityOverride+'">Careers</a></nav>')],
 ['direct pointer event override',()=>currentAuthorityFixture.replace('<a href=','<a onpointerdown="'+currentAuthorityOverride+'" href=')],
 ['ancestor event override',()=>currentAuthorityFixture.replace('<nav>','<nav onclick="'+currentAuthorityOverride+'">')],
 ['descendant event override',()=>currentAuthorityFixture.replace('>Careers</a>','><span onclick="'+currentAuthorityOverride+'">Careers</span></a>')],
 ['genuine retained homepage body event override',()=>{
  const changed=homepage.replace(/(<body\b[^>]*)(>)/i,'$1 onclick="'+currentAuthorityOverride+'"$2')
  assert.notEqual(changed,homepage,'the actual retained body opening changes')
  return changed
 },true],
]
for(const[name,make,needsPrivate]of currentAuthorityVariants)test('current profile permanent authority refusal: '+name,{skip:needsPrivate?privateFixtureSkip:false},async()=>{
 const changed=make()
 assert.ok(changed.includes(currentAuthorityOverride)||name.startsWith('conflicting duplicate'),'the selected authority contradiction is present as authored data')
 const result=await publicFactoryRead(changed)
 // Assert transport refusal first: every new regression reaches the real public
 // factory and preserves its exact existing configured-careers opaque sentinel.
 assert.deepEqual(result.calls,[HOME],'ambiguous current authority must stop before any careers read')
 assert.ok(result.thrown!==result.sentinel&&result.thrown!==result.unexpected&&result.thrown instanceof Error,'the fixed homepage guard must reject instead of reaching another route')
 assert.equal(sha(result.thrown.message),homepageGuardSHA256,'the original fixed homepage refusal is retained')
 assert.equal(hasOfficialHomepageSignal(changed),false,'the new current profile remains unqualified')
})
