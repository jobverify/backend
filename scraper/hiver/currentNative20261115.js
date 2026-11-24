import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {types} from 'node:util'
import {setTimeout as delay} from 'node:timers/promises'
import {boundedDeclaredPublicRead} from '../../scraper-support/native-sources/boundedDeclaredPublicRead.js'
import {readNativeDocument,decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {parseBoundedProgram,parseRemoteLiteral} from '../../scraper-support/utils/remoteScriptData.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

export const HIVER_CORPORATE='https://hiverhq.com/careers'
export const HIVER_BOARD='https://hiverhq.pinpointhq.com/'
export const HIVER_FEED=HIVER_BOARD+'postings.json'
export const HIVER_ROLE=HIVER_BOARD+'en/postings/64a310b6-2717-4478-bd32-d299502f5e89'
const RICH='External::Careerspage::Renderrichtrixcontent',UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/
const FIELDS=['description','key_responsibilities','skills_knowledge_expertise','benefits']
const CORPORATE_HIRING=JSON.parse(fs.readFileSync(new URL('./reviewedCorporateHiring20261120.json',import.meta.url),'utf8'))
const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
export const currentHiverSHA=value=>createHash('sha256').update(value).digest('hex')
const norm=value=>String(value??'').replace(/\s+/g,' ').trim(),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
const problem=message=>Object.assign(Error('Hiver current native: '+message),{softFailure:true,abortRetries:true,failureKind:'coverage_gap',sourceScopeComplete:false,lifecycleCleanupAllowed:false})
const need=(value,label)=>{if(!value)throw problem(label)}
const one=(values,label)=>{need(values.length===1,'missing or ambiguous '+label);return values[0]}
const all=node=>[node,...node.children.filter(v=>typeof v!=='string').flatMap(all)]
const rootOf=document=>one(document.nodes(n=>n.tag==='root'),'document root')
const plain=value=>value&&typeof value==='object'&&!Array.isArray(value)
const keys=(value,expected,label)=>need(plain(value)&&same(Object.keys(value).sort(),[...expected].sort()),'unreviewed complete '+label+' fields')
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const count=(source,value)=>source.split(value).length-1
export const strictHiverJSON=source=>{try{JSON.parse(source);return parseRemoteLiteral(source)}catch{throw problem('malformed or duplicate decoded native JSON')}}
const propertyNode=(raw,path)=>{
 let node
 try{node=parseBoundedProgram('('+raw+')').body[0].expression}catch{throw problem('native literal program shape changed')}
 for(const key of path){
  if(typeof key==='number'){need(node.type==='ArrayExpression'&&node.elements[key],'missing complete native array criterion');node=node.elements[key]}
  else{need(node.type==='ObjectExpression','native criterion parent is not literal object');node=one(node.properties.filter(p=>p.type==='Property'&&!p.computed&&(p.key.name??p.key.value)===key),'native '+key+' property').value}
 }
 need(node.type==='Literal'&&typeof node.value==='string','native criterion is not an original string literal')
 return{start:node.start-1,end:node.end-1,value:node.value}
}
const nonceOf=headers=>{
 const policy=headers['content-security-policy'];need(typeof policy==='string','native CSP missing')
 const token=one([...policy.matchAll(/'nonce-([a-f0-9]{32})'/g)],'CSP anonymous nonce')[1]
 need(count(policy,token)===1,'unbound CSP nonce occurrence');return token
}
const critical=['content-type','content-disposition','content-security-policy','content-security-policy-report-only','refresh','link','location','content-location','x-content-type-options','x-frame-options','permissions-policy','referrer-policy','cache-control','vary','access-control-allow-origin','access-control-allow-headers','access-control-allow-methods','cross-origin-resource-policy','x-pinpoint-version','set-cookie']
export function currentHiverHeaders(packet,profile){
 const headers=Object.fromEntries(Object.entries(packet.headers).map(([k,v])=>[k.toLowerCase(),v])),result=Object.fromEntries(critical.map(k=>[k,headers[k]??null])),native=new URL(packet.requestedURL).hostname==='hiverhq.pinpointhq.com'
 if(native){
  const token=nonceOf(headers);result['content-security-policy']=result['content-security-policy'].replace(token,'CURRENT_NATIVE_NONCE')
  const cookie=headers['set-cookie'],match=typeof cookie==='string'&&/^_pinpoint_session=([A-Za-z0-9%+/_=-]{100,4096}); domain=\.pinpointhq\.com; path=\/; expires=([^;]+); secure; HttpOnly; SameSite=None$/.exec(cookie)
  need(match&&Number.isFinite(Date.parse(headers.date))&&new Date(match[2]).toUTCString()===match[2]&&Date.parse(match[2])-Date.parse(headers.date)===604800000,'native issued anonymous session attributes/expiry changed')
  result['set-cookie']='_pinpoint_session=CURRENT_ISSUED_ANONYMOUS_SESSION; domain=.pinpointhq.com; path=/; expires=HTTP_DATE_PLUS_SEVEN_DAYS; secure; HttpOnly; SameSite=None'
 }
 if(packet.requestedURL===HIVER_CORPORATE){
  if(profile?.corporate.cacheMode==='reviewed-native-no-batcache-20261116'){
   const absent=['cache-control','last-modified','x-nananana'].every(key=>headers[key]===undefined)
   if(absent)return result
   need(['cache-control','last-modified','x-nananana'].every(key=>typeof headers[key]==='string'),'corporate reviewed cache header model changed')
  }
  need(/^max-age=(?:\d{1,3}), must-revalidate$/.test(headers['cache-control']??'')&&Number(headers['cache-control'].match(/\d+/)[0])<=300,'corporate cache context changed')
  result['cache-control']='max-age=CURRENT_BOUND_BATCACHE_REMAINING, must-revalidate'
 }
 return result
}
// These are authority topics, not recognized sentence forms or foreign-value
// lists. If a whole authored block discusses one, its entire original text
// remains bound to the reviewed context. No subject, prefix, issuer verb or
// inferred country/entity/date can make a changed authority block acceptable.
const employmentAuthority=/\bemploy(?:s|er|ers|ed|ing|ment|ments)?\b/iu
const applicationTimingAuthority=/\b(?:deadlines?|closing|expiry|expiration|cutoff|cut[\s-]off|due|last\s+date|valid\s+(?:until|through)|no\s+later\s+than)\b/iu
const authorityTopics=[
 employmentAuthority,
 /\b(?:employees?|hir(?:e|es|ed|ing)|appoint(?:s|ed|ing|ment|ments)?|contract(?:s|ed|ing|ual|or|ors)?|agreements?|offers?|payroll|onboard(?:ed|ing)?|compan(?:y|ies)|organi[sz]ations?|entit(?:y|ies)|requisitions?|vacanc(?:y|ies)|join)\b/iu,
 /\b(?:reside|resides|resided|residing|residenc(?:e|es|y)|residential|residents?|domicil\p{L}*|live|lives|living|citizenship|nationality|visas?|sponsorship|workplaces?|worksites?|locations?|countr(?:y|ies)|jurisdictions?|territor(?:y|ies)|addresses?|remote(?:ly)?|hybrid|on[\s-]?site|relocat(?:e|es|ed|ing|ion|ions)|bases?|based|located|situated|assign(?:s|ed|ing|ment|ments)?|station(?:ed|s)?|duty)\b/iu,
 applicationTimingAuthority,
 /\b(?:applications?|apply|applies|submi(?:t|ts|tted|tting|ssion|ssions)|materials?|forms?|documents?)\b/iu,
 /(?<![\p{L}\p{N}_])(?:cvs?|r[eé]sum[eé]s?|curricul(?:um|a)\s+vitae|cover[\s-]+letters?)(?![\p{L}\p{N}_])/iu,
]
const workRelations=new Set(['for','in','at','from','outside','within','across','place','base','site','station']),applicationTimeRelations=new Set(['by','until','till','through','within','between','on','before','after'])
function applyingTimeBlock(words){let applying=false;for(const word of words){if(word==='applying')applying=true;else if(applying&&applicationTimeRelations.has(word))return true}return false}
function authorityBlock(block){
 if(authorityTopics.some(pattern=>pattern.test(block)))return true
 const words=block.toLowerCase().match(/\p{L}+/gu)??[]
 if(words.some(w=>w==='work'||w==='working')&&words.some(w=>workRelations.has(w)))return true
 // A gerund in an ordinary prerequisite is not itself a submission declaration.
 // Bind a scheduling relation that follows that action anywhere in the block.
 return applyingTimeBlock(words)
}
const closure=/\b(?:(?:(?:this|the)\s+)?(?:job|role|position|vacancy|opening|opportunity)\s+(?:(?:is|was|are|were|has|have|been|now|currently|already|permanently|temporarily)\s+)*(?:closed|filled|withdrawn|cancelled|canceled|expired|removed|unavailable|not\s+(?:(?:currently|now)\s+)?available|no\s+longer\s+(?:available|active|open))|(?:no\s+longer|not(?:\s+currently)?)\s+accepting\s+(?:(?:any|new)\s+)?applications|(?:applications|recruitment|hiring)\s+(?:for\s+(?:(?:this|the)\s+)?(?:role|position|job|vacancy)\s+)?(?:(?:is|was|are|were|has|have|been|now|currently|already|permanently|temporarily)\s+)*(?:closed|ended|stopped|suspended|unavailable))\b/i
export function currentHiverRichText(html){
 need(typeof html==='string'&&html.length>0&&html.length<=100000&&!/[\u0000-\u0008\u000b\u000e-\u001f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/.test(html),'blank, nonstring, oversized or unsupported native criterion text')
 need([...html.matchAll(/<!--[\s\S]*?-->/g)].every(m=>m[0]==='<!--block-->')&&!/<!\s*(?!\s*--block-->)/i.test(html),'unreviewed native criterion comment/declaration')
 const document=readNativeDocument(html),root=rootOf(document),nodes=all(root),allowed=new Set(['root','div','p','br','strong','b','em','i','ul','ol','li','h1','h2','h3','h4','h5','h6'])
 need(nodes.every(n=>!n.inert&&allowed.has(n.tag)&&Object.keys(n.attrs).length===0),'unreviewed native criterion attribute, hiding, control, link or tag')
 const text=document.text(root);need(text.length>0&&!closure.test(text),'blank or explicitly unavailable native criterion')
 const blocks=[],blockTags=new Set(['div','p','li','h1','h2','h3','h4','h5','h6'])
 const walk=node=>{let group=[];const flush=()=>{const value=norm(group.join(' '));if(value)blocks.push(value);group=[]};for(const child of node.children){if(typeof child!=='string'&&all(child).some(n=>blockTags.has(n.tag))){flush();walk(child)}else group.push(typeof child==='string'?decodeNativeEntities(child):document.text(child))}flush()};walk(root)
 return{text,authority:blocks.filter(authorityBlock)}
}
function normalizedImage(value,headers){
 let u;try{u=new URL(value)}catch{throw problem('unqualified passive native image URL')}
 const expected=['response-content-disposition','response-content-type','X-Amz-Algorithm','X-Amz-Credential','X-Amz-Date','X-Amz-Expires','X-Amz-SignedHeaders','X-Amz-Signature']
 need(u.protocol==='https:'&&u.hostname==='pinpoint-production.s3.eu-west-2.amazonaws.com'&&u.pathname==='/pd2uomwny6htdxkrsq18ntuki8ck'&&!u.port&&!u.hash&&!u.username&&!u.password&&same([...u.searchParams.keys()],expected),'passive native image object, scope or query changed')
 const date=u.searchParams.get('X-Amz-Date'),signature=u.searchParams.get('X-Amz-Signature'),credential=u.searchParams.get('X-Amz-Credential'),match=/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(date??'')
 need(match&&/^[a-f0-9]{64}$/.test(signature??'')&&credential==='AKIAZ72V7A3MWSAEYREG/'+date.slice(0,8)+'/eu-west-2/s3/aws4_request','passive native image anonymous signing model changed')
 const time=new Date(Date.UTC(...match.slice(1).map(Number).map((v,i)=>i===1?v-1:v)))
 need(time.toISOString().replace(/[-:]|\.000/g,'')===date&&Number.isFinite(Date.parse(headers.date))&&Date.parse(headers.date)-time.getTime()>=0&&Date.parse(headers.date)-time.getTime()<=300000,'invalid passive image UTC calendar/fresh response binding')
 need(u.searchParams.get('response-content-disposition')==='inline; filename="open_graph.png"; filename*=UTF-8\'\'open_graph.png'&&u.searchParams.get('response-content-type')==='image/png'&&u.searchParams.get('X-Amz-Algorithm')==='AWS4-HMAC-SHA256'&&u.searchParams.get('X-Amz-Expires')==='300'&&u.searchParams.get('X-Amz-SignedHeaders')==='host','passive native image fixed response/signing fields changed')
 return value.replace('X-Amz-Credential='+encodeURIComponent(credential),'X-Amz-Credential='+encodeURIComponent('AKIAZ72V7A3MWSAEYREG/CURRENT_IMAGE_DAY/eu-west-2/s3/aws4_request')).replace('X-Amz-Date='+date,'X-Amz-Date=CURRENT_IMAGE_UTC').replace('X-Amz-Signature='+signature,'X-Amz-Signature=CURRENT_IMAGE_SIGNATURE')
}
const corporateCondition=block=>closure.test(block)||employmentAuthority.test(block)
 ||applicationTimingAuthority.test(block)&&/\b(?:applications?|apply|applies|applying)\b/iu.test(block)||applyingTimeBlock(block.toLowerCase().match(/\p{L}+/gu)??[])
 ||/\b(?:applicants?|candidates?|eligib(?:le|ility)|qualifications?|requirements?|certifications?|prerequisites?|must|required|deadlines?|closing|sponsorship|visas?|payroll)\b/i.test(block)
 ||/\b(?:apply|applications?|submit|send)\b.*(?:\b(?:resume|r[e\u00e9]sum[e\u00e9]|cv|applications?|materials?|documents?|form|by|before|until|email)\b|@)/i.test(block)
 ||/\b(?:all|these|our|the)\s+(?:jobs|roles|positions|openings|employees|candidates)\b.*\b(?:based|located|must|require|reside|work|remote|hybrid|outside|within|country)\b/i.test(block)
function corporateProjection(html,nodes,document){
 const title=one(nodes.filter(n=>n.tag==='title'),'own corporate careers title')
 need(/^Hiver(?:\u2122)?\s*\|\s*Hiver Careers$/.test(norm(decodeNativeEntities(title.raw??document.text(title)))),'own corporate careers identity changed')
 const canonical=one(nodes.filter(n=>n.tag==='link'&&n.attrs.rel==='canonical'),'own corporate careers canonical')
 need(!canonical.inert&&canonical.attrs.href===HIVER_CORPORATE,'own corporate careers canonical changed')
 const typed=[]
 const inspect=value=>{if(!value||typeof value!=='object')return;if([value['@type']].flat().some(type=>['JobPosting','http://schema.org/JobPosting','https://schema.org/JobPosting'].includes(type)))typed.push(value);for(const v of Object.values(value))if(v&&typeof v==='object')Array.isArray(v)?v.forEach(inspect):inspect(v)}
 for(const node of nodes.filter(n=>n.tag==='script'&&n.attrs.type==='application/ld+json'))inspect(strictHiverJSON(node.raw))
 need(typed.length===0,'new own corporate typed vacancy publication requires review')
 const conditionBlocks=[],blockTags=new Set(['root','html','body','div','p','li','h1','h2','h3','h4','h5','h6','blockquote','section','article','main','header','footer','aside','nav','form','table','thead','tbody','tr','td','th'])
 const walk=node=>{
  if(node.inert||['head','script','style'].includes(node.tag))return
  let group=[]
  const flush=()=>{const value=norm(group.join(' '));if(value&&corporateCondition(value))conditionBlocks.push(value);group=[]}
  for(const child of node.children??[]){
   if(typeof child!=='string'&&all(child).some(n=>!n.inert&&blockTags.has(n.tag))){flush();walk(child)}
   else group.push(typeof child==='string'?decodeNativeEntities(child):document.text(child))
  }
  flush()
 }
 walk(one(nodes.filter(n=>n.tag==='root'),'corporate authored root'))
 const conditions=[...new Set(conditionBlocks)].sort()
 need(same(conditions,CORPORATE_HIRING.conditions),'new or changed corporate authored hiring conditions require qualification')
 const visible=readVisibleNativeDocument(html,{strict:true})
 const links=nodes.filter(n=>n.tag==='a'&&document.text(n)==='See our open positions')
 const pathTo=(node,target)=>{if(node===target)return[node];for(const child of node.children??[]){if(typeof child==='string')continue;const found=pathTo(child,target);if(found)return[node,...found]}return null}
 const active=node=>!node.inert&&!node.nativeTagUnqualified&&!Object.hasOwn(node.attrs,'hidden')&&node.attrs['aria-hidden']!=='true'&&!/(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*(?:hidden|collapse))\s*(?:!important)?(?:;|$)/i.test(node.attrs.style??'')
 const root=one(nodes.filter(n=>n.tag==='root'),'corporate root')
 need(links.length>0&&links.length<=10&&links.every(n=>n.attrs.href===HIVER_BOARD&&pathTo(root,n)?.every(active)),'current active exact corporate native handoff unavailable')
 need(visible.nodes(n=>n.tag==='a'&&n.attrs.href===HIVER_BOARD&&visible.text(n)==='See our open positions').length===links.length,'current corporate native handoff is hidden or unqualified')
 // These are authored recruitment declarations. Browser programs and decorative
 // styles do not grant or revoke the independently hydrated native job facts.
 return JSON.stringify({canonical:HIVER_CORPORATE,publisher:'Hiver',hiringConditions:conditions,handoffs:links.map(n=>({href:n.attrs.href,label:document.text(n)}))})
}
export function currentHiverDocument(packet,profile){
 const html=new TextDecoder('utf-8',{fatal:true}).decode(Buffer.from(packet.bodyBase64,'base64')),document=readNativeDocument(html),root=rootOf(document),nodes=all(root)
 need(!nodes.some(n=>n.tag==='base'),'unreviewed current native base URL context')
 let context=html;const components=[],replacements=[],authority=[]
 if(packet.requestedURL===HIVER_CORPORATE)context=corporateProjection(html,nodes,document)
 else{
  const token=nonceOf(packet.headers),nonceMeta=one(nodes.filter(n=>n.tag==='meta'&&n.attrs.name==='csp-nonce'),'native CSP meta'),nonceNodes=nodes.filter(n=>Object.hasOwn(n.attrs,'nonce'))
  need(nonceMeta.attrs.content===token&&nonceNodes.every(n=>n.tag==='script'&&n.attrs.nonce===token)&&count(html,token)===nonceNodes.length+1,'native CSP/header/HTML nonce carrier disagreement')
  context=context.replaceAll(token,'CURRENT_NATIVE_NONCE')
  const csrf=one(nodes.filter(n=>n.tag==='meta'&&n.attrs.name==='csrf-token'),'native anonymous CSRF meta'),parameter=one(nodes.filter(n=>n.tag==='meta'&&n.attrs.name==='csrf-param'),'native anonymous CSRF parameter')
  need(parameter.attrs.content==='authenticity_token'&&/^[A-Za-z0-9+/]{86}==$/.test(csrf.attrs.content??'')&&Buffer.from(csrf.attrs.content,'base64').length===64&&Buffer.from(csrf.attrs.content,'base64').toString('base64')===csrf.attrs.content&&count(html,csrf.attrs.content)===1,'native anonymous CSRF carrier/model changed')
  context=context.replace(csrf.attrs.content,'CURRENT_NATIVE_CSRF')
  const images=nodes.filter(n=>n.tag==='meta'&&(n.attrs.property==='og:image'||n.attrs.name==='twitter:image'));need(images.length===2&&images[0].attrs.content===images[1].attrs.content,'native passive image carriers disagree')
  const image=images[0].attrs.content,stableImage=normalizedImage(image,packet.headers),rawImage=image.replaceAll('&','&amp;')
  need(count(html,rawImage)===2,'unbound passive image URL occurrence');context=context.replaceAll(rawImage,stableImage.replaceAll('&','&amp;'))
  const seen=new Set()
  for(const script of nodes.filter(n=>n.tag==='script'&&n.attrs.class==='js-react-on-rails-component')){
   const name=script.attrs['data-component-name'],id=script.attrs['data-dom-id'],prefix=name+'-react-component-'
   keys(script.attrs,['type','class','data-component-name','data-dom-id'],'native component carrier')
   need(!script.inert&&script.attrs.type==='application/json'&&typeof name==='string'&&id.startsWith(prefix)&&UUID.test(id.slice(prefix.length))&&!seen.has(id)&&count(html,id)===2,'native component execution mode/unique generated ID changed');seen.add(id)
   const target=one(nodes.filter(n=>n.attrs.id===id),'native component target')
   need(target.tag==='div'&&!target.inert&&target.children.every(n=>typeof n==='string'&&!n.trim()),'native component target is not a unique active empty owner')
   const model=strictHiverJSON(script.raw),index=components.length;components.push({name,id,attrs:script.attrs,model,raw:script.raw})
   context=context.replaceAll(id,name+'-CURRENT_BOUND_COMPONENT_'+index)
   const paths=[]
   if(name===RICH)paths.push(['htmlString'])
   if(name==='External::Jobs::Stagescarousel'){
    need(Array.isArray(model.stages)&&model.stages.length===(profile.role.stageCount??4),'native authored hiring conditions count changed')
    model.stages.forEach((stage,i)=>{keys(stage,['externalName','description'],'native hiring stage');paths.push(['stages',i,'description'])})
   }
   if(paths.length){
    need(count(html,script.raw)===1,'ambiguous native rich component raw body');let raw=script.raw
    const changes=paths.map(path=>{const node=propertyNode(script.raw,path),content=currentHiverRichText(node.value);authority.push({component:index,path,blocks:content.authority});return{...node,marker:'CURRENT_COMPLETE_CRITERION_'+index+'_'+path.join('_')}}).sort((a,b)=>b.start-a.start)
    for(const item of changes)raw=raw.slice(0,item.start)+JSON.stringify(item.marker)+raw.slice(item.end)
    replacements.push({before:script.raw,after:raw})
   }
  }
  if(packet.requestedURL===(profile.role?.rowStable?.url??HIVER_ROLE)){
   const schema=one(nodes.filter(n=>n.tag==='script'&&n.attrs.type==='application/ld+json'),'own current JobPosting'),model=strictHiverJSON(schema.raw)
   need(!schema.inert&&!Object.hasOwn(schema.attrs,'src')&&model['@type']==='JobPosting','unqualified current own typed JobPosting')
   const field=propertyNode(schema.raw,['description']),content=currentHiverRichText(field.value);authority.push({schema:'JobPosting.description',blocks:content.authority})
   need(count(html,schema.raw)===1,'ambiguous native JobPosting body');replacements.push({before:schema.raw,after:schema.raw.slice(0,field.start)+JSON.stringify('CURRENT_COMPLETE_NATIVE_SCHEMA_CRITERIA')+schema.raw.slice(field.end)})
  }
  for(const r of replacements){need(count(context,r.before)===1,'native projected rich field collides with another carrier');context=context.replace(r.before,r.after)}
 }
 return{document,nodes,components,originalHTML:html,contextProjection:context,contextSHA256:currentHiverSHA(context+'\nFULL_CRITERION_AUTHORITY\n'+JSON.stringify(authority)),headerContext:currentHiverHeaders(packet,profile),authority}
}
export function currentHiverRowStable(row){const value=structuredClone(row);for(const field of FIELDS)value[field]='CURRENT_COMPLETE_NATIVE_'+field;return value}
export function currentHiverPostingStable(model){return{...model,description:'CURRENT_COMPLETE_NATIVE_SCHEMA_CRITERIA'}}
function qualifyRole(row,detail,profile,clock){
 const roleURL=profile.role.rowStable.url
 const schema=one(detail.nodes.filter(n=>n.tag==='script'&&n.attrs.type==='application/ld+json'),'own JobPosting'),model=strictHiverJSON(schema.raw)
 need(same(currentHiverPostingStable(model),profile.role.jobPostingStable)&&same(currentHiverRowStable(row),profile.role.rowStable),'native complete role identity/employer/country/date/metadata changed')
 const posted=Date.parse(model.datePosted);need(Number.isFinite(posted)&&new Date(posted).toISOString().replace('.000Z','+00:00')===model.datePosted&&posted<=Date.parse(clock),'invalid or future native source publication date')
 need(model['@context']==='http://schema.org'&&model.hiringOrganization?.['@type']==='Organization'&&model.hiringOrganization.name==='Hiver'&&model.hiringOrganization.url==='https://hiverhq.com'&&model.hiringOrganization.sameAs==='https://hiverhq.com','current original native employer binding changed')
 need(model.jobLocation?.['@type']==='Place'&&model.jobLocation.address?.['@type']==='PostalAddress'&&model.jobLocation.address.addressCountry==='IN'&&model.applicantLocationRequirements?.['@type']==='Country'&&model.applicantLocationRequirements.name==='India','typed native workplace/applicant country unavailable or conflicting')
 need(row.id===profile.role.postingID&&row.job.id===profile.role.rowStable.job.id&&row.job.requisition_id===profile.role.rowStable.job.requisition_id&&row.url===roleURL&&row.path===new URL(roleURL).pathname&&roleURL===HIVER_BOARD+'en/postings/'+model.identifier.value&&row.title===model.title&&row.deadline_at===null,'native distinct posting/job/requisition/application identity changed')
 const fields=profile.role.criteriaFields??FIELDS,empty=profile.role.emptyCriterionFields??{}
 need(FIELDS.every(field=>fields.includes(field)?typeof row[field]==='string'&&row[field].trim().length>0:same(row[field],empty[field])),'native authored criterion section presence changed')
 const contents=detail.components.filter(c=>c.name===RICH);need(contents.length===fields.length,'native full criterion section count changed')
 for(const [index,field]of fields.entries()){
  const original=currentHiverRichText(row[field]),component=currentHiverRichText(contents[index].model.htmlString)
  need(original.text===component.text&&original.text.length>=100,'native complete feed/own criterion field mismatch or truncated section')
 }
 const department=row.job.department.name,headers=['Description',row.key_responsibilities_header,row.skills_knowledge_expertise_header,row.benefits_header]
 let html='<h1>'+escape(row.title)+'</h1><p><strong>Department: </strong>'+escape(department)+'</p><p><strong>Employment Type: </strong>'+escape(row.employment_type_text)+'</p><p><strong>Location: </strong>'+escape(row.location.name)+'</p>'+(row.reporting_to?'<p><strong>Reporting To: </strong>'+escape(row.reporting_to)+'</p>':'')
 for(const [index,field]of FIELDS.entries())if(fields.includes(field))html+='<h3>'+escape(headers[index])+'</h3>'+row[field]
 need(currentHiverRichText(html).text===currentHiverRichText(model.description).text,'complete native typed criteria do not equal all four original authored sections and role fields')
 html+='<h2>Workplace type</h2><p>'+escape(row.workplace_type_text)+'</p><h2>About Hiver</h2><p>'+escape(profile.role.aboutHiver)+'</p>'
 const stage=one(detail.components.filter(c=>c.name==='External::Jobs::Stagescarousel'),'native full hiring conditions').model
 need(stage.jobId===Number(profile.role.rowStable.job.id)&&stage.isPreview===false&&stage.title==='Our Hiring Process'&&stage.stageName==='Stage','native hiring conditions preview/job identity changed')
 html+='<h2>'+escape(stage.title)+'</h2>'
 for(const item of stage.stages){currentHiverRichText(item.description);html+='<h3>'+escape(item.externalName)+'</h3>'+item.description}
 const apply=detail.nodes.filter(n=>n.tag==='a'&&detail.document.text(n)==='Apply Now'),url=roleURL+'/applications/new'
 need(apply.length===2&&apply.every(n=>!n.inert&&!Object.hasOwn(n.attrs,'disabled')&&n.attrs['aria-disabled']!=='true'&&new URL(n.attrs.href,roleURL).href===url),'native enabled exact own role application declaration changed')
 const mobile=one(detail.components.filter(c=>c.name==='Shared::Mobileactionsbar'),'native mobile application metadata').model
 need(mobile.links.length===1&&mobile.links[0].text==='Apply Now'&&new URL(mobile.links[0].path,roleURL).href===url,'native mobile application identity changed')
 const authoredLinks=detail.nodes.filter(n=>n.tag==='a'&&n.attrs.href).map(n=>({attrs:n.attrs,text:detail.document.text(n),href:new URL(n.attrs.href,roleURL).href,inert:!!n.inert}))
 html+='<h2>Application</h2><p><a href="'+escape(url)+'">Apply Now</a></p>'
 const full=readNativeDocument(html),text=full.text(rootOf(full)),minimum=profile.role.minimumFullAuthoredTextLength??5001;need(Number.isSafeInteger(minimum)&&minimum>0&&text.length>=minimum&&!closure.test(text),'incomplete or unavailable complete authored criteria/hiring conditions')
 return{model,stage,authoredLinks,html,text,applyURL:url,components:contents.map(c=>c.model),fullSchemaText:currentHiverRichText(model.description).text}
}
export async function runCurrentHiver(options={}){
 options.signal?.throwIfAborted();need(!(options.fetchPage||options.fetchText||options.fetchJson),'original byte/HTTP metadata transport required')
 let profile=JSON.parse(fs.readFileSync(new URL('./currentProfile20261115.json',import.meta.url),'utf8'))
 const currentProfileURL=new URL('./currentProfile20261121.json',import.meta.url),deployments=[profile,...(fs.existsSync(currentProfileURL)?[JSON.parse(fs.readFileSync(currentProfileURL,'utf8'))]:[])]
 const currentCorporate=JSON.parse(fs.readFileSync(new URL('./currentCorporate20261116.json',import.meta.url),'utf8')),timeout=options.sourceTimeoutMs??90000,interval=options.requestIntervalMs??500,maxJobs=options.maxJobs??null
 const corporateHeaderContexts=[...(profile.corporate.headerContextVariants??[profile.headers[HIVER_CORPORATE]]),...(currentCorporate.corporate.headerContextVariants??[currentCorporate.headers])];profile={...profile,corporate:currentCorporate.corporate}
 need(Number.isSafeInteger(timeout)&&timeout>0&&timeout<=90000&&Number.isSafeInteger(interval)&&interval>=0&&interval<=60000&&(interval>=500||options.fetchImpl)&&((maxJobs===null)||(Number.isSafeInteger(maxJobs)&&maxJobs>0&&maxJobs<=100)),'invalid source deadline/pacing/caller limit')
 const now=()=>{const value=typeof options.now==='function'?options.now():options.now??new Date().toISOString();const date=value instanceof Date?value:new Date(value);need(Number.isFinite(date.getTime()),'invalid source clock');return date.toISOString()},observedAt=now(),controller=new AbortController(),timer=setTimeout(()=>controller.abort(problem('source deadline exceeded')),timeout),signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal
 const responses=[],last=new Map(),byteLength=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype),'byteLength').get
 let reads=0,total=0,opening,closing,selectedDeployment=false,readLimit=2*(profile.assetOrder.length+4)
 async function read(url,kind){
  signal.throwIfAborted();need(Object.hasOwn(profile.headers,url)&&++reads<=readLimit,'unbound public URL or finite read limit exceeded')
  const origin=new URL(url).origin,wait=interval-(performance.now()-(last.get(origin)??-Infinity));if(wait>0)await delay(wait,undefined,{signal});last.set(origin,performance.now())
  const packet=await boundedDeclaredPublicRead(url,{signal,timeoutMs:15000,overflowError:problem('native intrinsic entity byte limit'),fetchImpl:async(value,init)=>{
   const response=await(options.fetchImpl??globalThis.fetch)(value,{...init,credentials:'omit',cache:'no-store',headers:{'User-Agent':UA,Accept:kind==='feed'?'application/json':kind==='asset'?'*/*':'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'}});let size=0
   const body=response.body===null?null:{cancel:reason=>response.body.cancel(reason),getReader(){const reader=response.body.getReader();return{async read(){const item=await reader.read();if(!item.done){need(types.isUint8Array(item.value),'native chunks must be Uint8Array');const n=byteLength.call(item.value);need(n<=4_000_000-size&&n<=32_000_000-total,'native streaming entity/aggregate byte limit');size+=n;total+=n}return item},cancel:reason=>reader.cancel(reason),releaseLock:()=>reader.releaseLock()}}}
   return{status:response.status,url:response.url,headers:response.headers,body}
  }})
  const p={requestedURL:url,kind,...packet,bytes:Buffer.from(packet.bodyBase64,'base64').length,sha256:currentHiverSHA(Buffer.from(packet.bodyBase64,'base64'))};responses.push(p)
  need(p.status===200&&p.url===url,'ordinary native HTTP status/final URL changed')
  if(kind==='board'&&!selectedDeployment){
   const candidates=deployments.filter(candidate=>same(currentHiverHeaders(p,candidate),candidate.headers[url]))
   need(candidates.length===1,'native response headers do not identify one reviewed coherent deployment')
   profile={...candidates[0],corporate:currentCorporate.corporate};selectedDeployment=true
   readLimit=2*(profile.assetOrder.length+3+(profile.roles?.length??1))
  }
  const headerContexts=url===HIVER_CORPORATE?corporateHeaderContexts:[profile.headers[url]]
  need(p.headers['content-range']===undefined,'partial native entity cannot qualify a complete role')
  need(headerContexts.some(headers=>same(currentHiverHeaders(p,profile),headers)),'native critical MIME/navigation/execution/cache context changed')
  if(kind==='asset')need(p.bytes===profile.assets[url].bytes&&p.sha256===profile.assets[url].sha256,'current complete native renderer/controller/style bytes changed')
  return p
 }
 async function pass(){
  const corporate=await read(HIVER_CORPORATE,'corporate'),corp=currentHiverDocument(corporate,profile)
  const delegation=corp.nodes.filter(n=>n.tag==='a'&&!n.inert&&n.attrs.href===HIVER_BOARD&&corp.document.text(n)==='See our open positions');need(delegation.length>0,'current active exact corporate native handoff unavailable')
  const boardPacket=await read(HIVER_BOARD,'board'),board=currentHiverDocument(boardPacket,profile)
  need(board.contextSHA256===profile.contexts[HIVER_BOARD],'full declared native board program/style/control/context changed')
  const jobsComponent=one(board.components.filter(c=>c.name==='External::Jobs'),'current native jobs component')
  need(jobsComponent.model.url==='/postings.json'&&jobsComponent.model.target==='external:jobs:index:37593','current exact native anonymous feed declaration changed')
  for(const url of profile.assetOrder)await read(url,'asset')
  const packet=await read(HIVER_FEED,'feed'),feed=strictHiverJSON(Buffer.from(packet.bodyBase64,'base64').toString('utf8'));keys(feed,['data'],'native complete feed')
  need(Array.isArray(feed.data)&&feed.data.length>0&&feed.data.length<=100,'unqualified empty or oversized native observation scope')
  const rows=feed.data,ids=new Set()
  for(const row of rows){need(plain(row)&&typeof row.id==='string'&&/^\d{1,8}$/.test(row.id)&&!ids.has(row.id),'missing/duplicate native observed posting identity');ids.add(row.id)}
  const reviewedRoles=profile.roles??[profile.role],qualifiedRoles=[]
  need(reviewedRoles.length>0&&reviewedRoles.length<=20,'reviewed finite native role set unavailable')
  for(const role of reviewedRoles){
   const roleProfile={...profile,role},roleURL=role.rowStable.url,row=one(rows.filter(r=>r.id===role.postingID),'finite current selected posting')
   const rolePacket=await read(roleURL,'role'),detail=currentHiverDocument(rolePacket,roleProfile)
   need(detail.contextSHA256===profile.contexts[roleURL],'full own role metadata/program/style/control/criteria authority changed')
   need(!closure.test(detail.document.text(rootOf(detail.document))),'current active role/applications unavailable')
   const qualified=qualifyRole(row,detail,roleProfile,now())
  const model=qualified.model,address=model.jobLocation.address,job={source:'hiver',company:'Hiver',title:row.title,jobId:row.id,nativePublicPostingID:row.id,nativePostingUUID:model.identifier.value,nativeJobID:row.job.id,requisitionId:row.job.requisition_id,nativeLegalEmployer:null,nativeEmployerLabel:model.hiringOrganization.name,
   sourceUrl:row.url,link:qualified.applyURL,applyUrl:qualified.applyURL,country:'India',city:address.addressLocality,state:address.addressRegion,location:[address.addressLocality,address.addressRegion,'India'].join(', '),locations:[[address.addressLocality,address.addressRegion,'India'].join(', ')],nativeLocations:{jobLocation:model.jobLocation,applicantLocationRequirements:model.applicantLocationRequirements,feedLocation:row.location},
   department:row.job.department.name,employmentType:row.employment_type_text,remoteStatus:row.workplace_type_text,postingDate:model.datePosted,postedAt:model.datePosted,closingDate:null,jobDescription:qualified.text,sourceDescription:qualified.html,sourceNativeCorporateRecruitment:JSON.parse(corp.contextProjection),sourceNativeModel:row,sourceNativeJobPosting:model,sourceNativeCriterionComponents:qualified.components,sourceNativeHiringConditions:qualified.stage,sourceNativeAuthoredLinks:qualified.authoredLinks,
   sourceDetailComplete:true,sourceWholeOriginalCriteriaRetained:true,sourceNativeMetadataAuthorityOnly:true,sourceRenderedFullCriteriaQualified:false,sourceRenderedApplicationQualified:false,sourcePublicApplicationMetadataQualified:true,sourceScopeComplete:false,sourceListingComplete:false,sourceCompanyCoverageComplete:false,lifecycleCleanupAllowed:false,scrapedAt:observedAt}
   qualifiedRoles.push({job,model,fullSchemaText:qualified.fullSchemaText})
  }
  const selectedIDs=new Set(reviewedRoles.map(role=>role.postingID)),held=rows.filter(row=>!selectedIDs.has(row.id)).map(row=>({row,holdReason:'native-role-country/full-current-detail-uninspected-in-bounded-profile',nativeVacancyObservationQualified:false}))
  return{corporateRecruitmentAuthority:corp.contextProjection,rows,held,jobs:qualifiedRoles.map(role=>role.job),originalTypedPostingModels:qualifiedRoles.map(role=>role.model),fullNativeSchemaCriteriaText:profile.roles?qualifiedRoles.map(role=>role.fullSchemaText):qualifiedRoles[0].fullSchemaText}
 }
 try{
  opening=await pass();closing=await pass();const closedAt=now();need(same(opening,closing),'fresh closing complete original observations/criteria/country/employer/application changed');signal.throwIfAborted()
  const jobs=maxJobs===null?opening.jobs:opening.jobs.slice(0,maxJobs),observedVacancyCount=opening.originalTypedPostingModels.filter(m=>m['@type']==='JobPosting').length,evidence={source:'hiver',recordKind:'mixed',observedRecordCount:opening.rows.length,observedVacancyCount,companyGlobalTotal:null,companyIndiaTotal:null,sourceScopeComplete:false}
  const audit={...evidence,opening,closing,observedAt,closingObservedAt:closedAt,observationCountSemantics:`All ${opening.rows.length} original native feed observations retained; ${observedVacancyCount} independently hydrated full typed JobPosting models before eligibility/caller limits. ${opening.held.length} uninspected rows remain unclassified/held, not asserted non-vacancies or an inventory total.`,originalResponses:responses,independentNativeClosingReconciled:true,completeOriginalCriteriaAndHiringConditionsPreserved:true,externalProgramsExecuted:false,renderedFullCriteriaQualified:false,renderedApplicationQualified:false,applicationSubmitted:false,applicationRequests:0,verifiedZero:false,sourceListingComplete:false,lifecycleCleanupAllowed:false}
  attachSourceObservationEvidence(jobs,evidence);Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true});Object.defineProperty(jobs,'sourceAudit',{value:audit,configurable:true})
  return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:HIVER_CORPORATE,firstParty:true,listingComplete:false,pagesFetched:reads,reportedTotal:null,indiaFacetCount:null,verifiedAt:closedAt,lifecycleCleanupAllowed:false,reason:`${opening.rows.length}-native-records;${observedVacancyCount}-native-typed-vacancies;${opening.held.length}-uninspected-holds;${opening.jobs.length}-current-native-typedIndia-roles;full-original-criteria-and-hiring-conditions-independent-closing;no-company-zero/inventory/rendered-application-proof`})
 }catch(error){
  if(options.signal?.aborted)throw options.signal.reason
  if(error&&typeof error==='object'&&Object.isExtensible(error))try{Object.defineProperty(error,'sourceAudit',{value:{source:'hiver',opening,closing,originalResponses:responses,sourceScopeComplete:false,lifecycleCleanupAllowed:false},enumerable:true,configurable:true})}catch{}
  throw error
 }finally{clearTimeout(timer)}
}
