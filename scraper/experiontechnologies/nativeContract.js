import crypto from 'node:crypto'
import {extractOfficialRecruitmentLinks} from '../../scripts/officialRecruitmentLinks.js'
import {readNativeDocument,extractActiveDescription} from './nativeHtml.js'
export const HOME='https://experionglobal.com/',CAREERS=HOME+'job-openings/',CLIENT=HOME+'wp-content/themes/experionglobal/assets/js/main.js'
const CLIENT_SHA256='13cf789724576f392864597318b5528abc19f9b679082bc95a70458adddd52e3'
const CURRENT_CLIENT_SHA256='eb0c41212ad8da6040f05b63b9e3e4b57eb0f74ad13adf9e5c12b1d120fe7779'
const check=(ok,message)=>{if(!ok)throw new Error('Experion native contract: '+message)}
const norm=x=>typeof x==='string'?x.replace(/\s+/g,' ').trim():''
const only=(rows,label)=>{check(rows.length===1,'Expected one '+label);return rows[0]}
const descendants=(node,predicate)=>[...(predicate(node)?[node]:[]),...(node.children||[]).filter(x=>typeof x!=='string'&&!x.inert).flatMap(x=>descendants(x,predicate))]
function location(value){
 check(typeof value==='string','Native location unavailable')
 const parts=value.split(',').map(norm);check(parts.length>0&&parts.every(Boolean),'Native location malformed')
 const cities=parts.filter(p=>!['Hybrid','Remote','India'].includes(p))
 check(cities.length>0&&cities.every(p=>['Kochi','Trivandrum','Bangalore','Chennai'].includes(p)),'Unknown or conflicting native office scope')
 check(new Set(parts).size===parts.length,'Duplicate native office scope')
 return{nativeLocation:value,location:parts.includes('India')?parts.join(', '):parts.join(', ')+', India',locations:cities.map(c=>c+', India'),city:cities[0],country:'India',nativeRemoteScopeUnknown:parts.includes('Remote'),remoteStatus:parts.includes('Remote')?'Remote':parts.includes('Hybrid')?'Hybrid':'On-site'}
}
function roleURL(value){check(typeof value==='string','Native role URL unavailable');const u=new URL(value);check(u.origin===HOME.slice(0,-1)&&/^\/jobs\/[a-z\d-]+\/$/.test(u.pathname)&&!u.search&&!u.hash&&!u.username&&!u.password,'Native role URL identity mismatch');return u.href}
export function verifyExperionInventory(homepage,html,client){
 check(extractOfficialRecruitmentLinks(homepage,HOME).some(l=>l.href===CAREERS),'Current official corporate handoff unavailable')
 const doc=readNativeDocument(html)
 check(doc.nodes(n=>n.tag==='script'&&n.attrs.src===CLIENT&&[undefined,'','text/javascript','application/javascript'].includes(n.attrs.type)).length===1,'Current native pagination client unavailable')
 check(typeof client==='string'&&[CLIENT_SHA256,CURRENT_CLIENT_SHA256].includes(crypto.createHash('sha256').update(client).digest('hex')),'Native pagination client contract changed')
 const container=only(doc.nodes(n=>doc.hasClass(n,'career-jobs-container')),'native jobs container')
 const cards=descendants(container,n=>doc.hasClass(n,'career-job-row'))
 check(cards.length>0&&cards.length<=150,'Native inventory absent or exceeds bounded scope')
 const jobs=cards.map(card=>{
  check(card.tag==='a','Native role anchor changed')
  const url=roleURL(card.attrs.href),title=doc.text(only(descendants(card,n=>doc.hasClass(n,'career-job-title')),'native role title'))
  check(title.length>2,'Native title unavailable')
  const meta=descendants(card,n=>doc.hasClass(n,'meta-item')).map(doc.text)
  check(meta.length===3&&norm(card.attrs['data-loc'])===meta[2]&&norm(card.attrs['data-exp'])===meta[0],'Native listing metadata disagrees')
  return{title,company:'Experion Technologies',source:'experiontechnologies',jobId:new URL(url).pathname.split('/')[2],requisitionId:new URL(url).pathname.split('/')[2],sourceUrl:url,applyUrl:url,link:url,employmentType:meta[1],experienceRequired:meta[0],...location(meta[2])}
 })
 check(new Set(jobs.map(j=>j.jobId)).size===jobs.length,'Duplicate native role ID')
 return jobs
}
function publication(value,now){
 check(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\+00:00|Z)$/.test(value),'Native publication unavailable')
 const date=new Date(value);check(Number.isFinite(date.getTime())&&date.toISOString().slice(0,19)===value.slice(0,19),'Invalid native publication calendar')
 check(date.getTime()<=Date.parse(now),'Future native publication');return date.toISOString()
}
export function validateExperionDetail(html,listing,{now=new Date().toISOString()}={}){
 const url=roleURL(listing.sourceUrl),doc=readNativeDocument(html)
 const title=doc.text(only(doc.nodes(n=>doc.hasClass(n,'job-title')),'native detail title'))
 check(title===listing.title,'Native title disagreement')
 const place=doc.text(only(doc.nodes(n=>doc.hasClass(n,'meta-item')&&doc.hasClass(n,'location')),'native detail location'))
 check(place.startsWith('Job Location:'),'Native detail location field changed')
 const nativeLocation=place.slice('Job Location:'.length).trim();location(nativeLocation)
 check(nativeLocation===listing.nativeLocation,'Native listing/detail location disagreement')
 const graphs=doc.nodes(n=>n.tag==='script'&&!n.attrs.src&&n.attrs.type==='application/ld+json').flatMap(n=>{let v;try{v=JSON.parse(n.raw)}catch{throw new Error('Experion native contract: Malformed native JSON-LD')}return Array.isArray(v['@graph'])?v['@graph']:[]})
 const page=only(graphs.filter(n=>n['@type']==='WebPage'),'native WebPage identity'),organization=only(graphs.filter(n=>n['@type']==='Organization'),'native organization')
 const titleText=value=>norm(value).replace(/[\u2013\u2014]/g,'-')
 check(page.url===url&&page['@id']===url&&titleText(page.name)===titleText(title+' - Experion Technologies'),'Native schema URL/title conflict')
 check(organization.name==='Experion Technologies'&&organization.url===HOME,'Native employer identity conflict')
 check(!graphs.some(n=>n['@type']==='JobPosting')&&!Object.hasOwn(page,'validThrough'),'New native expiry contract requires review')
 const postedAt=publication(page.datePublished,now)
 const form=only(doc.nodes(n=>n.tag==='form'&&doc.hasClass(n,'wpcf7-form')),'native role apply form')
 check(form.attrs.method?.toLowerCase()==='post','Native application form method changed')
 const action=new URL(form.attrs.action,url)
 check(action.origin===HOME.slice(0,-1)&&action.pathname===new URL(url).pathname&&!action.search&&/^#wpcf7-f\d+-o\d+$/.test(action.hash),'Native application identity conflict')
 const sections=doc.nodes(n=>doc.hasClass(n,'job-description'));check(sections.length<=1,'Duplicate native full JD')
 const description=sections.length?extractActiveDescription(doc.text(sections[0])):null
 return{...listing,postedAt,postingDate:postedAt,nativePagePublishedAt:page.datePublished,closingDate:null,jobDescription:description,sourceDescription:description,sourceDetailComplete:Boolean(description),sourceDetailStatus:description?'complete':'native-full-description-missing',sourceListingComplete:false,scrapedAt:now}
}
