import {createHash} from 'node:crypto'
import {readNativeDocument,extractActiveDescription,decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {nativeCountryName} from '../../scraper-support/shared/nativeJobPosting.js'
import {parseNativeJSON} from '../aecom.workday/nativeJSON.js'
const sha=value=>createHash('sha256').update(value).digest('hex')
const norm=value=>decodeNativeEntities(String(value??'')).replace(/\s+/g,' ').trim()
const need=(ok,message)=>{if(!ok)throw Object.assign(Error('Air India native detail: '+message),{code:'AIRINDIA_DETAIL_CONTRACT'})}
const one=(nodes,label)=>{need(nodes.length===1,'missing or ambiguous '+label);return nodes[0]}
const nodes=(root,predicate)=>[...(predicate(root)?[root]:[]),...root.children.filter(c=>typeof c!=='string').flatMap(c=>nodes(c,predicate))]
const plain=node=>typeof node==='string'?node:['script','style'].includes(node.tag)?'':node.children.map(plain).join(' ')
const official=value=>{try{const u=new URL(value);return u.origin==='https://careers.airindia.com'&&!u.username&&!u.password&&!u.search&&!u.hash&&/^\/job\/[^/]+\/[1-9]\d*\/$/.test(u.pathname)?u.href:null}catch{return null}}
const ANTI_STYLE='<style id="antiClickjack" type="text/css">body{display:none !important;}</style>'
const ANTI_SHA='4a1ab69ed7fa61e5385ca970bf06b3e1afafc49efaeace8ec022766e16e72433'
function renderedTopLevel(html,document){
 if(!html.includes(ANTI_STYLE))return html
 const scripts=document.nodes(n=>n.tag==='script'&&n.attrs.id==='antiClickJackScript')
 need(html.split(ANTI_STYLE).length===2&&scripts.length===1&&JSON.stringify(scripts[0].attrs)===JSON.stringify({type:'text/javascript',id:'antiClickJackScript'})&&sha(scripts[0].raw)===ANTI_SHA,'unreviewed anti-framing declaration')
 // Interpret this exact reviewed RMK top-level declaration as data. Publisher
 // programs never execute; every other native visibility rule remains active.
 return html.replace(ANTI_STYLE,'<style id="antiClickjack" type="text/css"></style>')
}
const postingScope=n=>n.tag==='div'&&(n.attrs.class||'').split(/\s+/).includes('jobDisplayShell')&&/^https?:\/\/schema\.org\/JobPosting$/.test(n.attrs.itemtype||'')&&Object.hasOwn(n.attrs,'itemscope')
const explicitCountry=value=>typeof value==='string'&&(value.trim().length>2||/^[A-Z]{2}$/.test(value.trim()))?nativeCountryName(value):null
function schemaPostings(document){
 const records=[]
 const walk=(v,depth=0)=>{need(depth<=8,'structured model depth exceeded');if(Array.isArray(v)){v.forEach(c=>walk(c,depth+1));return}if(!v||typeof v!=='object')return;const type=[v['@type']].flat();if(type.some(t=>t==='JobPosting'||/^https?:\/\/schema\.org\/JobPosting$/.test(t)))records.push(v);if(v['@graph'])walk(v['@graph'],depth+1)}
 for(const script of document.nodes(n=>n.tag==='script'&&!n.attrs.src&&(n.attrs.type||'').toLowerCase()==='application/ld+json'))walk(parseNativeJSON(script.raw))
 return records
}
export function readAirIndiaDetail(job,html){
 need(typeof html==='string'&&Buffer.byteLength(html)<=4*1024*1024,'invalid bounded HTML')
 const url=official(job.sourceUrl);need(url,'unsafe listed role URL')
 const document=readNativeDocument(html);need(!document.nodes(n=>n.tag==='base').length,'unexpected document base')
 const canonical=one(document.nodes(n=>n.tag==='link'&&(n.attrs.rel||'').split(/\s+/).includes('canonical')),'canonical').attrs.href
 need(official(canonical)===url,'canonical role identity mismatch')
 const scope=one(document.nodes(postingScope),'native JobPosting'),visible=readVisibleNativeDocument(renderedTopLevel(html,document),{strict:true}),visibleScope=one(visible.nodes(postingScope),'visible JobPosting')
 const own=key=>nodes(scope,n=>n.attrs['data-careersite-propertyid']===key),shown=key=>nodes(visibleScope,n=>!n.inert&&n.attrs['data-careersite-propertyid']===key)
 need(norm(document.text(one(own('title'),'native title')))===norm(job.title)&&norm(visible.text(one(shown('title'),'visible title')))===norm(job.title),'listing/native title mismatch')
 const city=norm(visible.text(one(shown('city'),'native city')))
 need(city&&city===norm(job.nativeLocation).split(',')[0].trim(),'listing/native city mismatch')
 const applications=nodes(scope,n=>n.tag==='a'&&(n.attrs.class||'').split(/\s+/).includes('apply')).map(n=>new URL(n.attrs.href,url).href)
 need(applications.length>0&&applications.every(v=>v===`https://careers.airindia.com/talentcommunity/apply/${job.jobId}/?locale=en_US`),'native application role mismatch')
 const requisitions=document.nodes(n=>n.tag==='script'&&!n.attrs.src).flatMap(n=>[...(n.raw||'').matchAll(/"internalId"\s*:\s*"([1-9]\d*)-en_US"/g)].map(m=>m[1]))
 need(requisitions.length===1&&requisitions[0]===job.requisitionId,'native requisition identity mismatch')
 const descriptor=one(own('description'),'native description'),rendered=one(shown('description'),'visible description')
 const text=norm(plain(descriptor)),visibleText=norm(visible.text(rendered))
 need(text===visibleText,'hidden or incomplete native criteria')
 const content=extractActiveDescription(visibleText),description=content&&content.length>=100?content:null
 const schemas=schemaPostings(document)
 need(schemas.length<=1,'ambiguous structured role models')
 for(const model of schemas){
  need(norm(model.title)===norm(job.title)&&official(model.url)===url,'structured role identity mismatch')
  const id=model.identifier?.value??(typeof model.identifier==='string'?model.identifier:null)
  need(id==null||String(id)===job.jobId||/requisition/i.test(model.identifier?.name||'')&&String(id)===job.requisitionId,'structured role identifier mismatch')
  need(['Air India','Air India Careers'].includes(model.hiringOrganization?.name),'structured employer mismatch')
  if(model.description!=null)need(norm(extractActiveDescription(model.description))===visibleText,'structured/native description mismatch')
 }
 const organizations=nodes(scope,n=>n.attrs.itemprop==='hiringOrganization').map(n=>norm(n.attrs.content??document.text(n)))
 need(organizations.length===1,'missing or ambiguous native employer')
 const declared=description?.match(/\bThis opportunity is with (Air India(?: Express)?)\./i)?.[1]??null
 // The generic careers publisher can accompany an explicit employing airline.
 // Two explicit employer carriers must agree before exact-company qualification.
 const employerConflict=declared!==null&&organizations[0]!=='Air India Careers'&&declared!==organizations[0]
 const employer=employerConflict?organizations[0]:declared??organizations[0],employerComplete=!employerConflict&&['Air India','Air India Careers'].includes(employer)
 const countries=nodes(scope,n=>n.attrs.itemprop==='addressCountry').map(n=>norm(n.attrs.content??document.text(n)))
 for(const model of schemas)for(const place of [model.jobLocation].flat().filter(Boolean))if(place.address?.addressCountry!=null)countries.push(place.address.addressCountry)
 const nativeLocation=description?.match(/\bLocation\s*:\s*PAN\s+India\b/i)?.[0]??null
 const declaredCountries=[...countries.map(explicitCountry).filter(Boolean),...(nativeLocation?['India']:[]),...(job.nativeListingCountry?[job.nativeListingCountry]:[])]
 const unique=[...new Set(declaredCountries)],invalidCountry=countries.some(c=>!explicitCountry(c)),country=!invalidCountry&&unique.length===1?unique[0]:null
 const gaps=[]
 if(!country)gaps.push(unique.length>1?'native-country-conflict':'native-country-unresolved')
 if(country&&country!=='India')gaps.push('native-country-outside-configured-India')
 if(employerConflict)gaps.push('native-employer-conflict')
 if(!employerComplete)gaps.push('native-employer-outside-configured-Air-India')
 if(!description)gaps.push('missing-content')
 return{sourceDescription:description,jobDescription:description,sourceDetailComplete:Boolean(description),...(description?{}:{sourceDetailFailureKind:'missing-content'}),
  country,sourceCountryComplete:country!==null,nativeCountryRaw:countries[0]??null,nativeCountryValues:countries,
  nativeEmployer:employer,nativeDescriptionEmployer:declared,sourceEmployerConflict:employerConflict,company:employerComplete?'Air India':employer,sourceEmployerComplete:employerComplete,
  sourceWorksiteCountryProof:country?{method:nativeLocation?'explicit-native-role-location':'explicit-native-country',literal:nativeLocation??countries[0]??job.nativeLocation,country}:null,
  sourceScopeComplete:false,lifecycleCleanupAllowed:false,sourceScopeGaps:gaps,publicExperienceChecked:Boolean(description),
  sourceNativeDetail:{url,canonicalURL:canonical,jobId:job.jobId,requisitionId:requisitions[0],nativeTitle:job.title,nativeLocation:city,nativeEmployer:organizations[0],
   originalHTML:html,bodySHA256:sha(html),nativeDescriptionText:text,nativeJobPostings:schemas,publisherProgramsExecuted:false,applicationsVisited:false}}
}
