import {readHtml,norm,hasClass,within} from './nativeHtml.js'
export const CORPORATE='https://www.brillio.com/'
export const CAREERS='https://www.brillio.com/careers/'
export const BOARD='https://careers.brillio.com/job-listing/'
export const BOARD_ROOT='https://careers.brillio.com/'
export const API='https://careers.brillio.com/wp-admin/admin-ajax.php'
export const absolute=value=>{try{const u=new URL(value,BOARD);return u.protocol==='https:'?u.href:null}catch{return null}}
export const jobIdFromUrl=value=>{try{const u=new URL(value);return u.hostname==='careers.brillio.com'&&/^\/job-details\/?$/.test(u.pathname)&&/^\d+$/.test(u.searchParams.get('job-id')||'')?u.searchParams.get('job-id'):null}catch{return null}}
export const countryOf=location=>/\bIndia\s*$/i.test(location||'')?'India':/(?:^|,\s*)(United States|US|Mexico|Romania|United Kingdom)\s*$/i.test(location||'')?'foreign':null
const requisition=title=>title?.match(/\bR\d+\s*$/i)?.[0]?.trim()||null
const one=(values,label)=>{if(values.length!==1)throw Error('Brillio native '+label+' missing or ambiguous');return values[0]}
export const listingJobs=html=>{
 const d=readHtml(html),cards=d.find(n=>hasClass(n,'job-listing__item')||hasClass(n,'job-list-wrap'))
 return cards.map(card=>{
  const links=d.within(card,n=>n.tag==='a'&&jobIdFromUrl(absolute(n.attrs.href))),urls=[...new Set(links.map(n=>absolute(n.attrs.href)))]
  if(urls.length!==1)throw Error('Brillio native card posting identity missing or conflicting')
  const detailUrl=urls[0],title=d.text(one(d.within(card,n=>n.tag==='h4'&&(hasClass(n,'title')||hasClass(card,'job-list-wrap'))),'card title'))
  const info=d.within(card,n=>hasClass(n,'infoline'))[0],spans=info?d.within(info,n=>n.tag==='span'):[]
  const location=d.text(d.within(card,n=>hasClass(n,'location'))[0])||d.text(spans[0])
  const summary=d.text(d.within(card,n=>hasClass(n,'description'))[0],{exclude:n=>n.tag==='a'})||d.text(d.within(card,n=>n.tag==='p'&&!within(info,n))[0])
  return{detailUrl,jobId:jobIdFromUrl(detailUrl),title,location,department:d.text(spans[1]),requisitionId:d.text(spans[2])||requisition(title),summary,nativePills:d.within(card,n=>hasClass(n,'info-pills')).map(n=>d.text(n)),visibilityUncertain:card.uncertain||d.within(card,n=>n.uncertain,{includeHidden:true}).length>0}
 })
}
export const pagination=(html,page)=>{
 const d=readHtml(html),current=d.find(n=>n.attrs['aria-current']==='page'),links=d.find(n=>n.tag==='a'&&n.attrs.href)
 if(current.length!==1||Number(d.text(current[0]))!==page)throw Error('Brillio native pagination current page mismatch')
 const pages=[page]
 for(const link of links){const u=new URL(link.attrs.href,API),n=Number(u.searchParams.get('paged'));if(u.hostname!=='careers.brillio.com'||!['/wp-admin/admin-ajax.php','/job-listing/'].includes(u.pathname)||!Number.isInteger(n)||n<1||n>1000)throw Error('Brillio native pagination link is unqualified');pages.push(n)}
 return{page,lastPage:Math.max(...pages),hasNext:pages.some(n=>n===page+1)}
}
export const searchBody=page=>new URLSearchParams({action:'filter_jobs',job_title:'',country:'',jobpost:'all',hybrid:'0',onsite:'0',remote:'0',paged:String(page)}).toString()
export const isExactNativeHandoff=(value,expected,base=expected)=>{
 try{
  const url=new URL(value,base),target=new URL(expected)
  return !url.username&&!url.password&&!url.search&&!url.hash&&url.origin===target.origin&&url.pathname.replace(/\/$/,'')===target.pathname.replace(/\/$/,'')
 }catch{return false}
}
export const validateCorporate=(html,expected,alternatives=[])=>{
 const d=readHtml(html),targets=[expected,...alternatives]
 for(const target of targets){
  if(d.find(n=>n.tag==='a'&&n.attrs.href&&isExactNativeHandoff(n.attrs.href,target,expected)).length)return target
 }
 throw Error('Brillio current corporate careers handoff missing')
}
export const validateClient=html=>{
 const d=readHtml(html),scripts=d.find(n=>n.tag==='script'&&!n.attrs.src).map(n=>n.raw||'').join('\n')
 if(!d.find(n=>n.tag==='form'&&n.attrs.id==='job-filter-form').length||!scripts.includes(API)||!/(?:type|method)\s*:\s*["']POST["']/i.test(scripts)||!/action\s*:\s*["']filter_jobs["']/.test(scripts)||!['job_title','country','jobpost','hybrid','onsite','remote','paged'].every(k=>new RegExp('\\b'+k+'\\s*:').test(scripts))||!/response\.data\.html/.test(scripts)||!/response\.data\.pagination/.test(scripts))throw Error('Brillio current readonly search client contract missing')
}
export const jobDetail=(html,{jobId=null}={})=>{
 const d=readHtml(html),modern=d.find(n=>hasClass(n,'job-detail__item')),legacy=d.find(n=>hasClass(n,'_detail-content')),scope=(modern.length===1?modern:legacy)[0]
 const blank={title:null,applyUrl:null,requiredSkills:[],jobDescription:null,location:null,postingDate:null,closingDate:null,remoteStatus:null,employmentType:null,sourceDetailComplete:false,sourceDetailFailureKind:'native-detail-scope-missing',sourceDocumentDates:[],sourceNativeStructuredCriteria:[],sourceRoleWorksiteStatements:[]}
 if(!scope||modern.length>1||legacy.length>1)return blank
 const primaryTitles=d.within(scope,n=>n.tag==='h1'&&hasClass(n,'title'))
 const titleNodes=primaryTitles.length?primaryTitles:d.within(scope,n=>n.tag==='h1'),title=titleNodes.length===1?d.text(titleNodes[0]):null
 const location=d.text(d.within(scope,n=>hasClass(n,'location'))[0])
 const applyCandidates=d.find(n=>n.tag==='a'&&/^apply(?: now)?$/i.test(d.text(n)||'')),applyUrls=[...new Set(applyCandidates.map(n=>absolute(n.attrs.href)).filter(Boolean))]
 const validApply=applyUrls.filter(value=>{const u=new URL(value);return u.hostname==='careers.brillio.com'&&/^\/privacy-notice\/?$/.test(u.pathname)&&u.searchParams.get('job-id')===jobId&&[...u.searchParams.keys()].every(k=>k==='job-id')})
 const applyUrl=validApply.length===1&&applyUrls.length===1?validApply[0]:null
 const exclude=n=>n===titleNodes[0]||hasClass(n,'location')||hasClass(n,'info-group')||hasClass(n,'info-pills')||n.tag==='a'&&/^apply(?: now)?$/i.test(d.text(n)||'')
 const section=d.find(n=>hasClass(n,'job-detail')&&within(n,scope))[0]
 const outsideCriteria=section?d.text(section,{exclude:n=>n===scope||hasClass(n,'job-detail__highlight')||n.tag==='a'&&applyUrl&&absolute(n.attrs.href)===applyUrl&&/^apply(?: now)?$/i.test(d.text(n)||'')}):null
 const jobDescription=norm([d.text(scope,{exclude}),outsideCriteria].filter(Boolean).join(' '))
 const sourceRoleWorksiteStatements=[]
 const headings=d.within(scope,n=>/^h[1-6]$/.test(n.tag))
 for(const node of d.within(scope,n=>['p','li','div'].includes(n.tag))){
  const text=d.text(node)
  if(!/^(?:Location:|This position is based in\b)/i.test(text||''))continue
  const previousHeading=headings.filter(heading=>d.nodes.indexOf(heading)<d.nodes.indexOf(node)).at(-1)
  const companyContext=/^(?:About\s+(?:Brillio|(?:the\s+)?(?:company|client|employer))|Headquarters?|Client(?:\s+(?:information|profile|details))?|Company(?:\s+(?:information|profile|details))?)$/i.test(d.text(previousHeading)||'')
  if(/^Location:/i.test(text)&&companyContext)continue
  if(!sourceRoleWorksiteStatements.includes(text))sourceRoleWorksiteStatements.push(text)
 }
 const skills=d.within(scope,n=>/^h[1-6]$/.test(n.tag)&&/^Primary Skills$/i.test(d.text(n)||''))
 const requiredSkills=[]
 for(const heading of skills){const siblings=heading.parent.children,index=siblings.indexOf(heading);const next=siblings.slice(index+1).find(n=>typeof n!=='string');if(next?.tag==='ul')requiredSkills.push(...(d.text(next)||'').split(',').map(norm).filter(Boolean))}
 const sourceDocumentDates=d.find(n=>n.tag==='meta'&&['article:published_time','article:modified_time'].includes(n.attrs.property),{includeHidden:true}).map(n=>({kind:n.attrs.property,value:n.attrs.content}))
 const sourceNativeStructuredCriteria=[];let structuredInvalid=false
 for(const script of d.nodes.filter(n=>n.tag==='script'&&n.attrs.type==='application/ld+json'&&!n.attrs.src)){
  // Head JSON-LD is active structured data; template/hidden JSON-LD is not.
  let ancestor=script.parent,inert=false;while(ancestor){if(ancestor.tag!=='head'&&ancestor.ownHidden)inert=true;ancestor=ancestor.parent}if(inert)continue
  try{const visit=value=>{if(!value||typeof value!=='object')return;if([].concat(value['@type']||[]).includes('JobPosting'))sourceNativeStructuredCriteria.push(value);for(const child of Object.values(value))if(typeof child==='object')Array.isArray(child)?child.forEach(visit):visit(child)};visit(JSON.parse(script.raw))}catch{structuredInvalid=true}
 }
 const hiddenCriteria=d.within(scope,n=>n.hidden&&n.tag!=='script'&&n.tag!=='style'&&n.children.some(c=>typeof c==='string'&&c.trim()),{includeHidden:true}).length>0
 const uncertain=scope.uncertain||d.within(scope,n=>n.uncertain,{includeHidden:true}).length>0
 const closed=/\b(?:this (?:job|position|vacancy) (?:is |has been )?(?:closed|filled|expired)|no longer (?:accepting applications|available)|applications? (?:are )?closed)\b/i.test(d.text(scope)||'')
 const full=Boolean(title&&jobDescription&&applyUrl&&!outsideCriteria&&!uncertain&&!hiddenCriteria&&!structuredInvalid&&!sourceNativeStructuredCriteria.length&&!/\.{2,}\s*$|…\s*$/.test(jobDescription)&&!closed)
 return{...blank,title,location,applyUrl,requiredSkills,jobDescription,sourceRoleWorksiteStatements,sourceDetailComplete:full,sourceDetailFailureKind:full?null:closed?'native-role-closed':!applyUrl?'native-application-identity-unresolved':sourceNativeStructuredCriteria.length||structuredInvalid?'native-structured-criteria-unresolved':uncertain||hiddenCriteria?'native-visibility-unresolved':'native-description-incomplete',sourceDocumentDates,sourceNativeStructuredCriteria,sourceNativeAvailability:closed?'closed':applyUrl?'listed-with-native-apply':'unknown'}
}
