import {readNativeDocument,extractActiveDescription,decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
import {filterIndiaJobs} from '../../scraper-support/utils/indiaLocationFilter.js'
import {createNativeRoleAvailability,nativeRoleClosureNotice} from '../../scraper-support/utils/sourceAvailability.js'
export const ENTRY='https://datahub.com/datahub-careers/',CAREERS='https://datahub.com/company/careers/',EMBED='https://boards.greenhouse.io/embed/job_board/js?for=acryldata',BOARD='https://job-boards.greenhouse.io/acryldata',API='https://boards-api.greenhouse.io/v1/boards/acryldata/jobs?content=true'
export const check=(value,message)=>{if(!value)throw Error('DataHub native contract: '+message)}
const object=value=>value&&typeof value==='object'&&!Array.isArray(value)
const one=(rows,label)=>{check(rows.length===1,'Expected one '+label);return rows[0]}
const executable=node=>node.tag==='script'&&!node.attrs.src&&!Object.hasOwn(node.attrs,'nomodule')&&['','text/javascript','application/javascript'].includes(node.attrs.type??'')
const clean=value=>String(value??'').replace(/\s+/g,' ').trim()
function activeDocument(html){
 const doc=readNativeDocument(html)
 function mark(node,inert=false){
  if(typeof node==='string')return
  node.inert=Boolean(node.inert||inert||Object.hasOwn(node.attrs??{},'inert'))
  for(const child of node.children??[])mark(child,node.inert)
 }
 mark(one(doc.nodes(n=>n.tag==='root'),'document root'))
 return doc
}
const foreignLabels=new Set(['us','usa','uk','uae','united states of america'])
const regionNames=new Intl.DisplayNames(['en'],{type:'region'})
for(let a=65;a<=90;a++)for(let b=65;b<=90;b++){
 const code=String.fromCharCode(a,b),name=regionNames.of(code)
 if(code!=='IN'&&name&&name!==code&&!['ZZ','EU','UN','XA','XB','QO'].includes(code))foreignLabels.add(name.toLowerCase().replace(/[^\p{L}]+/gu,' ').trim())
}
const foreignLabel=value=>{const words=' '+String(value).toLowerCase().replace(/[^\p{L}]+/gu,' ').trim()+' ';return[...foreignLabels].some(name=>words.includes(' '+name+' '))}
export function envelope(value){
 check(object(value),'Malformed native object')
 for(const[k,v]of Object.entries(value)){
  const key=k.toLowerCase().replace(/[_\s-]/g,'')
  if(['error','errors','exception','fault'].includes(key))check(v==null||v===''||Array.isArray(v)&&v.length===0,'Native error envelope')
  if(['success','ok'].includes(key)&&v!=null)check(v===true,'Native failure flag')
  if(['status','statuscode'].includes(key)&&v!=null)check(v===200,'Native status failure')
 }
}
export function nativeDate(value,now,publication=true){
 if(value==null)return null
 check(typeof value==='string','Native timestamp type changed')
 const m=value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/)
 check(m,'Native timestamp format changed')
 const[,y,mo,d,h,mi,s,zone]=m
 check(+mo>=1&&+mo<=12&&+d>=1&&+d<=new Date(Date.UTC(+y,+mo,0)).getUTCDate()&&+h<24&&+mi<60&&+s<60&&(zone==='Z'||+zone.slice(1,3)<=14&&+zone.slice(4)<60),'Invalid native calendar')
 const ms=Date.parse(value);check(Number.isFinite(ms)&&(!publication||ms<=Date.parse(now)),'Invalid or future native publication')
 return new Date(ms).toISOString()
}
export function verifyCorporate(entry,career,embed){
 const first=activeDocument(entry),doc=activeDocument(career)
 check(first.nodes(n=>n.tag==='title').some(n=>/DataHub/.test(n.raw??'')),'Current company identity unavailable')
 check(one(first.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical'),'entry canonical').attrs.href===ENTRY,'Entry canonical mismatch')
 check(first.nodes(n=>n.tag==='a'&&n.attrs.href).some(n=>new URL(n.attrs.href,ENTRY).href===CAREERS),'Current open positions handoff unavailable')
 check(one(doc.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical'),'career canonical').attrs.href===CAREERS,'Career canonical mismatch')
 check(doc.nodes(n=>n.tag==='h1').some(n=>doc.text(n)==='Careers with DataHub'),'Current visible career identity unavailable')
 check(one(doc.nodes(n=>n.attrs.id==='grnhse_app'),'native board container').tag==='div','Invalid board container')
 const node=one(doc.nodes(n=>n.tag==='script'&&n.attrs.id==='datahub-greenhouse-board-js'),'current deferred board configuration')
 check(node.attrs.type==='text/rocketlazyloadscript'&&node.attrs['data-rocket-src']===EMBED&&!node.attrs.src,'Deferred recruitment tenant changed')
 const loader=one(doc.nodes(n=>executable(n)&&n.raw?.includes('class RocketLazyLoadScripts')),'active deferred script loader').raw
 check(/^\s*\(\(\)=>\{class RocketLazyLoadScripts\{/.test(loader)&&/\}\)\(\);?\s*$/.test(loader)&&loader.includes('RocketLazyLoadScripts.run()')&&loader.includes('script[type$=rocketlazyloadscript]')&&loader.includes('getAttribute("data-rocket-src")')&&loader.includes('mousemove'),'Current executable deferred loader contract changed')
 // Read the publicly advertised static settings; never execute employer JS.
 const assignment=embed.match(/^\s*var Grnhse = Grnhse \|\| \{\};\s*Grnhse\.Settings\s*=\s*\{([\s\S]*?)\};/)
 check(assignment,'Native embed settings changed')
 check((embed.match(/\bGrnhse\.Settings\s*=/g)??[]).length===1,'Ambiguous native embed settings')
 const settings={};let rest=assignment[1]
 while(rest.trim()){
  const property=rest.match(/^\s*([A-Za-z_$][\w$]*)\s*:\s*(?:'([^'\\\r\n]*)'|(true|false|-?\d+(?:\.\d+)?))\s*(,|$)/)
  check(property&&!Object.hasOwn(settings,property[1]),'Native settings must use unique direct scalar properties')
  settings[property[1]]=property[2]??property[3];rest=rest.slice(property[0].length)
 }
 check(settings.targetDomain==='https://job-boards.greenhouse.io'&&settings.boardURI==='https://job-boards.greenhouse.io/embed/job_board?for=acryldata'&&settings.applicationURI==='https://job-boards.greenhouse.io/embed/job_app?for=acryldata'&&settings.useEmbeddedInternalBoard==='false','Native embed account mismatch')
}
function country(value){return value==null?null:/^(?:India|IN|IND)$/i.test(value)?'IN':/^(?:United States|United States of America|US|USA)$/i.test(value)?'US':'unknown'}
function explicitFields(record,expected){
 for(const[k,v]of Object.entries(record)){
  if(['country','countrycode','country_code','addresscountry'].includes(k.toLowerCase())&&v!=null)check(typeof v==='string'&&country(v)===expected,'Contradictory explicit native country')
  if(['company','companyname','company_name','employer','employername','employer_name','legalemployer'].includes(k.toLowerCase())&&v!=null)check(v==='DataHub','Contradictory native employer')
 }
}
export function inventory(payload,now){
 envelope(payload);envelope(payload.meta)
 check(Array.isArray(payload.jobs)&&Number.isSafeInteger(payload.meta.total)&&payload.meta.total>=0&&payload.meta.total===payload.jobs.length&&payload.jobs.length<=200,'Incomplete native single-response inventory')
 check(!payload.hasMore&&!payload.nextPage&&!payload.nextCursor,'Unfetched native pagination')
 const seen=new Set(),india=[]
 for(const row of payload.jobs){
  envelope(row);check(Number.isSafeInteger(row.id)&&row.id>0&&!seen.has(row.id),'Invalid or duplicate job ID');seen.add(row.id)
  check(Number.isSafeInteger(row.internal_job_id)&&row.internal_job_id>0&&row.company_name==='DataHub','Native role identity mismatch')
  check(typeof row.title==='string'&&row.title.trim()&&!/[<>]/.test(row.title)&&typeof row.content==='string','Native title/content schema changed')
  check(row.absolute_url===BOARD+'/jobs/'+row.id,'Native role URL mismatch')
  check(object(row.location)&&typeof row.location.name==='string'&&row.location.name.trim()&&Array.isArray(row.offices),'Native location unavailable')
  const label=row.location.name,isIndia=/\bIndia\b/i.test(label),expected=isIndia?'IN':/\b(?:US|United States)\b/i.test(label)?'US':null
  explicitFields(row,expected);explicitFields(row.location,expected)
  if(isIndia)check(filterIndiaJobs([{location:label,country:'India'}]).length===1&&!foreignLabel(label),'Conflicting native India location')
  for(const office of row.offices){envelope(office);explicitFields(office,expected);if(office.location!=null)check(typeof office.location==='string'&&(!isIndia||/\bIndia\b/i.test(office.location)&&!foreignLabel(office.location)),'Office location requires qualification')}
  nativeDate(row.first_published,now);nativeDate(row.updated_at,now);nativeDate(row.application_deadline,now,false)
  if(isIndia&&!/talent (?:pool|community|network)|future (?:hiring|opportunities)|submit your resume|general application/i.test(row.title))india.push(row)
 }
 return india
}
function fullDescription(html){
 if(typeof html!=='string')return null
 const doc=activeDocument(html),text=extractActiveDescription(doc.text(one(doc.nodes(n=>n.tag==='root'),'description root')));if(!text)return null
 if(/(?:this|the) (?:job|role|position) (?:is (?:closed|no longer available)|has been filled)|no longer accepting applications/i.test(text))return null
 const rest=text.replace(/(?:please )?(?:click (?:the )?apply(?: now)?|apply now|submit your application)[^.!?]*(?:[.!?]|$)/gi,'')
  .replace(/[^.!?]*(?:\bbefore you submit (?:your )?(?:resume|application)|\buse (?:the )?application form\b|\bfollow (?:the )?instructions on (?:the )?next (?:screen|page)\b)[^.!?]*(?:[.!?]|$)/gi,' ')
 const sections=new Set(doc.nodes(n=>/^(?:h[1-6]|p|strong|b)$/.test(n.tag)).map(n=>doc.text(n)).filter(text=>/^(?:about the role|(?:key )?responsibilities|requirements|(?:preferred )?qualifications|what you'll do)\s*:?$/i.test(text)).map(s=>s.toLowerCase().replace(/:$/,'').trim()))
 return sections.size>=2&&(rest.match(/[\p{L}\p{N}]/gu)??[]).length>=80?text:null
}
export function detail(html,row,now){
 const doc=activeDocument(html),canonical=one(doc.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical'),'native role canonical')
 check([row.absolute_url,row.absolute_url.replace(/^https:/,'http:')].includes(canonical.attrs.href),'Native role canonical mismatch')
 const scripts=doc.nodes(n=>executable(n)&&n.raw?.includes('window.__remixContext'))
 const raw=one(scripts,'active native role model').raw,match=raw.match(/^\s*window\.__remixContext\s*=\s*([\s\S]+);\s*$/)
 check(match,'Invalid native role model');const data=JSON.parse(match[1]);envelope(data);envelope(data.state);check(data.state.errors===null,'Native loader failure')
 const root=data.state.loaderData?.root,r=data.state.loaderData?.['routes/$url_token_.jobs_.$job_post_id'];envelope(root);envelope(r);envelope(r.jobPost)
 check(root.urlToken==='acryldata'&&root.internal===false&&root.preview===false&&root.isJobPost===true&&root.boardConfiguration?.job_board_public_url===BOARD,'Native board scope mismatch')
 check(r.jobPostId===String(row.id)&&r.urlToken==='acryldata'&&r.submitPath==='https://boards.greenhouse.io/acryldata/jobs/'+row.id,'Native application identity mismatch')
 const p=r.jobPost
 check(p.post_type==='job_post'&&p.title===row.title&&p.company_name==='DataHub'&&p.public_url===row.absolute_url&&p.job_post_location===row.location.name&&p.hiring_plan_id===row.internal_job_id&&p.redirect_to===null,'Native full detail identity mismatch')
 explicitFields(p,'IN')
 check(nativeDate(p.published_at,now)===nativeDate(row.first_published,now)&&p.application_deadline===row.application_deadline,'Native publication or deadline drift')
 check(one(doc.nodes(n=>n.tag==='h1'),'visible role title')&&doc.nodes(n=>n.tag==='h1').some(n=>doc.text(n)===clean(row.title)),'Visible role title mismatch')
 const form=one(doc.nodes(n=>n.tag==='form'&&n.attrs.id==='application-form'),'public application form')
 check(new URL(form.attrs.action,row.absolute_url).href===row.absolute_url,'Public application path mismatch')
 // The parser has no submissions. These controls establish that the observed
 // public role has an available application form, not an archival shell.
 check(!Object.hasOwn(form.attrs,'disabled')&&form.attrs['aria-disabled']!=='true','Application disabled')
 const owned=[]
 function walk(node,disabled=false,inForm=false){
  if(typeof node==='string'||node.inert)return
  const blocked=disabled||node.tag==='fieldset'&&Object.hasOwn(node.attrs,'disabled')
  if(node===form)check(!blocked,'Application has disabled ancestor')
  const belongs=inForm||node===form
  if(belongs&&!blocked&&!Object.hasOwn(node.attrs,'disabled')&&node.attrs['aria-disabled']!=='true'&&(!Object.hasOwn(node.attrs,'form')||node.attrs.form==='application-form'))owned.push(node)
  for(const child of node.children??[])walk(child,blocked,belongs)
 }
 walk(one(doc.nodes(n=>n.tag==='root'),'document root'))
 const buttons=owned.filter(n=>n.tag==='button'&&n.attrs.type==='submit')
 check(buttons.some(n=>doc.text(n)==='Submit application'),'Application submit control unavailable')
 check(['first_name','last_name','email'].every(id=>owned.filter(n=>{
  const type=String(n.attrs.type??'text').toLowerCase()
  const usableType=id==='email'?(type==='email'||type==='text'&&n.attrs.autocomplete==='email'&&n.attrs['aria-label']==='Email'):type==='text'
  return n.tag==='input'&&n.attrs.id===id&&usableType&&!Object.hasOwn(n.attrs,'readonly')
 }).length===1),'Applicant controls unavailable')
 check(typeof p.content==='string','Native role content malformed')
 const identity={source:'datahub',company:'DataHub',jobId:String(row.id),title:row.title,sourceUrl:row.absolute_url}
 const notice=nativeRoleClosureNotice(identity,html)
 const description=notice?null:fullDescription(p.content),apiDescription=extractActiveDescription(decodeNativeEntities(decodeNativeEntities(row.content)))
 check(!description||apiDescription?.includes(description.replace(/ Please click Apply now to submit your application\.$/,'')),'API/full role content drift')
 const availability=description||notice?createNativeRoleAvailability({...identity,sourceDescription:description,jobDescription:description,sourceDetailComplete:Boolean(description)},
  {state:notice?'closed':'open',observedAt:now,evidenceHtml:html}):null
 return{description,postedAt:nativeDate(row.first_published,now),closingDate:nativeDate(row.application_deadline,now,false),nativeLocation:p.job_post_location,nativePublishedAt:p.published_at,
  availability,nativeRejectedDescription:description?null:p.content,sourceDetailFailureReason:notice?'native-role-explicitly-closed':description?null:'native-description-missing'}
}
