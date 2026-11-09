import {parseExpressionAt} from 'acorn'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {nativeCountryName,nativeLocationCountryName} from '../../scraper-support/shared/nativeJobPosting.js'
const check=(ok,message)=>{if(!ok)throw Object.assign(Error('Sedin native roles: '+message),{abortRetries:true})}
const norm=value=>String(value??'').replace(/\s+/g,' ').trim()
const within=(node,p)=>node.inert?[]:[...(p(node)?[node]:[]),...node.children.filter(n=>typeof n!=='string').flatMap(n=>within(n,p))]
const one=(items,label)=>{check(items.length===1,'missing/ambiguous '+label);return items[0]}
export const visibleLegacyMarkup=html=>{
 const doc=readVisibleNativeDocument(html,{strict:true}),escape=value=>String(value).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;')
 const render=n=>typeof n==='string'?n:n.inert||['script','style','title'].includes(n.tag)?'':n.tag==='root'?n.children.map(render).join(''):'<'+n.tag+Object.entries(n.attrs).map(([k,v])=>' '+k+'="'+escape(v)+'"').join('')+'>'+n.children.map(render).join('')+'</'+n.tag+'>'
 return doc.nodes(n=>n.tag==='root').map(render).join('')
}
const revive=(value,depth=0)=>{
 check(depth<20,'oversized Astro value')
 if(Array.isArray(value)){
  check(value.length===2&&[0,1].includes(value[0]),'unsupported Astro carrier')
  if(value[0]===1){check(Array.isArray(value[1]),'invalid Astro list');return value[1].map(v=>revive(v,depth+1))}
  return value[1]&&typeof value[1]==='object'?Object.fromEntries(Object.entries(value[1]).map(([k,v])=>[k,revive(v,depth+1)])):value[1]
 }
 check(false,'unwrapped Astro value')
}
const readJSON=raw=>{
 let value,ast;try{value=JSON.parse(raw);ast=parseExpressionAt(raw,0,{ecmaVersion:'latest'})}catch{check(false,'malformed native Astro JSON')}
 const walk=node=>{if(!node||typeof node!=='object')return;if(node.type==='ObjectExpression'){const keys=node.properties.map(p=>p.key?.value??p.key?.name);check(new Set(keys).size===keys.length,'duplicate Astro JSON key')}for(const v of Object.values(node))if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')walk(v)}
 walk(ast);return value
}
const date=value=>/^\d{4}-\d\d-\d\d$/.test(value||'')&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value?value:null
const visibleDate=value=>{const m=norm(value).match(/^Posted\s+(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sept?|Oct|Nov|Dec)\s+(\d{4})$/i);if(!m)return null;const month=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(m[2].toLowerCase().slice(0,3))+1;return date(m[3]+'-'+String(month).padStart(2,'0')+'-'+m[1].padStart(2,'0'))}
export const readSedinAstroRoles=html=>{
 const doc=readVisibleNativeDocument(html,{strict:true}),islands=doc.nodes(n=>n.tag==='astro-island'&&n.attrs['component-url']?.match(/^\/_astro\/JobListingATS\.[\w-]+\.js$/))
 if(!islands.length){check(!/JobListingATS\.[\w-]+\.js/.test(html),'inactive/hidden/unbound role island');return null}
 const island=one(islands,'active role Astro island');check(island.attrs['component-export']==='default','unexpected role island export')
 const props=readJSON(island.attrs.props||''),jobs=revive(props.jobs)
 check(Array.isArray(jobs)&&jobs.length>0&&jobs.length<1000&&Object.keys(props).length===1,'invalid/unreviewed Astro role collection')
 const cards=within(island,n=>doc.hasClass(n,'swiper-slide')&&doc.hasClass(n,'h-auto'))
 check(cards.length===jobs.length,'literal and visible inventories disagree')
 const byId=new Map()
 for(const job of jobs){check(/^\d+$/.test(job.id)&&/^ZR_\d+_JOB$/.test(job.job_id)&&!byId.has(job.id),'duplicate/missing role identity');byId.set(job.id,job)}
 const seen=new Set(),result=[]
 for(const card of cards){
  const title=doc.text(one(within(card,n=>n.tag==='h3'),'rendered role title')),anchor=one(within(card,n=>n.tag==='a'&&doc.text(n)==='Apply Now'),'advertised role application')
  const url=new URL(anchor.attrs.href),match=url.pathname.match(/^\/jobs\/Careers\/(\d+)\/[^/]+$/)
  check(url.origin==='https://sedintechnologies.zohorecruit.in'&&match&&!seen.has(match[1]),'foreign/duplicate/unbound advertised role URL')
  const job=byId.get(match[1]);check(job&&title===job.title&&job.posting_title===job.title,'visible/literal role identity contradiction');seen.add(job.id)
  check(['In-progress','On-Hold'].includes(job.status),'closed/unreviewed native role status')
  const locationNode=one(within(card,n=>n.tag==='div'&&doc.hasClass(n,'items-center')&&doc.hasClass(n,'mb-5')),'role workplace container')
  const visibleLocation=doc.text(one(within(locationNode,n=>n.tag==='span'),'role workplace label'))
  const descriptionNode=one(within(card,n=>n.tag==='p'&&doc.hasClass(n,'line-clamp-3')),'rendered description summary')
  const prefix=doc.text(descriptionNode).replace(/\s*\.{3}\s*$/,'')
  check(typeof job.description==='string'&&norm(job.description).length>150&&norm(job.description).startsWith(prefix),'description summary/literal contradiction')
  const posted=one(within(card,n=>n.tag==='span'&&/^Posted\b/.test(doc.text(n))),'native posting label')
  check(date(job.date_opened)&&visibleDate(doc.text(posted))===job.date_opened,'native publication date contradiction')
  const country=nativeCountryName(job.country),visibleCountry=nativeLocationCountryName(visibleLocation)
  check(Array.isArray(job.location)&&job.location.every(v=>typeof v==='string'),'invalid native location scopes')
  const scopeCountries=job.location.map(v=>nativeCountryName(v.split(' - ')[0])).filter(Boolean)
  const countries=[country,visibleCountry,...scopeCountries].filter(Boolean)
  check(!countries.length||new Set(countries).size===1,'native country/location contradiction')
  result.push({title,department:job.department||null,location:visibleLocation||null,city:job.city||null,state:job.state||null,country:country||visibleCountry||null,jobId:job.id,requisitionId:job.job_id,sourceUrl:url.href,applyUrl:url.href,employmentType:job.type||null,workplaceType:job.is_remote===true?'Remote':job.is_remote===false?'On-site':null,experienceRequired:job.experience||null,minimumQualification:null,preferredQualification:null,requiredSkills:job.skills?job.skills.split(',').map(norm).filter(Boolean):[],postingDate:job.date_opened,closingDate:null,jobDescription:norm(job.description),nativeActiveStateQualified:job.status==='In-progress',rawNativeJob:job,rawNativeLocationEvidence:{visibleLabel:visibleLocation,city:job.city,state:job.state,country:job.country,locationScopes:job.location,countryStatementsAgree:true,withinCountryScopeAgreementQualified:false},rawNativeRoleEvidence:{identityQualified:true,nativeStatus:job.status,applicationSubmissionQualified:false}})
 }
 check(seen.size===byId.size,'unrendered native role');return result
}
