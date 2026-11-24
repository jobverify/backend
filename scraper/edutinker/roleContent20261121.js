import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {readLiteralModel} from '../../scraper-support/native-sources/literalModel.js'
import {nativeCountryName,nativeLocationCountryName} from '../../scraper-support/shared/nativeJobPosting.js'

const norm=value=>typeof value==='string'?value.replace(/\s+/g,' ').trim():''
const need=(ok,message)=>{if(!ok)throw Object.assign(new Error('Edutinker role: '+message),{abortRetries:true})}
const one=(values,label)=>{need(values.length===1,'missing/ambiguous '+label);return values[0]}
const clone=value=>JSON.parse(JSON.stringify(value))
const hasType=(value,type)=>(Array.isArray(value?.['@type'])?value['@type']:[value?.['@type']]).some(t=>[type,'https://schema.org/'+type,'http://schema.org/'+type].includes(t))

const structuredData=d=>{
 const postings=[],webPages=[]
 const visit=(value,depth=0)=>{
  need(depth<=64,'structured data nesting exceeds bound')
  if(!value||typeof value!=='object')return
  if(Array.isArray(value)){value.forEach(v=>visit(v,depth+1));return}
  if(hasType(value,'JobPosting'))postings.push(value)
  if(hasType(value,'WebPage'))webPages.push(value)
  for(const [key,child] of Object.entries(value))if(key!=='@context'&&child&&typeof child==='object')visit(child,depth+1)
 }
 for(const node of d.nodes(n=>n.tag==='script'&&!n.attrs.src&&(n.attrs.type||'').toLowerCase()==='application/ld+json'))visit(readLiteralModel(node.raw||'').value)
 return {postings,webPages}
}

// Preserve the publisher's timezone and distinguish publication from a later
// webpage modification. Impossible calendar/time values cannot renew a role.
const originalDate=(raw,field)=>{
 need(typeof raw==='string','invalid '+field+' date type')
 const m=/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2}))?$/.exec(raw)
 need(m,'unsupported '+field+' date format')
 const year=Number(m[1]),month=Number(m[2]),day=Number(m[3]),hour=Number(m[4]||0),minute=Number(m[5]||0),second=Number(m[6]||0)
 const calendar=new Date(0);calendar.setUTCFullYear(year,month-1,day);calendar.setUTCHours(hour,minute,second,0)
 need(calendar.getUTCFullYear()===year&&calendar.getUTCMonth()===month-1&&calendar.getUTCDate()===day&&hour<=23&&minute<=59&&second<=59,'impossible '+field+' date')
 if(m[8]&&m[8]!=='Z')need(Number(m[8].slice(1,3))<=23&&Number(m[8].slice(4,6))<=59,'invalid '+field+' timezone')
 const date=new Date(raw);need(Number.isFinite(date.getTime()),'invalid '+field+' date')
 return {field,raw,iso:date.toISOString(),exact:Boolean(m[4])}
}
const dateFields=(models,field,prefix)=>models.filter(m=>m[field]!=null&&m[field]!=='').map(m=>originalDate(m[field],prefix+'.'+field))
const earliest=values=>[...values].sort((a,b)=>a.iso.localeCompare(b.iso))[0]||null

export function readEdutinkerRole(html,listing={}){
 need(typeof html==='string'&&html.trim(),'missing original role HTML')
 const d=readNativeDocument(html,{sourceRanges:true})
 const wrap=one(d.nodes(n=>d.hasClass(n,'awsm-job-single-wrap')),'own role wrapper')
 const entry=one(d.nodes(n=>d.hasClass(n,'awsm-job-entry-content'),wrap),'own role entry content')
 const title=d.text(one(d.nodes(n=>/^h[1-6]$/.test(n.tag)&&d.hasClass(n,'elementor-heading-title'),entry),'own role title'))
 need(title,'empty own role title')
 const ownCriteria=d.nodes(n=>d.hasClass(n,'elementor-widget-text-editor'),entry)
 const criteria=ownCriteria.map(n=>d.text(n)).filter(Boolean)
 const rawCriteria=ownCriteria.map(n=>{need(Number.isInteger(n.sourceStart)&&Number.isInteger(n.sourceEnd),'incomplete own criteria container');return html.slice(n.sourceStart,n.sourceEnd)})
 const specs=one(d.nodes(n=>d.hasClass(n,'awsm-job-specifications-container'),wrap),'own role specifications')
 const field=name=>{
  const nodes=d.nodes(n=>d.hasClass(n,'awsm-job-specification-'+name),specs)
  if(!nodes.length)return null
  const node=one(nodes,'own '+name+' specification')
  return d.text(one(d.nodes(n=>d.hasClass(n,'awsm-job-specification-term'),node),'own '+name+' value'))||null
 }
 const department=field('job-category'),employmentType=field('job-type'),location=field('job-location')
 const models=structuredData(d),posting=one(models.postings,'active JobPosting')
 const url=listing.sourceUrl||null
 need(url&&new URL(url).origin==='https://edutinker.com'&&/^\/jobs\/[^/]+\/$/.test(new URL(url).pathname),'invalid first-party role identity')
 const ownDocument=value=>{
  if(typeof value!=='string')return false
  try{const documentURL=new URL(value,url);documentURL.hash='';return documentURL.href===url}catch{return false}
 }
 const claimedWebPages=models.webPages.filter(m=>ownDocument(m.url)||ownDocument(m['@id']))
 const webPageIdentityConflicts=claimedWebPages.filter(m=>['url','@id'].some(key=>m[key]!=null&&!ownDocument(m[key])))
 const webPages=claimedWebPages.filter(m=>!webPageIdentityConflicts.includes(m))
 const postingFields=[...dateFields([posting],'datePosted','JobPosting'),...dateFields(webPages,'datePublished','WebPage')]
 const expiryFields=dateFields([posting],'validThrough','JobPosting')
 const posted=earliest(postingFields),expires=earliest(expiryFields)
 const nativeEmployer=typeof posting.hiringOrganization?.name==='string'?norm(posting.hiringOrganization.name):null
 const employerConflict=Boolean(nativeEmployer&&nativeEmployer.toLowerCase()!=='edutinker')
 const identityConflict=Boolean(webPageIdentityConflicts.length||norm(posting.title)!==title||listing.title&&norm(listing.title)!==title||posting.url!=null&&posting.url!==url)
 const places=Array.isArray(posting.jobLocation)?posting.jobLocation:posting.jobLocation?[posting.jobLocation]:[]
 const nativeCountryAlternatives=places.map(p=>typeof p?.address==='object'?nativeCountryName(typeof p.address.addressCountry==='string'?p.address.addressCountry:p.address.addressCountry?.name):null)
 const typedCountries=nativeCountryAlternatives.filter(Boolean),hasUnknownNativeCountry=nativeCountryAlternatives.some(country=>!country)
 const visibleCountry=nativeLocationCountryName(location)
 const countries=[...new Set([...typedCountries,...(visibleCountry?[visibleCountry]:[])])]
 const country=countries.length===1&&!hasUnknownNativeCountry?countries[0]:null,countryConflict=countries.length>1
 const typedCities=places.map(p=>typeof p?.address==='object'&&typeof p.address.addressLocality==='string'?norm(p.address.addressLocality):null).filter(Boolean)
 const cities=[...new Set(typedCities)]
 const forms=d.nodes(n=>n.tag==='form'&&n.attrs.id==='awsm-application-form',wrap)
 need(forms.length<=1,'ambiguous own role application form')
 const form=forms[0],controls=form?d.nodes(n=>['input','textarea','select','button'].includes(n.tag),form):[]
 const ids=controls.filter(n=>n.attrs.name==='awsm_job_id').map(n=>n.attrs.value)
 need(ids.length<=1&&ids.every(id=>/^\d+$/.test(id)),'ambiguous native public job ID')
 const application=form?{kind:'same-page-unvisited-application-form',url,formAttributes:{id:form.attrs.id,name:form.attrs.name??null,method:form.attrs.method??null,enctype:form.attrs.enctype??null,action:form.attrs.action??null},controlNames:controls.map(n=>n.attrs.name).filter(Boolean),nativePublicJobId:ids[0]??null,activationVerified:false,allControlsQualified:false,submitted:false,visited:false}:null
 return {
  title,company:'Edutinker',nativeEmployer,nativeLegalEmployer:null,sourceLegalEmployerUnverified:true,
  department,employmentType,location,city:cities.length===1?cities[0]:null,country,
  jobId:listing.jobId||new URL(url).pathname.split('/').filter(Boolean).at(-1),nativePublicJobId:ids[0]??null,requisitionId:null,
  sourceUrl:url,applyUrl:application?.url??null,experienceRequired:/\(([^)]*years experience[^)]*)\)/i.exec(title)?.[1]??null,
  minimumQualification:null,preferredQualification:null,requiredSkills:[],
  postingDate:posted?.iso??null,closingDate:expires?.iso??null,sourcePostingDateIsExact:posted?.exact??null,sourceClosingDateIsExact:expires?.exact??null,
  sourceNativeDates:{datePostedRaw:posted?.raw??null,validThroughRaw:expires?.raw??null,recognizedPostingFields:postingFields,recognizedExpiryFields:expiryFields},
  jobDescription:criteria.join('\n\n')||null,sourceDescription:criteria.join('\n\n')||null,sourceRawDescriptionHtml:rawCriteria.join('\n')||null,
  remoteStatus:/\bremote\b/i.test(location||'')?'Remote':null,
  sourceNativeJobPostings:clone(models.postings),sourceNativeWebPages:clone(claimedWebPages),sourceNativeWebPageIdentityConflicts:clone(webPageIdentityConflicts),sourceNativeApplication:application,
  sourceCountryEvidence:{visibleLocation:location,originalNativeLocations:clone(places),nativeCountryAlternatives,hasUnknownNativeCountry,typedCountries,visibleCountry},
  sourceEmployerConflict:employerConflict,sourceIdentityConflict:identityConflict,sourceCountryConflict:countryConflict,
  sourceCompanyScopeUnresolved:!nativeEmployer||employerConflict,sourceCountryScopeUnresolved:!country||countryConflict,
  sourceDetailComplete:false,sourceDetailStatus:'partial',sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,
 }
}
