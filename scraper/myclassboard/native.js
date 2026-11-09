import {document,decode} from '../../scraper-support/shared/rmkNativePairHtml.js'
import {nativeDate,nativeCountryName,nativeLocationCountryName} from '../../scraper-support/shared/nativeJobPosting.js'

// Extend the shared non-executing reader for this source's visibility contract.
// Mark descendants too, so a nested node cannot bypass a hidden ancestor.
function activeDocument(html) {
 const doc=document(html)
 const visit=(node,inherited=false)=>{
  node.inactive ||= inherited || /(?:^|;)\s*content-visibility\s*:\s*hidden\s*(?:!important\s*)?(?:;|$)/i.test((node.attrs?.style||'').replace(/\/\*[\s\S]*?\*\//g,''))
  for(const child of node.children||[])if(typeof child!=='string')visit(child,node.inactive)
 }
 visit(doc.root)
 return doc
}

// Containers with only nested headings or emphasized labels are not prose.
// This measurement is separate from the preserved visible description text.
function proseText(node) {
 if(!node||node.inactive||/^(?:h[1-6]|strong|b|script|style)$/.test(node.tag))return ''
 return node.children.map(child=>typeof child==='string'?decode(child):proseText(child)).join(' ').replace(/\s+/g,' ').trim()
}

export const CORPORATE_HOME='https://www.mcbapp.com/'
export const CORPORATE_CAREERS=CORPORATE_HOME+'careers/'
export const ATS_ROOT='https://mcb.keka.com/careers/'
export const IDENTIFIER='209582f5-2061-48a9-8889-d5d389ef7194'
export const EMPLOYER='MyClassboard Educational Solutions Pvt Ltd'
export const APPLICATION_CLIENT='https://cdn.keka.com/careers/v/2026/scripts/app/app.min.js'

// Keka's active array contains both hydrated locations and older references to
// those same tenant locations. Resolve only exact native IDs AND exact labels;
// a city name, employer address or a location from another collection is not a key.
const locationSignature=location=>typeof location.name==='string'&&location.name.trim()&&typeof location.city==='string'&&location.city.trim()?JSON.stringify([location.name,location.city]):null
const absent=value=>value==null||value===''
export function buildLocationCountryReferences(rows) {
 const groups=new Map(),references=new Map()
 for(const row of rows){
  if(!Array.isArray(row.jobLocations))throw Error('Native job locations malformed')
  for(const location of row.jobLocations){
   if(!Number.isSafeInteger(location?.id)||location.id<=0)continue
   const group=groups.get(location.id)??{signatures:new Set(),states:new Set(),countries:new Set(),referenceJobIds:[]}
   group.signatures.add(locationSignature(location))
   if(!absent(location.state))group.states.add(location.state)
   if(!absent(location.countryCode)||!absent(location.countryName)){
    const code=nativeCountryName(location.countryCode),name=nativeCountryName(location.countryName)
    group.countries.add(code&&code===name?code:null)
    if(code&&code===name)group.referenceJobIds.push(String(row.id))
   }
   groups.set(location.id,group)
  }
 }
 for(const [id,group] of groups){
  if(group.signatures.size!==1||group.signatures.has(null)||group.states.size>1||group.countries.size!==1||!group.countries.has('India'))continue
  references.set(id,{locationId:id,signature:[...group.signatures][0],countryCode:'IN',countryName:'India',referenceJobIds:[...new Set(group.referenceJobIds)],sourceUrl:ATS_ROOT+'api/embedjobs/default/active/'+IDENTIFIER,field:'jobLocations[].countryCode+countryName'})
 }
 return references
}

export function parseCorporate(home,careers) {
 const h=activeDocument(home), c=activeDocument(careers)
 if(!h.nodes(n=>n.tag==='meta'&&n.attrs.property==='og:title'&&/MyClassboard/i.test(n.attrs.content)).length
  ||!h.nodes(n=>n.tag==='a'&&n.attrs['aria-label']==='support@myclassboard.in').length
  ||!h.nodes(n=>n.tag==='a'&&new URL(n.attrs.href||'#',CORPORATE_HOME).href===CORPORATE_CAREERS&&h.text(n)==='Careers').length) throw Error('Corporate MyClassboard identity or careers handoff changed')
 const links=c.nodes(n=>n.tag==='a'&&/^https:\/\/mcb\.keka\.com\/careers\/jobdetails\/[1-9]\d*$/.test(n.attrs.href||''))
 if(!c.text(c.root).includes('Open Positions')||!links.length)throw Error('Native corporate role inventory unavailable')
 const rows=links.map(n=>({id:n.attrs.href.split('/').at(-1),sourceUrl:n.attrs.href,title:c.text(c.nodes(x=>/^h[1-6]$/.test(x.tag),n)[0])||null,cardText:c.text(n)}))
 if(new Set(rows.map(r=>r.id)).size!==rows.length||rows.some(r=>!r.title))throw Error('Corporate role identity is missing or duplicate')
 return rows
}

export function verifyDetail(html,row) {
 const d=activeDocument(html),id=String(row.id)
 if(d.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json'||n.tag==='meta'&&/^(?:validThrough|closingDate|expiryDate|datePosted)$/i.test(n.attrs.itemprop||n.attrs.name||n.attrs.property||'')).length)throw Error('Unreviewed native detail structured posting or expiry metadata')
 const heading=d.nodes(n=>n.tag==='h1'&&n.attrs.title===row.title)
 const selected=d.nodes(n=>n.attrs.selectedjobid===id&&n.attrs.selectedjobtitle===row.title)
 const apply=d.nodes(n=>n.tag==='button'&&n.attrs.id==='apply-job'&&!Object.hasOwn(n.attrs,'disabled')&&d.text(n)==='Apply for this job')
 if(heading.length!==1||selected.length!==1||apply.length!==1||!d.nodes(n=>n.tag==='a'&&n.attrs.href==='https://www.myclassboard.com/').length)throw Error('Native detail identity or active application changed: '+id)
 const block=d.nodes(n=>d.hasClass(n,'job-description-container'))[0]
 const substantive=block&&d.nodes(n=>['p','div','li'].includes(n.tag)&&n!==block&&proseText(n).length>60,block).length
 return substantive?d.text(block):null
}

export function mapNative(row,description,{now=new Date(),locationCountryReferences=new Map()}={}) {
 if(!Number.isSafeInteger(row?.id)||row.id<=0||typeof row.title!=='string'||!row.title.trim()||!Array.isArray(row.jobLocations))throw Error('Native job record malformed')
 const reviewedKeys=new Set(['id','title','description','departmentIdentifier','departmentName','excerpt','jobLocations','jobType','experience','salaryRange','salaryRangeFormat','publishedOn','publishedSinceDays','skillNames'])
 if(Object.keys(row).some(key=>!reviewedKeys.has(key)))throw Error('Unreviewed native job fields; publication, expiry or scope requires renewed verification')
 const locationKeys=new Set(['id','name','city','state','countryCode','countryName','locationIdentifier'])
 const countryEvidence=[]
 const resolvedLocations=row.jobLocations.map(location=>{
  if(!location||!absent(location.countryCode)||!absent(location.countryName))return location
  const reference=locationCountryReferences.get(location.id)
  if(!reference||reference.signature!==locationSignature(location))return location
  const {signature,...evidence}=reference
  countryEvidence.push(evidence)
  return {...location,countryCode:reference.countryCode,countryName:reference.countryName}
 })
 for(const location of resolvedLocations){
  if(!location||typeof location!=='object'||Object.keys(location).some(key=>!locationKeys.has(key)))throw Error('Unreviewed native location shape')
  const declared=[location.countryCode,location.countryName].filter(Boolean).map(nativeCountryName).filter(Boolean)
  // Two-letter state abbreviations such as TG must not be read as countries.
  const written=[location.name,location.city,location.state].filter(v=>typeof v==='string'&&!/^[A-Z]{2,3}$/.test(v)).map(nativeLocationCountryName).filter(Boolean)
  if(new Set([...declared,...written]).size>1)throw Error('Contradictory native location countries')
 }
 const publication=nativeDate(row.publishedOn,{required:true}),clock=new Date(now)
 if(!Number.isFinite(clock.getTime())||Date.parse(publication.iso)>clock.getTime())throw Error('Native publication date is future or clock invalid')
 const india=resolvedLocations.filter(l=>l.countryCode==='IN'&&l.countryName==='India')
 if(!india.length)return null
 const id=String(row.id),sourceUrl=ATS_ROOT+'jobdetails/'+id,applyUrl=ATS_ROOT+'applyjob/'+id
 const location=india[0]
 return {source:'myclassboard',company:'MyClassboard',companyCareerPage:CORPORATE_CAREERS,companyDomain:'myclassboard.com',atsPlatform:'keka',jobId:id,requisitionId:id,title:row.title,sourceUrl,applyUrl,link:applyUrl,
  country:'India',city:location.city||null,state:location.state||null,location:[location.city||location.name,location.state,'India'].filter(Boolean).join(', '),
  locations:india.map(l=>[l.city||l.name,l.state,'India'].filter(Boolean).join(', ')),department:row.departmentName||null,experienceRequired:row.experience||null,
  employmentType:row.jobType===2?'Full Time':null,requiredSkills:row.skillNames||[],postingDate:row.publishedOn,closingDate:null,jobDescription:description,
  ...(countryEvidence.length?{nativeLocationCountryEvidence:countryEvidence}:{}),
  sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,sourceDetailComplete:description!==null,sourceDetailStatus:description===null?'partial':'complete',publicExperienceChecked:true,scrapedAt:clock.toISOString()}
}

export function verifyApplication(html,row) {
 const d=activeDocument(html)
 const form=d.nodes(n=>n.tag==='form'&&n.attrs.id==='jobApplicationForm')
 if(form.length!==1||!d.nodes(n=>n.tag==='h1'&&n.attrs.title===row.title).length
  ||!d.nodes(n=>n.tag==='input'&&n.attrs.name==='firstName',form[0]).length
  ||!d.nodes(n=>n.tag==='input'&&n.attrs.name==='email',form[0]).length
  ||!d.nodes(n=>n.tag==='button'&&n.attrs.id==='jobApplicationSubmitButton'&&d.text(n)==='Apply Now',form[0]).length)throw Error('Native application form missing or role identity changed: '+row.id)
}
