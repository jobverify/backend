import {parse} from 'acorn'
import {isDeepStrictEqual} from 'node:util'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {document as rawDocument} from '../../scraper-support/shared/rmkNativePairHtml.js'
import {readLiteralModel} from '../../scraper-support/native-sources/literalModel.js'
import {nativeHTMLText,primaryDeclaration} from '../../scraper-support/native-sources/declaredGreenhouse/nativeData.js'
import {NATIVE_GREENHOUSE_PROFILES} from '../../scraper-support/native-sources/declaredGreenhouse/nativeCareers.js'
import {failure} from './runtime20261108.js'
export const PROFILE=NATIVE_GREENHOUSE_PROFILES.doximity,PRIMARY=PROFILE.primaryURL,EMBED=PROFILE.declaration.scriptURL,BOARD='https://job-boards.greenhouse.io/embed/job_board?for=doximity',API=PROFILE.publicAPIBase
export const need=(ok,message)=>{if(!ok)throw failure('Doximity native publication: '+message,'DOXIMITY_NATIVE_PROOF')}
export const strictJSON=text=>{try{readLiteralModel(text);return JSON.parse(text)}catch(error){need(false,'invalid/duplicate native JSON: '+error.message)}}
const executable=n=>!Object.hasOwn(n.attrs,'nomodule')&&['','text/javascript','application/javascript','module'].includes((n.attrs.type||'').toLowerCase())
const one=(rows,label)=>{need(rows.length===1,'missing/ambiguous '+label);return rows[0]}
const cls=(n,label)=>(n.attrs.class||'').split(/\s+/).includes(label)
// Resolve static bracket notation and retain unresolved properties as wildcards.
// A dynamic property can overwrite the evidence object, so it cannot qualify it.
const path=n=>n?.type==='Identifier'?n.name:n?.type==='MemberExpression'?path(n.object)+'.'+(!n.computed?n.property.name:n.property.type==='Literal'&&['string','number'].includes(typeof n.property.value)?String(n.property.value):'*'):null
const affects=(target,root)=>{if(!target)return false;const a=target.split('.'),b=root.split('.');return a.slice(0,Math.min(a.length,b.length)).every((value,i)=>value==='*'||value===b[i])}
const walk=(node,visit)=>{if(!node||typeof node!=='object')return;visit(node);for(const value of Object.values(node)){if(Array.isArray(value))value.forEach(n=>walk(n,visit));else if(value&&typeof value==='object')walk(value,visit)}}
const mutationTarget=node=>{
 if(node.type==='AssignmentExpression')return path(node.left)
 if(node.type==='UpdateExpression'||node.type==='UnaryExpression'&&node.operator==='delete')return path(node.argument)
 if(node.type==='CallExpression'&&['Object.assign','Object.defineProperty','Object.defineProperties','Object.setPrototypeOf','Reflect.set','Reflect.deleteProperty','Reflect.defineProperty','Reflect.setPrototypeOf'].includes(path(node.callee)))return path(node.arguments[0])
 if(node.type==='CallExpression'&&node.callee?.type==='MemberExpression'&&['push','pop','shift','unshift','splice','sort','reverse','fill','copyWithin'].includes(node.callee.computed?node.callee.property.value:node.callee.property.name))return path(node.callee.object)
 return null
}
export const ownURL=id=>'https://job-boards.greenhouse.io/doximity/jobs/'+id
function metadataURI(value,expected){let u;try{u=new URL(value)}catch{need(false,'invalid native document metadata URI')};need(['http:','https:'].includes(u.protocol)&&!u.username&&!u.password&&!u.port&&!u.hash,'native metadata URI changed');u.protocol='https:';need(u.href===expected,'native document metadata identifies another route')}
const canonical=(doc,url)=>{const value=one(doc.nodes(n=>n.tag==='link'&&(n.attrs.rel||'').split(/\s+/).includes('canonical')),'canonical').attrs.href;metadataURI(value,url);return value}
export function primary(html){const doc=readNativeDocument(html);need(primaryDeclaration(html,PROFILE),'current employer declaration changed');one(doc.nodes(n=>n.tag==='script'&&executable(n)&&n.attrs.src===EMBED),'active native embed');return {primaryURL:PRIMARY,embedURL:EMBED,publisher:'Doximity',publisherProgramsExecuted:false}}
export function embed(source){
 const ast=parse(source,{ecmaVersion:'latest'}),assignments=[]
 walk(ast,node=>{const target=mutationTarget(node);if(!affects(target,'Grnhse.Settings'))return;need(node.type==='AssignmentExpression'&&target==='Grnhse.Settings','native embed handoff is overwritten or has an unreviewed mutation');assignments.push(node)})
 const assignment=one(assignments,'literal native embed settings');need(ast.body.some(s=>s.type==='ExpressionStatement'&&s.expression===assignment)&&assignment.operator==='='&&assignment.right.type==='ObjectExpression','non-top-level or nonliteral native settings')
 const settings={};for(const p of assignment.right.properties){const key=p.key?.type==='Identifier'?p.key.name:p.key?.value;need(p.type==='Property'&&!p.computed&&p.kind==='init'&&typeof key==='string'&&!Object.hasOwn(settings,key)&&p.value.type==='Literal'&&['string','boolean'].includes(typeof p.value.value),'invalid/duplicate native embed field');Object.defineProperty(settings,key,{value:p.value.value,enumerable:true})}
 need(settings.boardURI===BOARD&&settings.targetDomain==='https://job-boards.greenhouse.io'&&settings.autoLoad===true&&settings.useEmbeddedInternalBoard===false,'native public board handoff changed')
 return {boardURL:BOARD,originalSettings:settings,publisherProgramsExecuted:false,applicationActions:0}
}
export function context(doc){
 const models=[]
 for(const script of doc.nodes(n=>n.tag==='script'&&!n.attrs.src&&executable(n))){
  let ast;try{ast=parse(script.raw,{ecmaVersion:'latest',sourceType:script.attrs.type==='module'?'module':'script'})}catch{need(!script.raw.includes('__remixContext'),'unparsed executable native context program');continue}
  walk(ast,node=>{const target=mutationTarget(node);if(!['window.__remixContext','globalThis.__remixContext','__remixContext'].some(root=>affects(target,root)))return
   need(node.type==='AssignmentExpression'&&target==='window.__remixContext'&&ast.body.length===1&&ast.body[0].type==='ExpressionStatement'&&ast.body[0].expression===node&&node.operator==='='&&node.right.type==='ObjectExpression','native context is replaced, augmented or mutated')
   models.push(strictJSON(script.raw.slice(node.right.start,node.right.end)))
  })
 }
 const model=one(models,'complete active Remix context'),state=model.state,root=state?.loaderData?.root
 need(model.isSpaMode===false&&state.actionData===null&&state.errors===null&&root&&root.internal===false&&root.preview===false&&root.locale==='en'&&root.boardConfiguration?.job_board_id===9663&&root.boardConfiguration.job_board_public_url==='https://job-boards.greenhouse.io/doximity','public native board identity/status changed')
 return {model,root,loader:state.loaderData}
}
export function board(html,onRecord){
 const doc=readNativeDocument(html),c=context(doc),route=c.loader['routes/embed.job_board'];need(c.root.embedded===true&&c.root.isJobPost===false&&route&&route.internal===false&&route.urlToken==='doximity'&&route.board?.name==='Doximity'&&route.board.public_url==='https://job-boards.greenhouse.io/doximity'&&route.board.redirect_to===null,'native board publisher changed')
 metadataURI(c.root.href,BOARD);metadataURI(route.url,BOARD);const originalCanonical=canonical(doc,BOARD)
 need(Array.isArray(route.jobPosts?.data),'native published listing is missing');const ids=new Set(),records=[]
 for(const value of route.jobPosts.data){need(Number.isSafeInteger(value.id)&&value.id>0&&!ids.has(value.id),'invalid/duplicate native published post ID');ids.add(value.id);need(value.absolute_url===ownURL(value.id)&&typeof value.title==='string'&&value.title&&typeof value.location==='string','native listing identity missing');records.push(value);onRecord?.(value)}
 const total=route.jobPosts;need(total.count===records.length&&total.total===records.length&&total.page===1&&total.total_pages===1,'native listing pagination/total incomplete')
 need(Array.isArray(route.featuredPosts?.data)&&route.featuredPosts.data.every(v=>ids.has(v.id)&&isDeepStrictEqual(v,records.find(r=>r.id===v.id))),'unreconciled native featured posts')
 need(Array.isArray(route.departmentIds)&&!route.departmentIds.length&&Array.isArray(route.officeIds)&&!route.officeIds.length&&route.customFieldFilters&&Object.keys(route.customFieldFilters).length===0,'native filtered listing cannot establish a complete cohort')
 const links=doc.nodes(n=>n.tag==='a'&&/^https:\/\/job-boards\.greenhouse\.io\/doximity\/jobs\/\d+$/.test(n.attrs.href||''));need(new Set(links.map(n=>n.attrs.href)).size===records.length&&links.every(n=>records.some(v=>v.absolute_url===n.attrs.href)),'rendered/native complete listing disagreement')
 const headTitle=nativeHTMLText(one(doc.nodes(n=>n.tag==='title'),'board title').raw)
 if(headTitle==='page_title'){
  const title=one(doc.nodes(n=>n.tag==='meta'&&n.attrs.property==='og:title'),'board head publisher metadata')
  const address=one(doc.nodes(n=>n.tag==='meta'&&n.attrs.property==='og:url'),'board head route metadata')
  need(title.attrs.content==='Doximity','board head publisher changed')
  metadataURI(address.attrs.content,BOARD)
 }else need(headTitle==='Jobs at Doximity','board head publisher changed')
 return {records,route:structuredClone(route),context:c.model,originalCanonical,nativeBoardTotal:total.total,companyGlobalTotal:null,companyIndiaTotal:null}
}
export function own(html,listing,api,at,onModel){
 const doc=readNativeDocument(html),url=ownURL(listing.id),c=context(doc),route=c.loader['routes/$url_token_.jobs_.$job_post_id'],post=route?.jobPost
 if(post)onModel?.({model:post,route,context:c.model})
 need(c.root.embedded===false&&c.root.isJobPost===true&&route?.urlToken==='doximity'&&route.jobPostId===String(listing.id)&&post&&['job_post','prospect_post'].includes(post.post_type),'native public own post identity missing')
 metadataURI(c.root.href,url);const originalCanonical=canonical(doc,url)
 need(post.company_name==='Doximity'&&post.public_url===url&&api.absolute_url===url&&api.id===listing.id&&post.hiring_plan_id===api.internal_job_id&&api.internal_job_id===listing.internal_job_id&&post.title===listing.title&&api.title===listing.title&&post.job_post_location===listing.location&&api.location?.name===listing.location,'own/API/listing publisher, role, native job or location conflict')
 need(post.redirect_to===null&&post.published_at===listing.published_at,'own native redirect/publication conflict')
 need((api.internal_job_id===null)===(post.post_type==='prospect_post'),'own native vacancy/prospect conflict')
 const heading=one(doc.nodes(n=>n.tag==='h1'&&cls(n,'section-header--large')&&cls(n,'font-primary')),'own role heading');need(doc.text(heading)===nativeHTMLText(post.title),'native own heading conflict')
 const headTitle=nativeHTMLText(one(doc.nodes(n=>n.tag==='title'),'own head title').raw)
 const expectedTitle='Job Application for '+nativeHTMLText(post.title)+' at Doximity'
 if(headTitle==='page_title'){
  // The reviewed current Greenhouse rendition emits its untranslated title
  // key. Its published Open Graph fields still identify this exact role;
  // require agreement with the API, hosted model, listing and visible H1 above.
  const metadata=property=>one(doc.nodes(n=>n.tag==='meta'&&n.attrs.property===property),'own head '+property).attrs.content
  need(nativeHTMLText(metadata('og:title'))===nativeHTMLText(post.title)
   &&metadata('og:url')===url&&nativeHTMLText(metadata('og:description'))===nativeHTMLText(post.job_post_location),'own head metadata publisher/title/location conflict')
 }else need(headTitle===expectedTitle,'own head publisher/title conflict')
 need(!doc.nodes(n=>n.tag==='base').length&&!doc.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json').length,'additional unreviewed native role identity/schema')
 one(doc.nodes(n=>n.tag==='div'&&cls(n,'job__description')&&cls(n,'body')),'active complete role criteria')
 const raw=rawDocument(html),carrier=one(raw.nodes(n=>n.tag==='div'&&raw.hasClass(n,'job__description')&&raw.hasClass(n,'body')),'exact full role criteria'),descriptionHTML=raw.outer(carrier),description=nativeHTMLText(descriptionHTML)
 need(description.length>100&&!raw.nodes(n=>n.tag==='form',carrier).length,'complete visible role criteria missing or includes a form')
 for(const value of [post.introduction,post.content,post.conclusion])if(value){need(typeof value==='string'&&description.includes(nativeHTMLText(value)),'full native content is absent from the own visible criteria')}
 return {model:post,route,context:c.model,originalCanonical,description,descriptionHTML,publication:publication(post,listing,api,at)}
}
const instant=value=>{
 if(typeof value!=='string')return null
 const m=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})$/.exec(value);if(!m)return null
 const [year,month,day,hour,minute,second]=m.slice(1,7).map(Number),date=new Date(Date.UTC(year,month-1,day,hour,minute,second,Number((m[7]||'').padEnd(3,'0'))))
 if(year<1000||month<1||month>12||day<1||hour>23||minute>59||second>59||date.getUTCFullYear()!==year||date.getUTCMonth()!==month-1||date.getUTCDate()!==day)return null
 if(m[8]!=='Z'&&(Number(m[8].slice(1,3))>14||Number(m[8].slice(4,6))>59||Number(m[8].slice(1,3))===14&&Number(m[8].slice(4,6))!==0))return null
 return Number.isFinite(Date.parse(value))?Date.parse(value):null
}
export function publication(post,listing,api,at){
 const now=Date.parse(at),issues=[];for(const [field,value] of [['hosted-current-publication',post.published_at],['listed-current-publication',listing.published_at],['listed-update',listing.updated_at],['API-first-publication',api.first_published],['API-update',api.updated_at]]){const stamp=instant(value);if(stamp===null||stamp>now)issues.push(field+'-invalid-or-future')}
 if(instant(post.published_at)!==instant(listing.published_at))issues.push('own-listing-publication-conflict')
 for(const [field,value] of [['hosted',post.application_deadline],['API',api.application_deadline]])if(value!==null&&value!==undefined&&value!==''){const stamp=instant(value);if(stamp===null||stamp<=now)issues.push(field+'-expiry-invalid-unzoned-or-past')}
 return {qualified:issues.length===0,at,issues,hostedPublishedAt:post.published_at,listedPublishedAt:listing.published_at,listedUpdatedAt:listing.updated_at,apiFirstPublishedAt:api.first_published,apiUpdatedAt:api.updated_at,hostedApplicationDeadline:post.application_deadline,apiApplicationDeadline:api.application_deadline??null,activeHiringVerified:false}
}
export const applicationOnlyFields=new Set(['fingerprint','confirmation_message','enable_eeoc','education_config','questions','demographic_questions','apply_with_seek','show_quick_apply_cta','ai_opt_out_request_url'])
export const roleEvidence=post=>Object.fromEntries(Object.entries(post).filter(([key])=>!applicationOnlyFields.has(key)))
export const API_FIELDS=["absolute_url", "ai_disclaimer", "ai_opt_out_request_url", "application_deadline", "company_name", "content", "data_compliance", "departments", "first_published", "id", "include_ai_disclaimer", "internal_job_id", "language", "location", "metadata", "offices", "pay_input_ranges", "requisition_id", "title", "updated_at"]
export const POST_FIELDS=["ai_disclaimer", "ai_opt_out_request_url", "application_deadline", "apply_with_seek", "company_name", "conclusion", "confirmation_message", "content", "demographic_questions", "education_config", "employment", "enable_eeoc", "fingerprint", "hiring_plan_id", "include_ai_disclaimer", "introduction", "is_featured", "job_post_location", "language", "pay_ranges", "post_type", "public_url", "published_at", "questions", "redirect_to", "show_quick_apply_cta", "title"]
