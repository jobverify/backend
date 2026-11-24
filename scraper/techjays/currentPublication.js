import {createHash} from 'node:crypto'
import {parse} from 'acorn'
import profile from './currentPublicationProfile.json' with {type:'json'}
import {readNativeDocument,activeHead} from '../../scraper-support/utils/activeNativeHtml.js'

const HOME='https://www.techjays.com/',CAREERS=HOME+'careers'
const sha=value=>createHash('sha256').update(value).digest('hex')
const norm=value=>String(value).replace(/\s+/g,' ').trim()
const requireCurrent=(condition,message)=>{if(!condition)throw new Error('Techjays reviewed current publication: '+message)}
const one=(values,label)=>{requireCurrent(values.length===1,'expected one '+label);return values[0]}
const flatten=(node,result=[])=>{if(typeof node!=='string'){result.push(node);node.children.forEach(child=>flatten(child,result))}return result}

export const isReviewedCurrentSurface=html=>{
 const doc=readNativeDocument(html),deployment=doc.nodes(node=>node.tag==='html')[0]?.attrs['data-dpl-id']
 // Only the exact retained six-card legacy board may use legacy extraction.
 // Missing or renamed current markers cannot establish a legacy deployment.
 if(deployment==='dpl_34wgz9pq9BqkVrEStnLUvWTVVJKV'&&sha(html)==='2da8f330f643e0e994fc0a0495cbf0c722288ce438d9c7bb3e6105774c7a2169')return false
 requireCurrent(activeHead(html).titles.some(title=>title==='Careers'||title==='Careers | Techjays'),'current careers page identity/deployment changed')
 return true
}

// Finite admission follows review of the original complete documents, native
// model, card filter/map/reveal, application module and all declared CSS/JS.
// It supplies observations only: unknown role country cannot certify an India
// inventory, and arbitrary future cohorts or programmes are not admitted.
const documentEvidence=(page,url)=>{
 if(page?.status!==200)throw Object.assign(new Error('Techjays reviewed current publication: HTTP '+page?.status+' for '+url),{status:page?.status})
 requireCurrent(page.url===url,'final document identity changed: '+url)
 const expected=profile.documents.find(document=>document.url===url)
 requireCurrent(expected&&typeof page.html==='string'&&sha(page.html)===expected.sha256,'unreviewed complete original document: '+url)
 const headers=page.responseHeaders??page.headers??{}
 requireCurrent((headers['content-security-policy']??'')===expected.csp
  &&(headers['content-security-policy-report-only']??'')===expected.cspReportOnly,'response CSP changed: '+url)
 return{url,sha256:expected.sha256}
}

// Decode literal Flight packets as data; never evaluate publisher JavaScript.
export const readCurrentNativeJobs=html=>{
 const doc=readNativeDocument(html),chunks=[]
 for(const script of doc.nodes(node=>node.tag==='script'&&!node.attrs.src&&/self\.__next_f/.test(node.raw??''))){
  const source=script.raw,ast=parse(source,{ecmaVersion:'latest'})
  for(const statement of ast.body){
   const call=statement.type==='ExpressionStatement'?statement.expression:null
   requireCurrent(call?.type==='CallExpression'&&call.arguments.length===1,'nonliteral native Flight statement')
   const callee=source.slice(call.callee.start,call.callee.end)
   requireCurrent(['self.__next_f.push','(self.__next_f=self.__next_f||[]).push'].includes(callee),'native Flight carrier changed')
   const argument=JSON.parse(source.slice(call.arguments[0].start,call.arguments[0].end))
   requireCurrent(Array.isArray(argument),'native Flight packet is not an array')
   if(argument[0]===1){requireCurrent(argument.length===2&&typeof argument[1]==='string','native Flight data packet changed');chunks.push(argument[1])}
   else requireCurrent(argument.length===1&&argument[0]===0,'unsupported native Flight packet')
  }
 }
 const flight=chunks.join(''),occurrences=[...flight.matchAll(/"jobs":(\[)/g)]
 requireCurrent(occurrences.length===1,'native unfiltered jobs model is ambiguous or absent')
 const start=occurrences[0].index+'"jobs":'.length
 let depth=0,quoted=false,escaped=false,end=-1
 for(let cursor=start;cursor<flight.length;cursor++){
  const char=flight[cursor]
  if(quoted){if(escaped)escaped=false;else if(char==='\\')escaped=true;else if(char==='"')quoted=false;continue}
  if(char==='"')quoted=true
  else if(char==='['||char==='{')depth++
  else if(char===']'||char==='}'){if(--depth===0){end=cursor+1;break}}
 }
 requireCurrent(end>start,'native jobs model is truncated')
 const jobs=JSON.parse(flight.slice(start,end))
 requireCurrent(jobs.length===profile.roles,'native cohort changed')
 return jobs.map(job=>{
  requireCurrent(JSON.stringify(Object.keys(job).sort())===JSON.stringify(['id','title','slug','department','location','description','applyUrl','updatedAt'].sort()),'native job schema changed')
  requireCurrent(Number.isSafeInteger(job.id)&&job.id>0&&/^[\w-]+$/.test(job.slug)&&typeof job.title==='string'&&job.title.trim(),'native job identity malformed')
  requireCurrent(job.location===null&&job.department===null,'unreviewed native country or department model')
  requireCurrent(/^\$[\da-f]+$/.test(job.description),'native description reference changed')
  const marker=job.description.slice(1)+':T',at=flight.indexOf(marker)
  requireCurrent(at>=0&&flight.indexOf(marker,at+marker.length)===-1,'native full description reference ambiguous')
  const comma=flight.indexOf(',',at+marker.length),length=Number.parseInt(flight.slice(at+marker.length,comma),16)
  requireCurrent(Number.isSafeInteger(length)&&length>0&&length<1024*1024,'native full description byte length invalid')
  const bytes=Buffer.from(flight.slice(comma+1),'utf8').subarray(0,length),description=bytes.toString('utf8')
  requireCurrent(Buffer.byteLength(description)===length&&!description.includes('\uFFFD'),'native full description truncated')
  requireCurrent(job.applyUrl==='https://hireflow.techjays.com/apply/'+job.slug,'native application identity changed')
  return{...job,description}
 })
}

export const readCurrentNativeRole=(page,job)=>{
 const doc=readNativeDocument(page.html,{sourceRanges:true}),article=one(doc.nodes(n=>n.tag==='article'),'active role article')
 const title=doc.text(one(doc.nodes(n=>n.tag==='h1',article),'active role title'))
 const description=one(doc.nodes(n=>doc.hasClass(n,'blog-content'),article),'complete active criteria')
 const schemas=doc.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json').map(n=>JSON.parse(n.raw))
 const schema=one(schemas.filter(value=>value['@type']==='JobPosting'),'native JobPosting')
 const sourceUrl=CAREERS+'/'+job.slug,jobDescription=doc.text(description)
 requireCurrent(title===job.title&&schema.title===job.title&&schema.url===sourceUrl,'title or canonical native role identity changed')
 requireCurrent(schema.hiringOrganization?.name==='Techjays'&&schema.hiringOrganization?.url===HOME
  &&schema.hiringOrganization?.['@id']===HOME+'#organization'&&schema.identifier?.name==='Techjays'
  &&schema.identifier.value===String(job.id),'native employer or numeric identity changed')
 requireCurrent(!Object.hasOwn(schema,'jobLocation')&&!Object.hasOwn(schema,'applicantLocationRequirements')
  &&!Object.hasOwn(schema,'jobLocationType'),'unreviewed native role country or workplace model')
 requireCurrent(jobDescription===norm(job.description)&&doc.text(readNativeDocument(schema.description).nodes(n=>n.tag==='root')[0])===jobDescription,'full native model, JSON-LD and rendered criteria disagree')
 const applications=doc.nodes(n=>n.tag==='a'&&/Apply for this role/.test(doc.text(n)),article)
 requireCurrent(applications.length===2&&applications.every(n=>n.attrs.href===job.applyUrl),'native applications disagree')
 requireCurrent(/^\d{4}-\d{2}-\d{2}$/.test(schema.datePosted),'native publisher date missing or changed')
 const sourceDescription=page.html.slice(description.sourceOpenEnd,description.sourceCloseStart)
 requireCurrent(sourceDescription&&description.sourceCloseStart>description.sourceOpenEnd,'full original criteria HTML unavailable')
 const experience=jobDescription.match(/\b(\d+)\s*\+\s*years?\b/i)
 return{source:'techjays',company:'Techjays',companyDomain:'techjays.com',companyCareerPage:CAREERS,
  jobId:job.slug,requisitionId:String(job.id),title:job.title,sourceUrl,applyUrl:job.applyUrl,link:job.applyUrl,
  country:null,city:null,location:null,remoteStatus:null,postingDate:schema.datePosted,datePosted:schema.datePosted,
  updatedAt:job.updatedAt,jobDescription,sourceDescription,sourceDescriptionRaw:schema.description,
  experienceRequired:experience?experience[1]+'+ years':null,requiredSkills:[],publicExperienceChecked:!experience,
  sourceListingComplete:false,sourceCompanyScopeComplete:false,lifecycleCleanupAllowed:false,scrapedAt:new Date().toISOString()}
}

export const readReviewedCurrentPublication=async({homepage,careers,fetchPage,signal,onDiagnostic})=>{
 const records=[],publications=[homepage,careers],evidence={source:'techjays',profile:profile.profile,completeInventory:false,boardInventoryComplete:false,
  companyScopeComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,records,documents:[],assets:[]}
 const read=async url=>{signal?.throwIfAborted();const page=await fetchPage(url);signal?.throwIfAborted();return page}
 try{
  for(const page of publications)evidence.documents.push(documentEvidence(page,page===homepage?HOME:CAREERS))
  const models=readCurrentNativeJobs(careers.html)
  const board=readNativeDocument(careers.html),cards=board.nodes(n=>n.tag==='a'&&board.hasClass(n,'careers-job-card'))
  requireCurrent(cards.length===models.length&&new Set(cards.map(n=>n.attrs.href)).size===models.length,'not every advertised card was reconciled')
  for(const model of models){
   const card=one(cards.filter(n=>n.attrs.href==='/careers/'+model.slug),'native card for role')
   requireCurrent(board.text(one(board.nodes(n=>n.tag==='h3',card),'card title'))===model.title,'card/model title mismatch')
   const url=CAREERS+'/'+model.slug,page=await read(url)
   evidence.documents.push(documentEvidence(page,url));publications.push(page);records.push(readCurrentNativeRole(page,model))
  }
  const declared=new Set()
  for(const page of publications)for(const node of flatten(readNativeDocument(page.html).nodes(n=>n.tag==='root')[0])){
   const value=node.tag==='script'?node.attrs.src:node.tag==='link'&&node.attrs.rel==='stylesheet'?node.attrs.href:null
   if(value)declared.add(new URL(value,page.url).href)
  }
  requireCurrent(declared.size===profile.assets.length&&profile.assets.every(asset=>declared.has(asset.url)),'declared complete stylesheet/client cohort changed')
  for(const asset of profile.assets){
   const response=await read(asset.url)
   if(response?.status!==200)throw Object.assign(new Error('Techjays reviewed current publication: declared stylesheet/client HTTP '+response?.status+' for '+asset.url),{status:response?.status})
   requireCurrent(response?.status===200&&response.url===asset.url&&sha(response.html)===asset.sha256,'declared stylesheet/client HTTP, identity or original body changed: '+asset.url)
   evidence.assets.push({url:asset.url,sha256:asset.sha256})
  }
  for(const document of evidence.documents)documentEvidence(await read(document.url),document.url)
  evidence.boardInventoryComplete=true
  const diagnostic={source:'techjays',code:'incomplete_location_scope',unknownJobs:records,
   message:records.length+' public Techjays roles have no verified role location; publishing 0 verified India roles while preserving prior vacancies.'}
  onDiagnostic(diagnostic);signal?.throwIfAborted()
  throw Object.assign(new Error(diagnostic.message),{code:diagnostic.code,diagnostic,nativeCollectionEvidence:evidence})
 }catch(error){signal?.throwIfAborted();if(error&&typeof error==='object'&&!error.nativeCollectionEvidence)error.nativeCollectionEvidence=evidence;throw error}
}
