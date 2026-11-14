import {createHash} from 'node:crypto'
import {parse} from 'acorn'
import {readNativeDocument,decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'

export const FACTSET_CAREERS='https://www.factset.com/careers'
export const FACTSET_NATIVE_EMPLOYER='30097 FactSet Systems India Private Limited'
export const FACTSET_WORKDAY={origin:'https://factset.wd108.myworkdayjobs.com',tenant:'factset',site:'FactSetCareers'}
const REVIEWED_RENDERERS={
 'https://www.factset.com/assets/index-CJaIwYkV.js':'575b59fa2aaedc23f433c8664241c0535ab087daebb2e261225cb66b1ea4a479',
 'https://www.factset.com/assets/index--Pj3DBjZ.js':'19c18961e30aa70fb08e69f85177f6b9b8d05ee78e14034217dd963fdc27cb4f',
}
// Complete genuine shells, paired with their declared program. The current
// shell's only variable bytes are the same canonical 16-byte CSP nonce in
// twelve script attributes and the prefetch spark.nonce JSON value. Consume
// each exact literal run and each typed slot; never normalize the document.
const REVIEWED_SHELLS={
 'https://www.factset.com/assets/index-CJaIwYkV.js':{bytes:6088,literals:[
  [6088,'c28c3de5cedaebb2ea305d87209467c1be2410b2ce718e406223750280182a3a'],
 ]},
 'https://www.factset.com/assets/index--Pj3DBjZ.js':{bytes:6519,literals:[
  [529,'3a0d80a6011bb9ee50b0369b5e1a369d3dbf3cff38d9a4900e32d2fd00b37f9c'], // script[0].nonce
  [86,'ac6e642b7767ebf26c008ecbc7ee063b247ed50d0bf30c5cbaec533303c41545'], // script[1].nonce
  [137,'373cf0d213480721b28d8ca47861a7a9cf65af2a2f93e14ed29bcc3b1c007152'], // script[2].nonce
  [2311,'7bf0105027cdcd2c21377eb2bc1ff086045f00b25c2211078b81ac98891ef1a2'], // script[3].nonce
  [97,'9610a4641c7e85052c7d290e0b07fed227110ab7625ffa5afdde80be1b8e3dff'], // script[4].nonce
  [949,'afd407f3dac5b04f05a7f4832aa90458e134db282089c2d221b2b1f6b624635d'], // script[5].nonce
  [260,'0eae454623fe74574645c9a68a1aedb27994680530b6bb61457174243bbedbdc'], // script[6].nonce
  [162,'20cf9c1b2597842c712c7e0c53f62d493d8bdc42a813e30aa6b92e77905b4193'], // script[7].nonce
  [346,'e95dca4bdd74a5943a76e7b4e946dd2d4dd641f35332df142897df3a5468cc4a'], // script[8].nonce
  [189,'ce4a23d76be21e7d61eede1502c7dd2121794139321a9361c47c946e5d396896'], // script[9].nonce
  [220,'d7fa52e7d3ff7bf904164552a3aa58b16d686544f8df4bc6f67a683869c60da1'], // script[10].nonce
  [144,'66ce41cfe57614d0a989ef84e109ac3b267eea72f3c9322b852b43bcb0780352'], // script[11].nonce
  [388,'e19851486e133b86f579923ee69f3e1e5551ab9cd1bbfdef553cdc00afa4a7b5'], // prefetch.spark.nonce
  [389,'a59f530409f2dfbe49fef065695109b247bc67b28f739efeeb45c84fb2280d26'],
 ]},
}
const sha=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex')
const check=(condition,message)=>{if(!condition)throw Error('FactSet current publisher: '+message)}
const walk=(node,visit)=>{
 if(!node||typeof node!=='object')return
 visit(node)
 for(const value of Object.values(node)){
  if(Array.isArray(value))for(const child of value)walk(child,visit)
  else if(value&&typeof value==='object')walk(value,visit)
 }
}
const member=(node,object,property)=>node?.type==='MemberExpression'&&!node.computed&&node.object?.type==='Identifier'
 &&node.object.name===object&&node.property?.name===property
const workdayReference=node=>member(node,'window','workday')||node?.type==='MemberExpression'&&node.computed
 &&node.object?.type==='Identifier'&&node.object.name==='window'&&node.property?.type==='Literal'&&node.property.value==='workday'
function reviewedCorporateShell(body,rendererURL){
 check(typeof body==='string'&&!body.includes('\uFFFD'),'invalid UTF-8 corporate shell')
 const profile=REVIEWED_SHELLS[rendererURL],bytes=Buffer.from(body,'utf8')
 check(profile&&bytes.length===profile.bytes,'reviewed corporate shell changed')
 let offset=0,nonce
 for(const[index,[length,hash]]of profile.literals.entries()){
  check(createHash('sha256').update(bytes.subarray(offset,offset+length)).digest('hex')===hash,'reviewed corporate shell changed')
  offset+=length
  if(index===profile.literals.length-1)continue
  const value=bytes.subarray(offset,offset+24).toString('utf8')
  check(/^[A-Za-z0-9+/]{22}==$/.test(value)&&Buffer.from(value,'base64').length===16
   &&Buffer.from(value,'base64').toString('base64')===value&&(nonce===undefined||nonce===value),'reviewed corporate shell changed')
  nonce??=value;offset+=24
 }
 check(offset===bytes.length,'reviewed corporate shell changed')
 return{bytes:profile.bytes,nonceSlots:profile.literals.length-1,nonceFormat:'same canonical-base64-16-byte value in every explicit slot'}
}
function reviewedPagePrefix(renderer,declaredURL){
 const body=renderer.html
 // The bounded shared stream reader retains a UTF-8 BOM. Neither reviewed
 // entity contains U+FFFD, so rejecting replacement decoding makes this full
 // UTF-8 hash also an exact original-entity pin, without text() normalization.
 check(typeof body==='string'&&!body.includes('\uFFFD'),'invalid UTF-8 active renderer')
 check(renderer.url===declaredURL&&Object.hasOwn(REVIEWED_RENDERERS,declaredURL)
  &&sha(body)===REVIEWED_RENDERERS[declaredURL],'reviewed active renderer changed')
 const program=parse(body,{ecmaVersion:'latest',sourceType:'module'}),matches=[]
 // The reviewed active Vue route loader fetches this template using the route
 // slug, then assigns its JSON content/SEO to the mounted page. No JS executes.
 walk(program,node=>{
  if(node.type!=='CallExpression'||node.callee?.type!=='Identifier'||node.callee.name!=='fetch'||node.arguments.length!==1)return
  const arg=node.arguments[0]
  if(arg.type==='TemplateLiteral'&&arg.quasis.length===2&&arg.expressions.length===1
   &&arg.expressions[0].type==='Identifier'&&arg.quasis[0].value.cooked==='/api/page/'&&arg.quasis[1].value.cooked==='')matches.push(arg.quasis[0].value.cooked)
 })
 check(matches.length===1,'reviewed current CMS route loader changed')
 return matches[0]
}
// Experience and nested renderers spread these actual CMS models into props
// and inherited DOM attributes. Only the genuine prior/current input envelope
// is reviewed; unknown props cannot silently hide or personalize the handoff.
const modelIdentity={__id:'string',__typename:'string'}
const CMS_MODEL_FIELDS={
 PageGeneric:{...modelIdentity,name:'string',sections:'array'},
 HomepageHero:{...modelIdentity,textColor:['White'],contentAlignment:['left'],headline:'object',body:'object',cta:'object',
  ctaColor:['White'],sideVisualAsset:'object',backgroundImage:'string',height:'number',sideVisualAssetWidthLimit:'number',textMargin:'number'},
 Image:{__component:['Image'],name:'string',src:'string',altText:'string'},
 FlexibleRichText:{...modelIdentity,backgroundColor:['White'],headline:'object',columnOne:'object'},
 MediaSpotlight:{...modelIdentity,name:'string',__component:['IframeVideo'],src:'string',videoTitle:'string'},
 Divider:{...modelIdentity,name:'string'},
 StoryStack:{...modelIdentity,sections:'array'},
 StoryStackSection:{...modelIdentity,headline:'string',body:'object',image:'object'},
 PersonCardGrid:{...modelIdentity,name:'string',personList:'array'},
 Person:{...modelIdentity,name:'string',image:'object',title:'string'},
 Awards:{...modelIdentity,headline:'string',theme:['light'],awards:'array'},
 AwardCard:{...modelIdentity,name:'string',awardImage:'object',date:'string',description:'string'},
 LeadGenCard:{...modelIdentity,name:'string',headline:'string',body:'string',cta:'object'},
 LandingPageHero:{...modelIdentity,name:'string',headline:'string',body:'string',desktopSettings:'object',mobileSettings:'object'},
 Faq:{...modelIdentity,backgroundColor:['White'],headline:'string',pairs:'array',sectionDisplay:['None']},
 FaqQuestionAnswerPair:{...modelIdentity,question:'string',answer:'object'},
}
const CMS_SECTION_KINDS=new Set(['HomepageHero','FlexibleRichText','MediaSpotlight','Divider','StoryStack',
 'PersonCardGrid','Awards','LeadGenCard','LandingPageHero','Faq'])
const CMS_CHILD_MODELS={
 PageGeneric:{sections:'section'},StoryStack:{sections:'StoryStackSection'},PersonCardGrid:{personList:'Person'},
 Awards:{awards:'AwardCard'},Faq:{pairs:'FaqQuestionAnswerPair'},
}
const CMS_IMAGE_FIELDS={HomepageHero:['sideVisualAsset'],StoryStackSection:['image'],Person:['image'],AwardCard:['awardImage']}
const CMS_RICH_TEXT_FIELDS={HomepageHero:['headline','body'],FlexibleRichText:['headline','columnOne'],
 StoryStackSection:['body'],FaqQuestionAnswerPair:['answer']}
const cmsObject=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)
const exactKeys=(value,keys)=>cmsObject(value)&&Object.keys(value).sort().join(',')===keys
function reviewedRichText(document,label){
 const reason=label+' CMS RichText envelope changed'
 // The exact renderer replaces unknown nodes and drops their descendants;
 // unknown text marks can throw. Only these genuine active node/data shapes
 // may contribute publisher text or the legal-navigation handoff.
 const blocks=new Set(['paragraph','heading-2','heading-3','unordered-list','ordered-list','list-item'])
 const visit=(node,root=false)=>{
  check(cmsObject(node)&&typeof node.nodeType==='string',reason)
  if(node.nodeType==='text'){
   check(!root&&exactKeys(node,'marks,nodeType,value')&&typeof node.value==='string'&&Array.isArray(node.marks),reason)
   for(const mark of node.marks)check(exactKeys(mark,'type')&&['bold','italic','underline'].includes(mark.type),reason)
   return
  }
  const kind=node.nodeType,hasData=root||kind==='hyperlink'||kind==='entry-hyperlink'
  check((root?kind==='document':blocks.has(kind)||kind==='hyperlink'||kind==='entry-hyperlink')
   &&exactKeys(node,hasData?'content,data,nodeType':'content,nodeType')&&Array.isArray(node.content),reason)
  if(root)check(exactKeys(node.data,''),reason)
  else if(kind==='hyperlink')check(exactKeys(node.data,'uri')&&typeof node.data.uri==='string'&&node.data.uri.length>0,reason)
  else if(kind==='entry-hyperlink')check(exactKeys(node.data,'target')&&exactKeys(node.data.target,'fields')
   &&exactKeys(node.data.target.fields,'slug')&&typeof node.data.target.fields.slug==='string'&&node.data.target.fields.slug.length>0,reason)
  for(const child of node.content)visit(child)
 }
 visit(document,true)
}
function reviewedCmsModel(model,label,expected){
 const reason=label+' CMS component prop envelope changed'
 check(cmsObject(model),reason)
 const kind=expected==='Image'?'Image':model.__typename
 check(typeof kind==='string'&&Object.hasOwn(CMS_MODEL_FIELDS,kind)&&(!expected||kind===expected),reason)
 if(kind==='Image')check(model.__component==='Image',reason)
 else check(typeof model.__id==='string'&&model.__id.trim().length>0,reason)
 const fields=CMS_MODEL_FIELDS[kind]
 for(const[key,value]of Object.entries(model)){
  check(Object.hasOwn(fields,key),reason)
  const rule=fields[key]
  check(Array.isArray(rule)?rule.includes(value):rule==='array'?Array.isArray(value):rule==='object'?cmsObject(value)
   :rule==='number'?typeof value==='number'&&Number.isFinite(value)&&value>=0:typeof value===rule,reason)
 }
 for(const[field,childKind]of Object.entries(CMS_CHILD_MODELS[kind]||{})){
  if(!Object.hasOwn(model,field))continue
  for(const child of model[field]){
   if(childKind==='section'){
    check(cmsObject(child)&&CMS_SECTION_KINDS.has(child.__typename),reason)
    reviewedCmsModel(child,label)
   }else reviewedCmsModel(child,label,childKind)
  }
 }
 for(const field of CMS_IMAGE_FIELDS[kind]||[])if(Object.hasOwn(model,field))reviewedCmsModel(model[field],label,'Image')
 for(const field of CMS_RICH_TEXT_FIELDS[kind]||[])if(Object.hasOwn(model,field))reviewedRichText(model[field],label)
}
const cms=(value,label)=>{
 check(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join(',')==='content,locale,pageType,seo'
  &&value.pageType==='Website Page'&&value.locale==='en-US'&&value.content?.__typename==='PageGeneric'
  &&typeof value.content.name==='string'&&Array.isArray(value.content.sections)&&value.seo?.__typename==='Seo'
  &&value.seo.nofollow===false&&value.seo.noindex===false,label+' CMS schema changed')
 reviewedCmsModel(value.content,label,'PageGeneric')
 return value
}
const richText=value=>{
 check(value?.nodeType==='document'&&Array.isArray(value.content),'current legal publisher identity changed')
 const texts=[]
 const visit=node=>{if(node?.nodeType==='text'&&typeof node.value==='string')texts.push(node.value)
  else if(Array.isArray(node?.content))for(const child of node.content)visit(child)}
 visit(value);return texts.join(' ').replace(/\s+/g,' ').trim()
}
function workdayConfiguration(page){
 const document=readNativeDocument(page.html),models=[]
 check(!document.nodes(n=>n.tag==='base').length,'native Workday board configuration changed')
 for(const script of document.nodes(n=>n.tag==='script'&&!n.attrs.src&&!Object.hasOwn(n.attrs,'nomodule')
  &&(!n.attrs.type||n.attrs.type==='text/javascript'))){
  const program=parse(script.raw||'',{ecmaVersion:'latest',sourceType:'script'})
  const assignments=[]
  walk(program,node=>{if(node.type==='AssignmentExpression'&&workdayReference(node.left))assignments.push(node)})
  const active=program.body.filter(node=>node.type==='ExpressionStatement'&&node.expression.type==='AssignmentExpression'
   &&member(node.expression.left,'window','workday')).map(node=>node.expression)
  check(assignments.length===active.length,'native Workday board configuration changed')
  for(const node of active){
   check(node.operator==='=','native Workday board configuration changed')
   check(node.right?.type==='LogicalExpression'&&node.right.operator==='||'&&member(node.right.left,'window','workday')
    &&node.right.right?.type==='ObjectExpression','native Workday board configuration changed')
   const fields=new Map()
   for(const property of node.right.right.properties){
    check(property.type==='Property'&&!property.computed&&property.kind==='init'&&!property.method,'native Workday board configuration changed')
    const key=property.key.type==='Identifier'?property.key.name:property.key.value
    check(typeof key==='string'&&!fields.has(key),'native Workday board configuration changed')
    fields.set(key,property.value)
   }
   const expected={tenant:'factset',siteId:'FactSetCareers',locale:'',requestLocale:'en-US',environment:'PROD',isExternal:true,appName:'cxs',clientOrigin:'https://wd108.myworkday.com'}
   for(const[key,value]of Object.entries(expected))check(fields.get(key)?.type==='Literal'&&fields.get(key).value===value,'native Workday board configuration changed')
   models.push(expected)
  }
 }
 check(models.length===1,'native Workday board configuration changed')
 return models[0]
}

// Trusted source configuration only. Every supplied reader is the shared
// bounded authority/MIME/request-budget reader; the callback receives no fetch
// or general authority grant. The CMS/native URLs below come from live data.
export async function readFactSetPublisherDeclaration({page,readRenderer,readJson,readDeclaredBoardPage}){
 check(page.url===FACTSET_CAREERS,'current careers page identity changed')
 const document=readNativeDocument(page.html)
 check(!document.nodes(n=>n.tag==='base').length,'unreviewed current company document base')
 const titles=document.nodes(n=>n.tag==='title').map(n=>decodeNativeEntities(n.raw||''))
 check(titles.length===1&&/\bFactSet\b/.test(titles[0])&&/\bCareer/.test(titles[0]),'current corporate publisher identity changed')
 const canonicals=document.nodes(n=>n.tag==='link'&&(n.attrs.rel||'').toLowerCase()==='canonical')
 check(canonicals.length===1&&canonicals[0].attrs.href===FACTSET_CAREERS,'current careers page identity changed')
 const entries=document.nodes(n=>n.tag==='script'&&n.attrs.type==='module'&&n.attrs.src)
 check(entries.length===1&&/^\/assets\/index-[a-zA-Z0-9_-]+\.js$/.test(entries[0].attrs.src),'reviewed active renderer changed')
 const rendererURL=new URL(entries[0].attrs.src,page.url).href
 check(Object.hasOwn(REVIEWED_RENDERERS,rendererURL),'reviewed active renderer changed')
 const publisherShell=reviewedCorporateShell(page.html,rendererURL)
 const renderer=await readRenderer(rendererURL),prefix=reviewedPagePrefix(renderer,rendererURL)
 const careersURL=new URL(prefix+new URL(page.url).pathname.slice(1),page.url).href
 const careers=cms(await readJson(careersURL),'careers'),sections=careers.content.sections
 check(careers.content.name==='Careers Homepage Page DIY'&&careers.seo.title===titles[0]&&sections.length===13
  &&sections[0]?.__typename==='HomepageHero'&&sections[10]?.__typename==='LeadGenCard','careers CMS schema changed')
 const ctas=[sections[0].cta,sections[10].cta],boardURL=ctas[0]?.href
 // The reviewed buttons prefer a route, and the hero can prefer scrolling.
 // Neither alternate action may conceal the otherwise matching native href.
 for(const [index,cta] of ctas.entries())check(cta&&cta.label==='View Open Roles'&&cta.target==='_blank'&&cta.link?.target==='_blank'
  &&cta.to==null&&(index!==0||cta.scrollToComponent==null)
  &&cta.href===boardURL&&cta.link.href===boardURL&&boardURL===FACTSET_WORKDAY.origin+'/'+FACTSET_WORKDAY.site,'current careers CTA changed')
 const legalLinks=[]
 const column=sections[12]?.columnOne
 check(sections[12]?.__typename==='FlexibleRichText'&&column?.nodeType==='document','current legal navigation changed')
 const links=node=>{if(node?.nodeType==='hyperlink'&&node.data?.uri==='https://www.factset.com/legal')legalLinks.push(node.data.uri)
  for(const child of Array.isArray(node?.content)?node.content:[])links(child)}
 links(column);check(legalLinks.length===1,'current legal navigation changed')
 const legalURL=new URL(prefix+new URL(legalLinks[0]).pathname.slice(1),page.url).href
 const legal=cms(await readJson(legalURL),'legal'),faq=legal.content.sections.filter(s=>s.__typename==='Faq')
 check(legal.content.name==='Legal Compose Page - Page: DIY'&&faq.length===1&&Array.isArray(faq[0].pairs),'current legal publisher identity changed')
 const privacy=faq[0].pairs.filter(p=>p.question==='Privacy Notice'),terms=faq[0].pairs.filter(p=>p.question==='Terms of Use')
 check(privacy.length===1&&terms.length===1,'current legal publisher identity changed')
 const privacyStatement='FactSet Research Systems (“FactSet,” “we” or “us”) is a provider of integrated financial information and analytical applications to the global investment community.'
 const ownerStatement='The Site is owned and operated by FactSet Research Systems Inc. and its affiliates (together, “FactSet”)'
 check(richText(privacy[0].answer).includes(privacyStatement)&&richText(terms[0].answer).includes(ownerStatement),'current legal publisher identity changed')
 const board=await readDeclaredBoardPage(boardURL),nativeConfig=workdayConfiguration(board)
 const context={publisher:'FactSet Research Systems',brand:'FactSet',publisherShell,rendererURL:renderer.url,rendererSHA256:sha(renderer.html),cmsPrefix:prefix,
  careersURL,pageType:careers.pageType,locale:careers.locale,title:careers.seo.title,ctas:structuredClone(ctas),legalURL,privacyStatement,ownerStatement,nativeConfig}
 return{url:boardURL,context,evidence:{publisherURL:page.url,publisherBodySHA256:sha(page.html),rendererURL:renderer.url,rendererBodySHA256:sha(renderer.html),
  careersURL,careersPayloadSHA256:sha(careers),declaredCTAs:structuredClone(ctas),legalURL,legalPayloadSHA256:sha(legal),privacyStatement,ownerStatement,
  nativeBoardURL:board.url,nativeBoardBodySHA256:sha(board.html),nativeConfig},payloads:{careers,legal,nativeConfig}}
}
