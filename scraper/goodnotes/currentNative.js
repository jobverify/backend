import {createHash} from 'node:crypto'
import {parse} from 'acorn'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {nativeText,nativeLines,comparable,clean} from '../../scraper-support/native-sources/firstPartyNativeHtml.js'
import {readOwnedCurrentDocument,readOriginalNativeCriteria} from '../../scraper-support/native-sources/currentNativeCriteria20261106.js'
import {collectCurrentOriginalRecords,canonicalNativeRecord} from '../../scraper-support/native-sources/collectCurrentOriginalRecords20261106.js'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'

export const CAREERS_URL='https://www.goodnotes.com/careers',BOARD_URL='https://job-boards.greenhouse.io/goodnotes'
const boardRoute='routes/$url_token',detailRoute='routes/$url_token_.jobs_.$job_post_id'
const failure=message=>firstPartyFailure('goodnotes',message,{nativeAuthorityFailure:true}),need=(ok,message)=>{if(!ok)throw failure(message)}
const sha=value=>createHash('sha256').update(value).digest('hex'),hasClass=(node,value)=>(node.attrs.class??'').split(/\s+/).includes(value)
const date=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))
// Keep complete reviewed deployment pairs: a newer native ENV/asset release
// does not change the original SSR employer, role, criteria or closing checks.
const reviewedPrograms=[
 {environment:'34b8d4d0ebe91a0e5b8c77d833b48cf00d1e516ed2fed6ab8cb6b22b62d247bb',board:'e32555ea8abc0269156dd51bc104ad9e61e1181d7fee24432783b6168a43dfc9',detail:'e820b756b428ed94fb2d892538efa299ad3e4a3ade97a1111019db5f325e44b4'},
 {environment:'b74587220172d8e2cff164d662b93e4963a4c2d3dd8a01f61dbe5e076d2950f4',board:'99b41ce0befdeff58b717776d49c5cfe80b93c4539d1ac244b11baf91ab68011',detail:'bc25c4f35faef51b08e6a8e142dc9086de217518b4fe376cca65c4a8f46d8481'},
]

export function readCurrentGoodnotesCorporate(html){
 const owned=readOwnedCurrentDocument(html,{failure,title:'Careers at Goodnotes: Join Our Team',canonical:CAREERS_URL})
 const visible=readVisibleNativeDocument(html,{strict:true}),links=visible.nodes(node=>node.tag==='a'&&node.attrs.href===BOARD_URL)
 need(links.length>=1&&owned.nodes.filter(node=>node.tag==='a'&&node.attrs.href===BOARD_URL).length===links.length,'Missing or hidden current corporate Greenhouse handoff')
 return {corporateURL:CAREERS_URL,boardURL:BOARD_URL,corporateDisplayName:'Goodnotes'}
}
function readOriginalSSR(html,detail=false){
 const raw=readNativeDocument(html),unowned=raw.nodes(node=>node.tag==='script'&&!node.attrs.src&&node.raw?.startsWith('window.__remixContext = '))
 need(unowned.length===1,'Missing or ambiguous original Greenhouse state')
 const program=parse(unowned[0].raw,{ecmaVersion:'latest'}),statement=program.body[0]?.expression,left=statement?.left
 need(program.body.length===1&&program.body[0].type==='ExpressionStatement'&&statement?.type==='AssignmentExpression'&&statement.operator==='='&&left?.type==='MemberExpression'&&!left.computed&&left.object.type==='Identifier'&&left.object.name==='window'&&left.property.type==='Identifier'&&left.property.name==='__remixContext'&&statement.right.type==='ObjectExpression','Original Greenhouse state is not a literal data assignment')
 let state;try{state=JSON.parse(unowned[0].raw.slice(statement.right.start,statement.right.end))}catch{throw failure('Non-JSON original Greenhouse state')}
 const loader=state?.state?.loaderData,root=loader?.root,route=loader?.[detail?detailRoute:boardRoute]
 need(root&&route&&Object.keys(loader).length===2&&root.internal===false&&root.preview===false&&root.urlToken==='goodnotes'&&root.isJobPost===detail,'Native board context changed, filtered or previewed')
 need(root.boardConfiguration?.job_board_id===4003558004&&root.boardConfiguration.job_board_public_url===BOARD_URL&&root.boardConfiguration.logo?.href===CAREERS_URL,'Native employer-board binding changed')
 const post=detail?route.jobPost:null
 const standardTitle=detail?'Job Application for '+post?.title+' at Goodnotes':'Jobs at Goodnotes'
 const reviewedPlaceholder=detail&&['6127461004','6234388004'].includes(route.jobPostId)&&raw.nodes(node=>node.tag==='title'&&node.raw?.trim()==='page_title').length===1
 const expectedTitle=reviewedPlaceholder?'page_title':standardTitle
 const authorityURL=detail?post?.public_url:BOARD_URL,canonicalLinks=raw.nodes(node=>node.tag==='link'&&node.attrs.rel==='canonical'),canonical=canonicalLinks[0]?.attrs.href
 // Current publisher metadata uses http canonicals even though every original
 // request, board binding and public role URL is HTTPS. Never fetch a canonical.
 need(typeof authorityURL==='string'&&canonicalLinks.length===1&&[authorityURL,authorityURL.replace(/^https:/,'http:')].includes(canonical),'Native canonical is not the same public board/role path')
 const owned=readOwnedCurrentDocument(html,{failure,title:expectedTitle,canonical,eventPrograms:[]}),scripts=owned.nodes.filter(node=>node.tag==='script')
 need(scripts.length===4&&scripts.every(node=>owned.body.children.includes(node)&&!node.inert&&!node.attrs.src),'Native Greenhouse program ownership changed')
 need(scripts.slice(0,3).every(node=>Object.keys(node.attrs).length===0)&&JSON.stringify(scripts[3].attrs)===JSON.stringify({type:'module',async:''}),'Native Greenhouse program declarations changed')
 const reviewed=reviewedPrograms.find(program=>program.environment===sha(scripts[1].raw))
 need(sha(scripts[0].raw)==='82a0347349654ed2e47c9310918775b144d9da4367eae0f8634c74504a071097'&&reviewed,'Native supporting program requires review')
 need(scripts[2].raw===unowned[0].raw&&sha(scripts[3].raw)===reviewed[detail?'detail':'board'],'Native Greenhouse renderer requires review')
 return {route,root,owned}
}
export function readCurrentGoodnotesBoard(html){
 const {route}=readOriginalSSR(html),posts=route.jobPosts
 need(route.urlToken==='goodnotes'&&route.board?.name==='Goodnotes'&&route.board.public_url===BOARD_URL&&route.board.redirect_to===null,'Native board employer or URL changed')
 need(Array.isArray(route.departmentIds)&&route.departmentIds.length===0&&Array.isArray(route.officeIds)&&route.officeIds.length===0&&route.customFieldFilters&&Object.keys(route.customFieldFilters).length===0,'Native inventory is filtered')
 need(posts&&Array.isArray(posts.data)&&posts.page===1&&posts.total_pages===1&&posts.count===posts.data.length&&posts.total===posts.count&&posts.count<=50,'Native inventory pagination or total requires review')
 const ids=new Set(),visible=readVisibleNativeDocument(html,{strict:true})
 for(const row of posts.data){
  need(row&&Number.isSafeInteger(row.id)&&row.id>0&&!ids.has(row.id)&&Number.isSafeInteger(row.internal_job_id)&&typeof row.requisition_id==='string'&&typeof row.title==='string'&&clean(row.title)&&typeof row.location==='string'&&date(row.published_at)&&date(row.updated_at),'Invalid or duplicate native board vacancy')
  need(row.absolute_url===BOARD_URL+'/jobs/'+row.id,'Unbound native role URL')
  need(visible.nodes(node=>node.tag==='a'&&node.attrs.href===row.absolute_url&&clean(nativeText(node)).includes(clean(row.title))).length===1,'Native vacancy anchor missing or ambiguous')
  ids.add(row.id)
 }
 return {records:posts.data,meta:{board:route.board,count:posts.count,page:posts.page,total:posts.total,totalPages:posts.total_pages}}
}
export function readCurrentGoodnotesDetail(html,record){
 const {route,owned}=readOriginalSSR(html,true),post=route.jobPost
 need(route.urlToken==='goodnotes'&&route.jobPostId===String(record.id)&&post&&post.post_type==='job_post'&&post.company_name==='Goodnotes'&&post.redirect_to===null,'Native role employer, identity or redirect changed')
 need(post.public_url===record.absolute_url&&post.hiring_plan_id===record.internal_job_id&&post.title===record.title&&post.job_post_location===record.location&&post.published_at===record.published_at,'Native role and board record disagree')
 need(['introduction','content','conclusion'].every(key=>typeof post[key]==='string'),'Missing original role criteria blocks')
 const visible=readVisibleNativeDocument(html,{strict:true}),headings=visible.nodes(node=>node.tag==='h1'),descriptions=visible.nodes(node=>node.tag==='div'&&hasClass(node,'job__description'))
 need(headings.length===1&&clean(nativeText(headings[0]))===clean(record.title),'Owned visible role title changed')
 need(descriptions.length===1&&owned.nodes.filter(node=>node.tag==='div'&&hasClass(node,'job__description')).length===1,'Owned visible role description is ambiguous')
 const combined=[post.introduction,post.content,post.conclusion].join('\n'),criteria=readOriginalNativeCriteria(combined,failure)
 need(criteria.sourceDetailComplete&&comparable(nativeLines(descriptions[0]).join('\n'))===comparable(criteria.jobDescription),'Rendered native criteria differ from full original role data')
 return {post,criteria}
}
const nativeCountry=location=>location==='Singapore'?'Singapore':/\(UK\)$/.test(location)?'United Kingdom':null
export function normalizeCurrentGoodnotesRecord(record,opening){
 const detail=opening.details[String(record.id)],country=nativeCountry(record.location)
 return {title:clean(record.title),company:'Goodnotes',legalEmployer:null,jobId:String(record.id),sourceNativeJobId:String(record.id),requisitionId:record.requisition_id||null,
  location:record.location,country,sourceCountryScopeUnresolved:country===null,city:null,state:null,
  sourceNativeJobRecord:{board:structuredClone(record),detail:structuredClone(detail.post)},sourceExactBrandRoleScopeVerified:true,sourceEmployerScope:'corporate-declared-native-board',
  sourceUrl:record.absolute_url,applyUrl:record.absolute_url,applicationUrlIsGeneric:false,applicationVisited:false,
  department:clean(record.department?.name)||null,employmentType:null,workplaceType:null,experienceRequired:null,minimumQualification:null,preferredQualification:null,requiredSkills:[],
  postingDate:detail.post.published_at,firstPublishedAt:null,closingDate:detail.post.application_deadline??null,nativeUpdatedAt:record.updated_at,
  nativePostingDateProvenance:'Native published_at, preserved with original offset; first-publication history unverified',companyDomain:'goodnotes.com',
  sourceEmployerEvidence:{nativeEmployerDisplayName:detail.post.company_name,boardURL:BOARD_URL,corporateURL:CAREERS_URL},...detail.criteria,lifecycleCleanupAllowed:false}
}
export const runCurrentGoodnotes=options=>collectCurrentOriginalRecords(options,{source:'goodnotes',company:'Goodnotes',atsPlatform:'greenhouse-original-ssr',corporateURL:CAREERS_URL,recordKind:'vacancy-rows',
 admitted:[[CAREERS_URL,'html'],[BOARD_URL,'html']],learnedURL:(url,kind)=>kind==='html'&&/^https:\/\/job-boards\.greenhouse\.io\/goodnotes\/jobs\/[1-9]\d*$/.test(url),
 id:row=>String(row.id),active:()=>true,normalize:normalizeCurrentGoodnotesRecord,
 async open(reader){const corporate=readCurrentGoodnotesCorporate((await reader.read(CAREERS_URL)).body),board=readCurrentGoodnotesBoard((await reader.read(BOARD_URL)).body),details={}
  for(const row of board.records){reader.allow(row.absolute_url,'html');details[String(row.id)]=readCurrentGoodnotesDetail((await reader.read(row.absolute_url)).body,row)}
  return {...board,corporate,details,context:{nativeEmployerDisplayName:'Goodnotes',corporateURL:CAREERS_URL,boardURL:BOARD_URL,companyScopeQualified:false,
   originalRoleDetails:Object.fromEntries(Object.entries(details).map(([id,detail])=>[id,detail.post]))}}},
 async close(reader,opening,observe){const closing=readCurrentGoodnotesBoard((await reader.read(BOARD_URL)).body);observe(closing)
  need(canonicalNativeRecord(closing.meta.board)===canonicalNativeRecord(opening.meta.board),'Native board employer metadata changed at closing')
  for(const row of closing.records){const original=opening.records.find(record=>record.id===row.id)
   if(!original||canonicalNativeRecord(row)!==canonicalNativeRecord(original))continue
   const detail=readCurrentGoodnotesDetail((await reader.read(row.absolute_url)).body,row)
   need(canonicalNativeRecord(detail.post)===canonicalNativeRecord(opening.details[String(row.id)].post),'Native role criteria changed at closing')}
  const corporate=readCurrentGoodnotesCorporate((await reader.read(CAREERS_URL)).body)
  need(canonicalNativeRecord(corporate)===canonicalNativeRecord(opening.corporate),'Corporate handoff changed at closing');return closing},
})
