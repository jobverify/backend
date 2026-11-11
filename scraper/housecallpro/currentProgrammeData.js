import {createHash} from 'node:crypto'
import {isDeepStrictEqual} from 'node:util'
import {parse} from 'acorn'
import {decodeHTML} from 'entities'
import {readNativeDocument,readNativeAttributeTokens} from '../../scraper-support/utils/activeNativeHtml.js'
import {parseEightfoldJson as parseNativeJSON} from '../../scraper-support/utils/recruitmentEightfoldData.js'
import {nativeCountryName} from '../../scraper-support/shared/nativeJobPosting.js'
import {NATIVE_INDIA_LOCATION} from '../../scraper-support/utils/greenhouseLocations.js'

export const CORPORATE='https://www.housecallpro.com/careers/'
export const CLIENT='https://boards.greenhouse.io/embed/job_board/js?for=housecall'
export const API='https://boards-api.greenhouse.io/v1/boards/housecall/jobs?content=true'
export const ASSETS={module:'https://job-boards.cdn.greenhouse.io/assets/embed.job_board-CU352uge.js',
 entry:'https://job-boards.cdn.greenhouse.io/assets/entry.client-DUEst_Pv.js',vendor:'https://job-boards.cdn.greenhouse.io/assets/vendor-43TFuiWl.js'}
export const ASSET_HASHES={module:'3f62143ece3739d1ed52abed47ecb11ebf0033b9459a638a47d424bc2b530fef',
 entry:'ac67bcd84842058d8aa5e503e755ac5bed6b79427d8a77b1a70d086dc8e2f41a',vendor:'69705c2529e83f645baa55e8923b43635b970d7dcb77371df4e00a79bc10a754'}
export const sha=value=>createHash('sha256').update(value).digest('hex')
export const failure=message=>Object.assign(Error('Housecall current programme: '+message),{
 code:'HOUSECALL_PROGRAMME_HOLD',softFailure:true,upstreamOutage:false,abortRetries:true,failureKind:'coverage_gap',lifecycleCleanupAllowed:false})
export const need=(value,message)=>{if(!value)throw failure(message)}
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&isDeepStrictEqual(Object.keys(value).sort(),[...keys].sort())
const norm=value=>String(value??'').normalize('NFC').replace(/\s+/gu,' ').trim()
const kids=node=>node.children.filter(child=>typeof child!=='string')
const walk=(node,ancestors=[])=>[{node,ancestors},...kids(node).flatMap(child=>walk(child,[...ancestors,node]))]
const text=node=>norm(node.children.map(child=>typeof child==='string'?decodeHTML(child):text(child)).join(' '))
const one=(rows,label)=>{need(rows.length===1,'Expected unique '+label);return rows[0]}
const attrs=(node,value)=>isDeepStrictEqual(node.attrs,value)
const qualifiedPath=(node,ancestors)=>!node.inert&&!node.nativeTagUnqualified
 &&!ancestors.some(n=>n.inert||n.nativeTagUnqualified||['svg','math','object','template','noscript'].includes(n.tag))
const integer=value=>Number.isSafeInteger(value)&&value>0
const integerList=value=>Array.isArray(value)&&value.every(integer)&&new Set(value).size===value.length
const ids=value=>Array.isArray(value)&&value.every(row=>integer(row.id))&&new Set(value.map(row=>row.id)).size===value.length
const json=raw=>{try{return parseNativeJSON(raw)}catch(error){throw failure('Unqualified original JSON: '+error.message)}}
const roleURL=(id,value)=>integer(id)&&value===`https://www.housecallpro.com/careers/open-positions/?gh_jid=${id}`
const country=value=>{
 need(typeof value==='string'&&value.length>0,'Missing written native country')
 const known=nativeCountryName(value);need(known,'Unknown native work/applicant country')
 if(known==='India')throw Object.assign(failure('India requires the separately preserved positive reader'),{positiveReaderRequired:true})
 return known
}
const noIndia=(value,label)=>{
 const normalized=decodeHTML(String(value)).normalize('NFKC').replace(/\p{Default_Ignorable_Code_Point}/gu,'')
 need(!/\bIndia(?:n)?\b/i.test(normalized)&&!NATIVE_INDIA_LOCATION.test(normalized),label+' has unresolved India/geography scope')
}
const date=(value,label,now)=>{
 need(typeof value==='string','Missing original '+label)
 const m=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(Z|[+-]\d{2}:\d{2})$/.exec(value)
 need(m,'Unsupported original '+label+' precision/timezone')
 const [year,month,day,hour,minute,second]=m.slice(1,7).map(Number),days=new Date(Date.UTC(year,month,0)).getUTCDate()
 const offset=m[7]==='Z'?[0,0]:m[7].slice(1).split(':').map(Number)
 need(year>=1970&&month>=1&&month<=12&&day>=1&&day<=days&&hour<=23&&minute<=59&&second<=59
  &&offset[0]<=14&&offset[1]<=59&&(offset[0]!==14||offset[1]===0)&&Number.isFinite(Date.parse(value))&&Date.parse(value)<=Date.parse(now),
 'Invalid original '+label+' calendar/clock/currentness')
}

export function htmlEncoding(html){
 const document=readNativeDocument(html)
 for(const node of document.nodes(n=>n.tag==='meta')){
  if(Object.hasOwn(node.attrs,'charset'))need(/^utf-8$/i.test(node.attrs.charset),'Unreviewed native HTML charset')
  if(node.attrs['http-equiv']?.toLowerCase()==='content-type')
   need(/^text\/html\s*;\s*charset\s*=\s*(?:utf-8|"utf-8")\s*$/i.test(node.attrs.content||''),'Unreviewed native HTML decoding declaration')
 }
}

export function corporateProgramme(original){
 let html=original;const fragments=[]
 for(const[id,title]of [['1tkizce6wq','People Matter - Programs Launch Video'],['5rulkvb1gp','Hamed | Engineering Recruitment Video']]){
  const before='<iframe class="wp-embedded-content" sandbox="allow-scripts" title="'+title+'" src="https://fast.wistia.net/embed/iframe/'+id+'?dnt=1#?secret='
  const re=new RegExp(before.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'([A-Za-z0-9]{10})(" frameborder="0" scrolling="no" width="640" height="360">)','g')
  const found=one([...html.matchAll(re)],'reviewed corporate video carrier')
  need(html.split(found[1]).length-1===1,'Corporate video fragment has another reference')
  fragments.push({nativeVideoID:id,title,originalFragmentValue:found[1]})
  html=html.replace(re,before+'<specific-reviewed-video-message-fragment>$2')
 }
 const canonicalSHA256=sha(html)
 need(canonicalSHA256==='c505086df29f441a4217fc1f0e487d889ef3fa72bb707cd5fde02da51c70e6b1','Unreviewed corporate authority/programme/carrier bytes')
 const document=readNativeDocument(original),root=one(document.nodes(n=>n.tag==='root'),'corporate document')
 const scripts=walk(root).filter(({node})=>node.tag==='script'&&node.attrs.src===CLIENT)
 const {node,ancestors}=one(scripts,'current corporate native client')
 need(qualifiedPath(node,ancestors)&&attrs(node,{src:CLIENT,onload:'greenhouseLoaded()',async:''}),'Unqualified current native client declaration')
 return {canonicalSHA256,fragments,currentDeclaredClient:CLIENT,originalHrefRetained:true,
  comparisonOnly:true,unknownDifferencesIgnored:false,externalVideoCriteriaAcquired:false}
}

export function classicClient(original){
 let ast
 try{ast=parse(original,{ecmaVersion:'latest',sourceType:'script'})}catch(error){throw failure('Invalid original classic client: '+error.message)}
 const assignments=ast.body.filter(n=>n.type==='ExpressionStatement'&&n.expression.type==='AssignmentExpression'
  &&n.expression.left.type==='MemberExpression'&&!n.expression.left.computed&&n.expression.left.object.name==='Grnhse'&&n.expression.left.property.name==='Settings')
 const assignment=one(assignments,'actual Grnhse.Settings assignment'),object=assignment.expression.right
 need(object.type==='ObjectExpression','Unreviewed literal native settings')
 need(object.properties.every(p=>p.type==='Property'&&!p.computed&&!p.method&&p.kind==='init'&&p.value.type==='Literal'),'Nonliteral native client settings')
 const properties=object.properties,settings=Object.fromEntries(properties.map(p=>[p.key.name||p.key.value,p.value.value]))
 need(Object.keys(settings).length===properties.length,'Duplicate client settings')
 const token=one(properties.filter(p=>(p.key.name||p.key.value)==='embedToken'),'published native embed token').value
 need(/^'[A-Za-z0-9_-]{100,1024}={0,2}'$/.test(original.slice(token.start,token.end)),'Unreviewed public token literal')
 const canonical=original.slice(0,token.start)+'<literal-current-public-embed-token>'+original.slice(token.end)
 need(sha(canonical)==='6a938027bd63920f49bc6c74bf39b61d4620b3d0029c6becbee8bd0f146d27ee','Unreviewed classic client/settings/programme code')
 need(settings.boardURI==='https://job-boards.greenhouse.io/embed/job_board?for=housecall'&&settings.autoLoad===true
  &&settings.targetDomain==='https://job-boards.greenhouse.io'&&settings.useEmbeddedInternalBoard===false,'Unbound native client programme')
 const frame=new URL(settings.boardURI);frame.searchParams.set('validityToken',settings.embedToken)
 const second=new URL(frame.href),params=new URLSearchParams(frame.search);params.delete('page');params.append('page','2');second.search=params.toString()
 return {settings,frameURL:frame.href,secondPageURL:second.href,comparisonOnlyProfileSHA256:sha(canonical),
  settingsASTRange:{start:assignment.start,end:assignment.end},actualPublishedLiteralToken:true,
  navigationContract:'Reviewed mo→X7/P7/Kp native URLSearchParams submission defaults to GET; preserves original query and appends page=2.',
  nativeJavaScriptExecuted:false,originalMIME:'text/html',sourceSpecificClassicJSProfile:true}
}

const STATIC_MODEL='6f6fb55c33dcd331b5372871d1f0fd754dd3a16b592f235a5cf69cf26a74432e'
const STATIC_SHELL={1:'c7195fec75f1d37b2e3675705d712891df41ae659ea4d043c4bef942f8d9ff71',2:'8c353b7637ccf3e335f9b77150db4808777411398a33b0fcd8eb6f2479bbf1dd'}
const ROW=/<tr class="job-post">[\s\S]*?<\/tr>/g,COUNT=/<h2[^>]*data-testid="job-count-header"[^>]*>[\s\S]*?<\/h2>/g
const POST_KEYS=['id','title','internal_job_id','updated_at','requisition_id','location','absolute_url','published_at','department','is_featured']
// The actual API parent record is unacquired. This is the exact observed child
// parent ID paired with the original SSR ancestor path, not an invented tree.
const DEPARTMENT_ROOT={nativeAPIParentID:4075378004,nativeSSRPath:['Housecall Pro']}
export function nativeBoard(html,url,page,now){
 const document=readNativeDocument(html),root=one(document.nodes(n=>n.tag==='root'),'native document'),entries=walk(root)
 const {node:carrier,ancestors}=one(entries.filter(({node})=>node.tag==='script'&&(node.raw||'').includes('window.__remixContext')),'native Remix carrier')
 need(qualifiedPath(carrier,ancestors)&&attrs(carrier,{}),'Unqualified native carrier/source/namespace')
 const match=/^window\.__remixContext = ([\s\S]+);$/.exec(carrier.raw||'');need(match,'Native literal loader assignment changed')
 const model=json(match[1]),route=model?.state?.loaderData?.['routes/embed.job_board'],posts=route?.jobPosts
 need(exact(posts,['count','page','total','total_pages','data'])&&Array.isArray(posts.data)&&ids(posts.data)
  &&Number.isSafeInteger(posts.total)&&posts.total>50&&posts.total<=100&&posts.page===page&&posts.total_pages===2
  &&posts.count===posts.data.length&&posts.count===(page===1?50:posts.total-50),'Incomplete/unreviewed native two-page programme counts')
 const nativeURL=url.replace(/^https:/,'http:')
 need(model.state.loaderData.root.href===nativeURL&&route.url===nativeURL,'Original native same-channel URL/account binding changed')
 const fixed=structuredClone(model);delete fixed.state.loaderData.root.href;delete fixed.state.loaderData['routes/embed.job_board'].url
 delete fixed.state.loaderData['routes/embed.job_board'].jobPosts
 need(sha(JSON.stringify(fixed))===STATIC_MODEL,'Unreviewed native scope/filter/config/employer/dependency model')
 for(const row of posts.data){
  need(exact(row,POST_KEYS)&&integer(row.internal_job_id)&&typeof row.title==='string'&&norm(row.title)&&row.title.length<=500
   &&roleURL(row.id,row.absolute_url)&&typeof row.requisition_id==='string'&&row.is_featured===false,'Unreviewed native posting identity/model')
  noIndia(row.title,'Native title');country(row.location);date(row.published_at,'SSR publication',now);date(row.updated_at,'SSR revision',now)
  need(exact(row.department,['name','id','path'])&&integer(row.department.id)&&typeof row.department.name==='string'
   &&isDeepStrictEqual(row.department.path,DEPARTMENT_ROOT.nativeSSRPath)
   &&route.departments.some(d=>d.id===row.department.id&&d.name===row.department.name),'Unknown native department hierarchy/path/membership')
 }
 const rawRows=[...html.matchAll(ROW)],activeRows=entries.filter(({node})=>node.tag==='tr'&&(node.attrs.class||'').split(/\s+/).includes('job-post'))
 need(rawRows.length===posts.data.length&&activeRows.length===rawRows.length,'Unmatched native raw/active posting rows')
 const byId=new Map(posts.data.map(row=>[row.id,row])),seen=new Set(),cards=[]
 for(let index=0;index<activeRows.length;index++){
  const {node:row,ancestors:path}=activeRows[index]
  need(qualifiedPath(row,path)&&attrs(row,{class:'job-post'})&&path.at(-1)?.tag==='tbody'&&path.at(-2)?.tag==='table'
   &&path.at(-3)?.attrs.class==='job-posts--table','Unqualified native visible card carrier/context')
  for(const tag of rawRows[index][0].matchAll(/<[a-z][^\s>]*([^>]*)>/gi)){
   const tokens=readNativeAttributeTokens(tag[1]);need(new Set(tokens.map(([key])=>key)).size===tokens.length,'Ambiguous native card attributes')
  }
  const td=one(kids(row),'card cell'),a=one(kids(td),'own-role link'),paragraphs=kids(a)
  need(td.tag==='td'&&attrs(td,{class:'cell'})&&a.tag==='a'&&paragraphs.length===2&&paragraphs.every(n=>n.tag==='p'),'Native card hierarchy/extra criterion changed')
  let id;try{id=Number(new URL(a.attrs.href).searchParams.get('gh_jid'))}catch{throw failure('Unqualified native own-role card URL')}
  const expected=byId.get(id);need(expected&&!seen.has(id)&&attrs(a,{href:expected.absolute_url,target:'_top'}),'Unmatched native own-role card link');seen.add(id)
  const [title,location]=paragraphs
  need(attrs(title,{class:'body body--medium'})&&attrs(location,{class:'body body__secondary body--metadata'})&&kids(location).length===0,'Unreviewed native card title/location model')
  const badges=kids(title);need(badges.length<=1,'Additional native card criterion/badge')
  let label=null
  if(badges.length){
   const badge=badges[0],ellipse=one(kids(badge),'badge ellipse'),leaf=one(kids(ellipse),'badge text')
   label=text(leaf)
   need(badge.tag==='span'&&attrs(badge,{class:'tag-container',style:'margin-left:8px'})&&ellipse.tag==='span'&&attrs(ellipse,{class:'ellipse'})
    &&leaf.tag==='span'&&attrs(leaf,{class:'tag-text'})&&kids(leaf).length===0&&['New','tags.new'].includes(label),'Unreviewed native badge criterion/translation')
  }
  need(!!badges.length===(Date.parse(expected.published_at)>Date.parse(now)-604800000),'Native New badge/publication semantics disagree')
  const writtenTitle=norm(title.children.filter(v=>typeof v==='string').map(value=>decodeHTML(value)).join(' '))
  need(writtenTitle===norm(expected.title)&&text(location)===norm(expected.location)&&text(row)===norm(expected.title+(label?' '+label:'')+' '+expected.location),'Whole native card criteria/country conflict')
  const group=one(path.filter(n=>n.tag==='div'&&n.attrs.class==='job-posts--table--department'),'native card department group')
  const heading=one(kids(group).filter(n=>n.tag==='h3'),'native department heading')
  need(text(heading)===norm(expected.department.name),'Native card department/own model conflict')
  cards.push({id,url:expected.absolute_url,title:expected.title,location:expected.location,department:expected.department.name,newBadgeLabel:label})
 }
 const title=one(entries.filter(({node})=>node.tag==='title'),'native head title')
 need(title.ancestors.at(-1)?.tag==='head'&&qualifiedPath(title.node,title.ancestors)&&attrs(title.node,{})
  &&['Jobs at Housecall Pro','page_title'].includes(title.node.raw),'Unknown native head title/employer representation')
 const og=one(entries.filter(({node})=>node.tag==='meta'&&node.attrs.property==='og:title'),'native OG employer')
 need(og.ancestors.at(-1)?.tag==='head'&&attrs(og.node,{property:'og:title',content:'Housecall Pro'}),'Native OG/employer contradicts bound programme')
 const counts=[...html.matchAll(COUNT)]
 need(counts.length===1&&counts[0][0]===`<h2 class="section-header section-header--large font-primary" data-testid="job-count-header">${posts.total} jobs</h2>`,'Native visible programme count conflicts')
 const encoded=nativeURL.replaceAll('&','&amp;'),canonical='<link rel="canonical" href="'+encoded+'"/>',ogURL='<meta property="og:url" content="'+encoded+'"/>'
 need(html.split(canonical).length-1===1&&html.split(ogURL).length-1===1,'Native canonical/OG same-channel account URL changed')
 const titleMarkup='<title>'+title.node.raw+'</title>'
 let shell=html.replace(carrier.raw,'<reviewed-native-model>').replace(ROW,'').replace(COUNT,'<reviewed-job-count>')
 shell=shell.replace(titleMarkup,'<title><reviewed-board-title></title>').replace(canonical,'<reviewed-canonical>').replace(ogURL,'<reviewed-og-url>')
 need(sha(shell)===STATIC_SHELL[page],'Unreviewed native page programme/carrier/control/renderer/criterion bytes')
 const comparison=html.replace(titleMarkup,'<title><specific-reviewed-board-title-presentation></title>')
  .replace(/<span class="tag-text">(?:New|tags\.new)<\/span>/g,'<span class="tag-text"><specific-reviewed-native-new-badge-label></span>')
 return {model,posts:posts.data,cards,reportedTotal:posts.total,page,loaderSHA256:sha(carrier.raw),comparisonCanonicalSHA256:sha(comparison),
  originalHeadTitle:title.node.raw,originalCanonicalHTTPMetadataURL:nativeURL,requestedHTTPSURL:url,
  revisionDifferences:[],revisionDifferenceCauseVerified:false,staticShellSHA256:sha(shell)}
}

const contentTags=new Set(['root','div','p','strong','ul','li','em','a','span','h3','h4','br'])
const blocks=new Set(['root','div','p','ul','li','h3','h4','br'])
const publishedText=node=>{
 const value=node.children.map(child=>typeof child==='string'?decodeHTML(child):publishedText(child)).join('')
 return blocks.has(node.tag)?' '+value+' ':value
}
const LINKS=new Set(['https://www.housecallpro.com/privacy/ca-job-candidates/',
 'https://www.youtube.com/playlist?list=PLtOkEN3J3qWvyyue3zkHBmDKmxq_WoztK',
 'https://www.youtube.com/watch?v=aQ0Heukfbfo&list=PLtOkEN3J3qWtwlaNnKV9RfawopkaYMu4B&index=7'])
const CONTENT_ATTRIBUTES={root:[],div:['class','id'],p:['style','data-path-to-node'],
 strong:['data-start','data-end','data-stringify-type'],ul:[],li:['style','data-path-to-node','data-pm-slice','data-stringify-border','data-stringify-indent'],
 em:[],a:['href','target'],span:['class','style','id','data-path-to-node'],h3:['data-path-to-node'],h4:[],br:[]}
const CONTENT_STYLES=new Set(['font-weight: 400;','font-weight: bold;','text-align: center;'])
const CONTENT_CLASSES=new Set(['Yjhzub','citation-6','content-conclusion','content-intro','css-alatv1','description','p-rich_text_section'])
const publishedContent=raw=>{
 const decoded=decodeHTML(raw),document=readNativeDocument(decoded),root=one(document.nodes(n=>n.tag==='root'),'full published API description')
 for(const {node}of walk(root)){
  need(contentTags.has(node.tag)&&!node.nativeTagUnqualified&&!node.inert
   &&Object.keys(node.attrs).every(key=>CONTENT_ATTRIBUTES[node.tag]?.includes(key)),'Unreviewed published API HTML/carrier/hidden authored representation')
  if(Object.hasOwn(node.attrs,'style'))need(CONTENT_STYLES.has(node.attrs.style),'Unreviewed authored inline style semantics')
  if(Object.hasOwn(node.attrs,'class'))need(CONTENT_CLASSES.has(node.attrs.class),'Unreviewed authored class/style semantics')
  if(node.tag==='a')need(LINKS.has(node.attrs.href),'Unreviewed published API programme/application link')
 }
 const written=publishedText(root);need(norm(written).length>100,'Missing full original authored API criteria')
 noIndia(decoded,'Full native API content');noIndia(written,'Parsed authored native criteria')
}
const API_KEYS=['absolute_url','data_compliance','internal_job_id','location','metadata','id','updated_at','requisition_id','title',
 'company_name','first_published','language','application_deadline','content','departments','offices','ai_disclaimer','include_ai_disclaimer','ai_opt_out_request_url']
export function nativeAPI(raw,pages,now){
 const value=json(raw)
 need(exact(value,['jobs','meta'])&&exact(value.meta,['total'])&&Array.isArray(value.jobs)&&value.jobs.length>50&&value.jobs.length<=100
  &&value.meta.total===value.jobs.length&&ids(value.jobs),'Incomplete/duplicate native full API programme')
 need(pages.length===2&&pages[0].page===1&&pages[1].page===2&&pages.every(p=>p.reportedTotal===value.meta.total),'Native page/API totals disagree')
 const officeMap=new Map(),walkOffices=(rows,parent=null)=>rows.forEach(row=>{officeMap.set(row.id,{...row,parent});walkOffices(row.children,row.id)})
 walkOffices(pages[0].model.state.loaderData['routes/embed.job_board'].offices)
 const departmentMap=new Map(pages[0].model.state.loaderData['routes/embed.job_board'].departments.map(d=>[d.id,d]))
 for(const row of value.jobs){
  need(exact(row,API_KEYS),'Unreviewed full native API criteria/country fields')
  need(row.company_name==='Housecall Pro'&&integer(row.internal_job_id)&&roleURL(row.id,row.absolute_url)&&typeof row.title==='string'
   &&norm(row.title)&&row.title.length<=500&&typeof row.requisition_id==='string','Native API employer/own-role identity changed')
  noIndia(row.title,'Native API title')
  need(exact(row.location,['name']),'Unknown nested native primary country fields');country(row.location.name)
  need(row.metadata===null&&row.application_deadline===null&&row.ai_disclaimer===null&&row.include_ai_disclaimer===null
   &&row.ai_opt_out_request_url===null&&row.language==='en','Unreviewed native metadata/application/AI/deadline scope')
  need(Array.isArray(row.offices)&&row.offices.length>0&&ids(row.offices),'Unresolved native office scope')
  for(const office of row.offices){
   need(exact(office,['id','name','location','child_ids','parent_id'])&&integerList(office.child_ids)&&office.child_ids.length===0
    &&(office.parent_id===null||integer(office.parent_id)),'Unreviewed native office hierarchy/country fields')
   const native=officeMap.get(office.id)
   need(native&&native.children.length===0&&native.name===office.name&&native.parent===office.parent_id,'Native leaf office/group binding conflicts')
   country(office.name);if(office.location!==null)country(office.location)
  }
  need(Array.isArray(row.departments)&&row.departments.length===1&&ids(row.departments),'Unresolved complete native department membership')
  for(const department of row.departments)need(exact(department,['id','name','child_ids','parent_id'])&&typeof department.name==='string'
   &&integerList(department.child_ids)&&department.child_ids.length===0&&department.parent_id===DEPARTMENT_ROOT.nativeAPIParentID
   &&departmentMap.get(department.id)?.name===department.name,'Unreviewed native department hierarchy/ancestor/membership')
  need(Array.isArray(row.data_compliance)&&row.data_compliance.length===1&&isDeepStrictEqual(row.data_compliance[0],{
   type:'gdpr',requires_consent:false,requires_processing_consent:false,requires_retention_consent:false,
   retention_period:null,demographic_data_consent_applies:false}),'Unreviewed native applicant/compliance criteria')
  need(typeof row.content==='string'&&row.content.length>100,'Missing full original published API criteria')
  publishedContent(row.content);date(row.first_published,'API publication',now);date(row.updated_at,'API revision',now)
 }
 const posts=pages.flatMap(page=>page.posts);need(ids(posts)&&posts.length===value.jobs.length,'Native page membership/duplicate identities disagree')
 const byID=new Map(value.jobs.map(row=>[row.id,row]))
 for(const page of pages)for(const row of page.posts){
  const api=byID.get(row.id)
  need(api&&['id','title','internal_job_id','requisition_id','absolute_url'].every(key=>api[key]===row[key])&&api.location.name===row.location
   &&api.first_published===row.published_at&&isDeepStrictEqual(api.departments.map(d=>({id:d.id,name:d.name})),[{id:row.department.id,name:row.department.name}]),'Native SSR/full API identity/country/publication/department membership disagreement')
  if(row.updated_at!==api.updated_at)page.revisionDifferences.push({id:row.id,SSRUpdatedAt:row.updated_at,APIUpdatedAt:api.updated_at})
 }
 return {value,officeHierarchy:pages[0].model.state.loaderData['routes/embed.job_board'].offices,
  departmentHierarchyBinding:{nativeAPIParentID:DEPARTMENT_ROOT.nativeAPIParentID,nativeSSRAncestorPath:DEPARTMENT_ROOT.nativeSSRPath,
   nativeParentRecordFetched:false,unknownHierarchySupported:false},
  groupingSemantics:'South America is retained solely as the exact native parent group; Brazil is the leaf work country. No country is inferred from parent groups.'}
}
