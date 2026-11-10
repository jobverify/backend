import {readNativeDocument} from './nativeHtml.js'
import {findExplicitNativeClosure,readNativeStatusTextBlocks} from '../../scraper-support/utils/sourceAvailability.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
export const HOME='https://www.credo.ai/',CAREERS=HOME+'company/jobs',BOARD='https://jobs.ashbyhq.com/credo.ai',API='https://api.ashbyhq.com/posting-api/job-board/credo.ai'
export const check=(ok,message)=>{if(!ok)throw Error('Credo AI native contract: '+message)}
const one=(a,label)=>{check(a.length===1,'Expected one '+label);return a[0]}
export function envelope(d){check(d&&typeof d==='object'&&!Array.isArray(d),'Invalid native envelope');for(const[k,v]of Object.entries(d)){const key=k.toLowerCase().replace(/[_\s-]/g,'');if(['error','errors','exception','fault','errorcode','errormessage'].includes(key))check(v==null,'Native error envelope');if(['success','ok'].includes(key))check(v===true,'Native failure flag');if(['statuscode','code','status'].includes(key))check(v===200,'Native status failure');if(['meta','metadata'].includes(key)&&v!=null)envelope(v)}}
export function verifyCorporate(home,career){
 const d=readNativeDocument(home),c=readNativeDocument(career)
 check(d.nodes(n=>n.tag==='title').some(n=>/Credo AI/.test(n.raw??''))&&c.nodes(n=>n.tag==='title').some(n=>n.raw==='Credo AI - Jobs'),'Current corporate identity missing')
 check(one(d.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical'),'corporate canonical').attrs.href===HOME.slice(0,-1),'Wrong corporate canonical')
 check(one(c.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical'),'career canonical').attrs.href===CAREERS,'Wrong career canonical')
 check(d.nodes(n=>n.tag==='a'&&n.attrs.href).some(n=>new URL(n.attrs.href,HOME).href===CAREERS),'Current career handoff missing')
 check(c.nodes(n=>n.tag==='script'&&!Object.hasOwn(n.attrs,'nomodule')&&['','text/javascript','application/javascript'].includes(n.attrs.type??'')&&n.attrs.src===BOARD+'/embed').length===1,'Active exact Ashby embed missing')
}
export function preload(body){
 const scripts=readNativeDocument(body).nodes(n=>n.tag==='script'&&!n.attrs.src&&!Object.hasOwn(n.attrs,'nomodule')&&['','text/javascript','application/javascript'].includes(n.attrs.type??''))
 const raw=one(scripts.filter(n=>/^\s*;?\s*window\.__appData\s*=/.test(n.raw??'')),'active top-level native preload assignment').raw
 check(/^\s*window\.__appData\s*=\s*\{/.test(raw),'Native preload is not the observed literal object')
 const start=raw.indexOf('{');let depth=0,q=false,escape=false,end=-1
 for(let i=start;i<raw.length;i++){const c=raw[i];if(q){if(escape)escape=false;else if(c==='\\')escape=true;else if(c==='"')q=false}else if(c==='"')q=true;else if(c==='{')depth++;else if(c==='}'&&--depth===0){end=i+1;break}}
 check(end>0&&/^\s*;/.test(raw.slice(end))&&!/window\.__appData\s*=/.test(raw.slice(end)),'Native preload expression changed')
 const d=JSON.parse(raw.slice(start,end));envelope(d);envelope(d.organization)
 const o=d.organization;check(o.name==='Credo.AI'&&o.organizationId==='79a3b1bb-4ea1-4fa0-8f3c-bffc3aac9be9'&&o.hostedJobsPageSlug==='credo.ai'&&o.publicWebsite==='http://credo.ai'&&o.isDemoOrg===false,'Wrong native organization')
 check(d.maintenanceMode===false&&d.schedulingMaintenanceMode===false,'Native service unavailable')
 return d
}
function secondaryCountryScope(record,brief){
 check(Array.isArray(record.secondaryLocations)&&Array.isArray(brief.secondaryLocations),'Changed secondary scope requires qualification')
 if(record.secondaryLocations.length===0&&brief.secondaryLocations.length===0)return
 // The current board independently names this US secondary location; its
 // own API record supplies the postal country. This foreign-only contract
 // cannot extend an India role or qualify another country/remote label.
 const fields=(value,allowed)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(key=>allowed.includes(key))
 const native=record.secondaryLocations[0],publicLocation=brief.secondaryLocations[0]
 check(record.secondaryLocations.length===1&&brief.secondaryLocations.length===1
  &&['USA Remote (East Coast Time Zone Preferred)','USA Remote (Pacific Time Zone Preferred)'].includes(record.location)
  &&record.address?.postalAddress?.addressCountry==='United States'
  &&fields(native,['location','address'])&&native.location==='USA Remote'
  &&fields(native.address,['postalAddress'])&&fields(native.address.postalAddress,['addressCountry'])
  &&native.address.postalAddress.addressCountry==='United States'
  &&fields(publicLocation,['locationId','locationName','__typename'])
  &&typeof publicLocation.locationId==='string'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(publicLocation.locationId)
  &&publicLocation.locationName===native.location&&publicLocation.__typename==='JobPostingSecondaryLocation',
 'Changed secondary country scope requires qualification')
}
export function validateInventory(payload,board,now){
 envelope(payload);check(payload.apiVersion==='1'&&Array.isArray(payload.jobs)&&payload.jobs.length<=200,'Native listing schema/count unqualified')
 check(payload.hasMore==null||payload.hasMore===false,'Native pagination incomplete');check(payload.total==null||Number.isSafeInteger(payload.total)&&payload.total===payload.jobs.length,'Native count mismatch')
 check(board.posting===null&&Array.isArray(board.jobBoard?.jobPostings),'Native public board shape changed');envelope(board.jobBoard)
 const records=payload.jobs,briefs=board.jobBoard.jobPostings;check(briefs.length===records.length&&new Set(records.map(r=>r.id)).size===records.length&&new Set(briefs.map(r=>r.id)).size===briefs.length,'Incomplete or duplicate native IDs')
 const india=[];for(const r of records){envelope(r);check(typeof r.id==='string'&&/^[a-f0-9-]{36}$/.test(r.id)&&r.isListed===true,'Native public role status/identity changed')
  check(typeof r.title==='string'&&r.title.trim()&&r.title===plain(r.title),'Inactive native title')
  const b=one(briefs.filter(b=>b.id===r.id),'matching public role');check(b.title===r.title&&b.locationName===r.location,'Native board/API identity drift')
  for(const key of['country','countryCode','country_code','employer','company','companyName','hiringOrganization'])check(r[key]==null,'New explicit country/employer scope requires qualification')
  check(b.workplaceType===r.workplaceType&&b.employmentType===r.employmentType,'Native board/API work arrangement drift')
  check(r.workplaceType==='Remote'?r.isRemote===true:r.workplaceType===null&&r.isRemote===null,'Native remote/workplace contradiction')
  check(r.jobUrl===BOARD+'/'+r.id&&r.applyUrl===r.jobUrl+'/application','Native apply identity mismatch')
  nativeDate(r.publishedAt,now)
  secondaryCountryScope(r,b)
  const country=r.address?.postalAddress?.addressCountry
  if(r.location==='India Remote'){check(country==='India'&&Object.keys(r.address.postalAddress).every(k=>k==='addressCountry'),'Conflicting or new India address scope');check(!/future\s+(?:hiring|opportunities)|talent\s+(?:community|network|pool)|general\s+application|speculative|submit\s+your\s+resume/i.test(r.title),'Talent pool is not a current vacancy');india.push(r)}
  else if(['USA Remote (East Coast Time Zone Preferred)','USA Remote (Pacific Time Zone Preferred)'].includes(r.location))check(country==='United States','Contradictory foreign scope')
  else check(r.location==='Remote'&&r.address===null&&r.title==='Submit your Resume for Future Hiring','New unresolved scope requires qualification')
 }
 return india
}
function nativeDate(value,now){check(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}(?:Z|\+00:00)$/.test(value),'Unsupported native publication timestamp');const d=new Date(value);check(Number.isFinite(d.getTime())&&d.toISOString().slice(0,23)===value.slice(0,23)&&d.getTime()<=Date.parse(now),'Invalid/future native publication')}
function plain(html){const d=readNativeDocument(html);return d.text(one(d.nodes(n=>n.tag==='root'),'content root'))}
function fullDescription(html){
 check(typeof html==='string','Malformed native full content');const d=readVisibleNativeDocument(html,{strict:true,statusLayout:true}),root=one(d.nodes(n=>n.tag==='root'),'description root'),sections=new Map();let heading=null
 check(!findExplicitNativeClosure(readNativeStatusTextBlocks(root)),'Listed native role has an explicit closure notice')
 for(const node of root.children){if(typeof node==='string'||node.inert)continue;if(/^h[1-6]$/.test(node.tag)){heading=d.text(node);check(!sections.has(heading),'Duplicate role section');sections.set(heading,'')}else if(heading)sections.set(heading,sections.get(heading)+' '+d.text(node))}
 for(const title of['About the Role','Key Responsibilities','Minimum Qualifications']){const text=sections.get(title)||'';const clean=text.replace(/(?:please )?(?:click (?:the )?apply(?: now)?|apply now|submit your application)[^.!?]*(?:[.!?]|$)/gi,'');if((clean.match(/[A-Za-z]/g)||[]).length<40)return null}
 return plain(html)
}
export function validateDetail(row,detail,application){
 for(const d of[detail,application]){const p=d.posting;envelope(p);check(p.id===row.id&&p.title===row.title&&p.locationName===row.location&&p.locationAddress===null&&p.isListed===true&&p.isConfidential===false,'Native detail role/status/location mismatch');check(Array.isArray(p.secondaryLocationNames)&&p.secondaryLocationNames.length===0,'Native secondary scope changed');check(p.employmentType===row.employmentType&&p.workplaceType===row.workplaceType,'Native work arrangement mismatch');check(p.descriptionHtml===row.descriptionHtml,'Native full content drift');check(p.applicationDeadline===null&&p.applicationLimitCalloutHtml===null,'Native closing/application limit needs qualification')}
 return fullDescription(row.descriptionHtml)
}
