import {createHash} from 'node:crypto'
import {parse as parseJavaScript} from 'acorn'
import {decodeHTML} from 'entities/decode'
import {readNativeDocument,readNativeAttributeTokens} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence,readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

export const PROVIDENCE_INDIA_CAREERS_URL='https://www.providence.in/experienced-professionals/'
export const PROVIDENCE_INDIA_BOARD_URL='https://careers.providence.in/'
export const PROVIDENCE_INDIA_SEARCH_URL='https://careers.providence.in/search/'
const origin='https://careers.providence.in',sha=value=>createHash('sha256').update(value).digest('hex')
// These are passive surface fingerprints, never executable browser programs.
// Any unreviewed program/style is held; browser/runtime equivalence is unknown.
const surfacePins={"inlinePrograms":["fb63230c9d96a3801846cc60129e09098a5e9c5785a0cf93d2590defe5c9f693","02a10e27cbeed0ce66f770879995cfff941694feb62677678f1e8eaa0d97edcc","07104cde395441c8152615e82e4b00798ca80ac80a164452f3744fe7eca8a7c5","0ab06ed30b0a3c7b4f3bd2e2793ac5e35a79eb81d33552bebeb0c9562be5c6aa","0d8bef99a34b9446ad386668c9742d804417dad6f930213a1dd1cbb8dacbd6e3","0de73f24492daeb7478cbf7bb0ac612a1e26628e8d258e9e1d09f77cf5245b81","10531cb9ccd59383133c85843a19c55ba0a27d1a2eb912628e9bd7f68b479aa5","17a9d12f09b6512cbcd03af4b3057ef4c1405bfc978b02075cb62e31b73742c4","1a1933e07944bb7055afb0e743ebc23c817621b58028a5d699d7b4246b0a3bf7","1a1aa0ff1d6f105a3a9ab7b54fe0bde6f990a0e892b917920d45cfbdb94dc30d","2ef77ccccc1bf251986bcaf9039be5fd64813ec36aba384539857c28ca1298ce","32fef0979486ee558c9850ba0f7251472aab1c6bc701c8c76c89c1cde22fe552","3e25cbdabcce23f48bd743dc1a96966740ddfa3d364c1f4b15a4ec6a4868c55f","48bdab7ace2f6f6869ce06323d67643ce1628ee8e0bf66cc072005aa908b51b1","4a1ab69ed7fa61e5385ca970bf06b3e1afafc49efaeace8ec022766e16e72433","504fe6252cec1069e7a3c923336ac365684d2c966af4e693d3550f6c44bc24b5","52a325813a2325198fe09f47286a5871397bcafe6cf8e522ffa0592e082e4811","549094b45e3026668ada8b457887da522020609a49952e7b1d1747b643cef720","54d71135809ade82d0c949bfea6bdd0ad0dc95aee506a9848d41408c9672dbb7","663587c1ee2b84de1d83349b894b3168dc9b31c52969ebbbcf4ebe2346aa8a81","67cf1b1696f640923b59649a7c87b8cc5d6ceb075f2d11abba24169cc1410562","697110ea56541f2ab10cbfd6823baac94d5150ce2ff69e1f46d41f0b71f914d4","6a07f60ca9cc7989ee52cce4408c6e01cda72bd8f740c47b98c670b4f28ef9a1","6a52cdf04c78a6ef6d49293d11ba4fcccf9009a95c18ccda73a69be086df28d1","6b1828cf0d0aa8f8fd8715b7e6b8b51e729951abaf4f17698abec4e598543da2","6c74f50165614ec74b8463c3c640039fe6d3c1f92c7d09a30c3ff7b164dd7e6c","6f253b9c6c0dde26a5515dbe9820123ec35be4d748c71d3c00a0e9ba47aa108a","71506d89be556b96875627db5842a8508cdf061f2aaa621ac0891f0f90a8838b","71a1ee88530a3b128e52436a666724fea024207ffdab360e9808706ed0b2be8e","73a24d7124e7719cda57648e966fe7381baddcb52ec955f5c114b0a0a077090b","73e468f65d5fb6ef09528f7bc878af7ff134dceca36f1340231ed1f2e24a7fd0","74ed0a4901b0090d64c880c2c8a70eddab76a93d5f82e8680b0c368c08a937fd","81c5f53fe9b4d73433933b2c3c6dd15ed24c2b1e3911f9e238787415849e5261","822f93d2f43e86d20595af93cae6233f8a476ac94d08de9c05ba66377bdc66b6","8b817ebfa7ccacef3c8b956d0144c758ece54f8abb3f70e30c7c4491384faa96","94c4eed60653e14337c021261a52581e9b6f93ae9ba512912ca30ce656b3ac64","95fecab9d6a2d2cce33108cd42ce8eb0db3ab7994e78d4c88ae84a533ef0494b","9b0dc40a11e8c91bd58deb8f25129349cbf52b25ec32d9e473ee3b26e9d41b45","a0f6251d9cc17d9465b91ee61c074263322f3e4898c64b68b33f20bdcda0c8ad","a1bc59173ba7c9fe7283067d7ba5582d550948b47a5bbb2db432b10dc9941dba","aeac4c325dc29a3bac2f056ba14a82b286cfca793f1422364f8908eaa9e2d3a4","b5999c653d01098e79609792447c0ed69aea5ab36391639703f52c52a6ba716b","b65ee88aff480f53d3a26b1daa65b30e3f37e4c732ebae74cc91443382817cb6","bdf6b5a4126245a32f677f94cb474e0f31d060c762ff13979fb997413049c534","c07b49c2b43673d6ee748eebc6eaaadfa868d2fa2c9f95531ec70984e5432664","c5444b3ae6fbbbc1260936d09a9ed03200cfb6a528acf85dcace6510a07827d6","cbfd4313c34cb616f6fcea00761f67d95411884c5ba378dddae726d440dff376","d2d9d75e9f739747bd86f99d4dfd3655f3cd3da377b7b250c6c20f91d0b9e203","d37ef4938c8ae1d3621058c0b807b594bdff045977dab405590883e514289ac3","d55ed0ead4478d89989e9f9de13e6e1f7d3dbe04063eef5e0e9bb6c872daeba4","da05593aa4dcd8fc99259d4ecbac60f0324d6b1e3bc2ad0065fa366f00a654e0","da906c4a4e472448d5959ae4aa060640cd35ae8ab81c0da3369cbcf47624d961","0466e7e7fea34a0310b694779ae170429d464b6dce466b32304b858d3bb64cae","df2587eefc79005c3b2c923f2644663be9d3259a3eb6c4cb5459fa77eca33caf","dfb4b48c4bd8e637496f8761983f6a57606215181d1ee964f36cd25dac4cc684","e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855","eb160684f91d9fc6e2358bf3be097338be83bed759c6dbc295c855d1086f5852","ee631b0a1097b819fe0bba706e73847a2fd8bca849a0a8ab81dbdeb57f45bb32"],"inlineStyles":["1c6ad4b1ca9bf9a9690e0a109a4fbd4a37a42612f1927d4baeb64f6822c8c250","33f12c77c28663bf60c8ce8af3c7e32eb308b4345b6302452cf2f8d5cb4b7a08","3c825ea390fc421070769158a853048c7e1d395fbaf948d6aeb19dec3dbeae42","3f16d5cf0cc29d9c43342a1e0dcc209e2573598f4ef28d64e786ca377c294734","3f4425ee7e3e739de9d2e30b0704edb20d446329f7faec8573134c37396736aa","4862b92e34a6ee62bd1d6a5bb2aad6bd08d40d3046bd105ed0e17f17c47fc4d3","49d177f3325171f58e97f7a9ae022c7996ed4084ce24152da049d04563f11878","4b90bf124af0b8477e6ccc73d8510277f853f9ee829b7e8f2e5ee00642d2db72","5147657e99eaf5773abbfed12e51ce7a25de833870b74ddc645ccfbae3574238","573b679a73bc0a78e7faffbe2058f8efb83b2b4ce7f8e201330c7be1f14c8fa5","5aa48a1ecc2f0234950998adaa55f816adf9597b5d95dc131a70f55a4a429b2a","5f450ae16e0250a685f87a3a663220bd90c676613357e53671d7a4584ea60b36","66b1a859b63072ec2fd3b805785793f938e9521c84dd7448dfe9b76cc40e3c56","6a922fcfbf7c2bfdae926a1a03c9344c8a8f9a3bd5f662e07228239bc22c4ac6","72f62b2225313d79f8cf7812045c1883fc6a3297b1ce3c1e7000f3188950d026","766881b567cd0558c1fe478a1078093e8c6f14c3aa5c79925e84b8354d76ab2a","78de55812716e51d924b76d06bd6693a63551564e04a9950c857a8f7acc51ece","7cab50e70563cd63a6b5ffc1de56282313f534b1d9405099ff042553443139cc","a518139084081158fdd959d238a15e32afdc04e39656f26a9d03bd8616d76adb","bbef38023ef0a1e4ee870c131ae091024129fd619e95db75130501bbf5790bdc","c8e3860de1d5c91c1555842f479f8c1c5b53e414dfd60330a1ecf17913d59429","cb9a880a9eeeda474ebea017e0dd2c14bf8a85b83224d574ef35eb74c1a36911","e0be193f05253a44cd4a2edc25a2acd5b86086bb91ddbea78e69f1ae2b96a9c1","f6d229cd7930978e52e14cb2c97a92dcbb802ef849d92d04ec5ff870e8781419","f92b0e94a7778aa11aa0e3a8277ca98fc6fdb141506c3d3d4a9771eae03a9201","fa9e874c671e4f7ed100bcd36aac04ec7ad984194d91a6b8bab810455fdc109c"],"scriptSrc":["/js/override.js?locale=en_US&i=565448483","/js/override.js?locale=en_US&i=1008964815","/js/override.js?locale=en_US&i=585000988","/js/override.js?locale=en_US&i=745724182","/platform/js/j2w/j2w.fallbacks.js","/platform/js/j2w/min/j2w.agent.min.js?h=275f70e9","/platform/js/j2w/min/j2w.apply.min.js?h=275f70e9","/platform/js/j2w/min/j2w.cookiemanager.min.js?h=275f70e9","/platform/js/j2w/min/j2w.core.min.js?h=275f70e9","/platform/js/j2w/min/j2w.sso.min.js?h=275f70e9","/platform/js/j2w/min/j2w.tc.min.js?h=275f70e9","/platform/js/j2w/min/j2w.user.min.js?h=275f70e9","/platform/js/jquery/jquery-migrate-1.4.1.js","/platform/js/jquery/jquery.lightbox_me.js","/platform/js/jquery/jquery.placeholder.2.0.7.min.js","/platform/js/jquery/jquery.watermark.js","/platform/js/jquery/js.cookie-2.2.1.min.js","/platform/js/localized/strings_en_US.js?h=275f70e9","/platform/js/search/search.js?h=275f70e9","/platform/js/tc/subscribeWidget.js?h=275f70e9","https://careers.providence.in/platform/bootstrap/3.4.8_NES/js/bootstrap.min.js","https://careers.providence.in/platform/bootstrap/3.4.8_NES/js/lib/dompurify/purify.min.js","https://careers.providence.in/platform/js/j2w/min/j2w.cookiemanagershared.min.js?h=275f70e9","https://hcm44.sapsf.com/verp/vmod_v1/ui/extlib/jquery_3.5.1/jquery-migrate.js","https://hcm44.sapsf.com/verp/vmod_v1/ui/extlib/jquery_3.5.1/jquery.js","https://www.googletagmanager.com/gtag/js?id=G-NPN6JP6PHM","https://www.providence.in/wp-content/plugins/complianz-gdpr-premium/cookiebanner/js/complianz.min.js"],"stylesheetHref":["//cdn.jsdelivr.net/npm/intl-tel-input@18.5.3/build/css/intlTelInput.css?ver=18.5.3","//rmkcdn.successfactors.com/1613b1dc/348ddb45-7bcc-47e0-a47a-8.css","/platform/csb/css/customHeader.css?h=275f70e9","/platform/csb/css/fullContent.css?h=275f70e9","/platform/css/j2w/min/BS3ColumnizedSearch.min.css?h=275f70e9","/platform/css/j2w/min/bootstrapV3.global.responsive.min.css?h=275f70e9","/platform/css/j2w/min/sitebuilderframework.min.css?h=275f70e9","/platform/css/search/BS3ColumnizedSearchHideLabels.css?h=275f70e9","/platform/fontawesome4.7/css/font-awesome-4.7.0.min.css?h=275f70e9","https://careers.providence.in/platform/bootstrap/3.4.8_NES/css/bootstrap.min.css","https://www.providence.in/wp-content/litespeed/css/ace48e898fc947c74d6098cc005a6fb2.css?ver=07e5c","https://www.providence.in/wp-content/litespeed/css/3fabd0e978c031ea11ad044dda73f32e.css?ver=07e5c"]}
const bound=Object.fromEntries(Object.entries(surfacePins).map(([k,v])=>[k,new Set(v)]))
const clean=value=>value.replace(/\s+/g,' ').trim()
const ownedErrors=new WeakSet()
const gap=(message,evidence,cause)=>{const error=Object.assign(new Error('Providence India: '+message,{cause}),{
 source:'providence',failureKind:'coverage_gap',softFailure:true,abortRetries:true,
 sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,nativeEvidence:evidence,
});ownedErrors.add(error);return error}
const need=(ok,message,evidence)=>{if(!ok)throw gap(message,evidence)}
const one=(values,label)=>{need(values.length===1,'Expected one '+label,{count:values.length});return values[0]}
const descendants=node=>[node,...node.children.filter(x=>typeof x!=='string').flatMap(descendants)]
const inScope=(node,owner)=>{while(node){if(node===owner)return true;node=node.parent}return false}
const classes=(n,name)=>(n.attrs.class||'').split(/\s+/).includes(name)
const textLeaf=value=>{
 for(const m of value.matchAll(/&#(?:x([\da-f]+)|(\d+));/gi)){
  const n=m[1]===undefined?Number(m[2]):parseInt(m[1],16)
  need(Number.isSafeInteger(n)&&n<=0x10ffff&&!(n>=0xd800&&n<=0xdfff),'Invalid character reference',{rawReference:m[0]})
 }
 return decodeHTML(value)
}
const text=node=>node.tag==='script'||node.tag==='style'?'':clean(node.children.map(c=>typeof c==='string'?textLeaf(c):text(c)).join(' '))
// Positions retain whole original owner/criteria bytes. The independent shared
// lexer below checks the authority tree; neither parser executes page programs.
const tree=html=>{
 try{
 need(typeof html==='string','Missing HTML')
 const root={tag:'root',attrs:{},children:[],start:0,end:html.length},stack=[root]
 const raw=new Set(['script','style','textarea','title','xmp','iframe','noembed','noframes','plaintext','noscript'])
 const voids=new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'])
 const tokens=/<!--[\s\S]*?(?:-->|$)|<![^>]*>|<\/?([a-z][a-z0-9:_-]*)(?=[\t\n\f\r />])((?:[^"'<>]|"[^"]*"|'[^']*')*)>/gi
 let cursor=0,m
 while((m=tokens.exec(html))){const parent=stack.at(-1)
  if(m.index>cursor)parent.children.push(html.slice(cursor,m.index));cursor=tokens.lastIndex
  if(!m[1])continue
  const tag=m[1].toLowerCase()
  if(m[0].startsWith('</')){const at=stack.findLastIndex(n=>n.tag===tag);if(at>0){const n=stack[at];n.closeStart=m.index;n.end=cursor;stack.length=at}continue}
  const attrs=Object.create(null),attributeTokens=readNativeAttributeTokens(m[2])
  for(const[k,v]of attributeTokens){if(!Object.hasOwn(attrs,k))attrs[k]=decodeHTML(v)}
  const style=(attrs.style||'').replace(/\/\*[\s\S]*?\*\//g,'')
  const inactive=Boolean(parent.inactive||Object.hasOwn(attrs,'hidden')||Object.hasOwn(attrs,'inert')||attrs['aria-hidden']?.toLowerCase()==='true'||/(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*(?:hidden|collapse)|content-visibility\s*:\s*hidden)\s*(?:!important\s*)?(?:;|$)/i.test(style)||tag==='template')
  const n={tag,attrs,attributeTokens,children:[],parent,start:m.index,openEnd:cursor,inactive};parent.children.push(n)
  if(raw.has(tag)){
   const end=new RegExp('</'+tag+'[\\t\\n\\f\\r ]*>','ig');end.lastIndex=cursor;const close=tag==='plaintext'?null:end.exec(html)
   n.raw=html.slice(cursor,close?.index??html.length);n.closeStart=close?.index??html.length;n.end=close?end.lastIndex:html.length;cursor=n.end;tokens.lastIndex=cursor
  }else if(!voids.has(tag))stack.push(n);else n.closeStart=n.end=cursor
 }
 if(cursor<html.length)stack.at(-1).children.push(html.slice(cursor))
 const nodes=descendants(root),active=readNativeDocument(html)
 return{root,nodes,active,inner:n=>{need(Number.isInteger(n.closeStart),'Unclosed native owner');return html.slice(n.openEnd,n.closeStart)},outer:n=>{need(Number.isInteger(n.end),'Unclosed native element');return html.slice(n.start,n.end)}}
 }catch(error){if(ownedErrors.has(error))throw error;throw gap('Malformed native HTML tree',{rawHTML:html},error)}
}
const noDuplicates=node=>{const names=node.attributeTokens.map(([k])=>k);need(new Set(names).size===names.length,'Duplicate native attribute',{tag:node.tag,keys:names})}
const nativeURL=(value,base=origin)=>{
 need(typeof value==='string','Missing native URL',{rawValue:value})
 let u;try{u=new URL(value,base)}catch(error){throw gap('Malformed native URL',{rawValue:value},error)}
 need(u.origin===origin&&!u.username&&!u.password&&!u.hash&&u.protocol==='https:','Foreign native URL',{rawValue:value})
 const literal=value.startsWith('/')&&!value.startsWith('//')?origin+value:value
 need(literal===u.href,'Noncanonical native URL',{rawValue:value});return u
}
const roleURL=value=>{
 const u=nativeURL(value);need(/^\/job\/[A-Za-z0-9%._~-]+\/[1-9]\d*\/$/.test(u.pathname)&&!u.search,'Unreviewed role route',{url:u.href})
 need(!/%(?:2f|5c|2e)/i.test(u.pathname),'Encoded role path');return u
}
const semanticNames=/country|workplace|worksite|location|address|employer|hiring|criteria|requirement|employment|closing|expiry|jobstatus/i
const auditSemantics=(d,scope)=>{
 need(!d.nodes.some(n=>n.tag==='base'),'Unreviewed base authority')
 for(const n of d.nodes){
  for(const[k,v]of Object.entries(n.attrs)){
   if(k.startsWith('data-')&&semanticNames.test(k)&&k!=='data-usercountrytype')throw gap('Unreviewed semantic data carrier',{tag:n.tag,key:k,value:v})
   if((k==='property'||n.tag==='meta'&&['name','http-equiv'].includes(k))&&semanticNames.test(v))throw gap('Unreviewed metadata authority',{attrs:n.attrs})
   if(k==='itemprop')need(scope&&inScope(n,scope),'Role property outside own JobPosting',{tag:n.tag,attrs:n.attrs})
  }
  if(n.attrs['data-careersite-propertyid'])need(scope&&inScope(n,scope)&&['title','description'].includes(n.attrs['data-careersite-propertyid']),'Unreviewed role property',{attrs:n.attrs})
 }
}
const observedInertCarrier='9615b37fcc5e765c0bedca236ad47cf3a1941e45cea7c96ff4ba6ae7be92fb66'
const passiveCarrierContext=n=>{
 const ancestors=[];let a=n.parent
 while(a){ancestors.unshift({tag:a.tag,attrsSHA256:sha(JSON.stringify(a.attrs)),siblingTagIndex:a.parent?a.parent.children.filter(x=>typeof x!=='string'&&x.tag===a.tag).indexOf(a):0});a=a.parent}
 return sha(JSON.stringify({tag:n.tag,attrs:n.attrs,ancestors,rawSHA256:sha(n.raw||'')}))
}
const passiveClassesByKind={"corporate":["374bf38a85519b0573df98468712f850b8a6e44f9a215dacd102d2b945d07113","ae7578fc36f6fd543f60c64485d24c259baa0dfdc8ca9ad867e525e6976ba943","61e5c3aadb16443d41d296ac62d53aac6b1703fa6e2efa5137719342e9bb1edb","bddc12cb9a2bb406e8d3c5ee62c15282ad72acbcce36d9bb103d98a95f69fc59"],"board":["e6fd9191cbfecabf96b2e1af695b6e1ba771082dc10a8cbd97b33e178ac9fe34"],"listing":["a85286a2db21c604b427de348614511949f4b1b1361212b4e3dda950d817ab6e"],"detail":["8286716f58ebde572e8b1202ed66d2678022dfd8e7abace58181c4f661f2adbe","e9347daded332f93ebd90f41016b0597481652d99296ff9d8eeefdb0eb50484b","fd7c06cddc3020df04004c3b44f18d2e35671eef97f1950e15373fb698b967a6"]}
const passiveCarrierFrame=(d,overrides=new Map(),virtualAttributes=new Map())=>{
 const carriers=d.nodes.filter(n=>n.tag==='script'||n.tag==='style'||n.tag==='link'&&(n.attrs.rel||'').split(/\s+/).includes('stylesheet')).map(n=>{
  const ancestors=[];let a=n.parent
  while(a){ancestors.unshift({tag:a.tag,attrsSHA256:sha(JSON.stringify(virtualAttributes.get(a)??a.attrs)),siblingIndex:a.parent?a.parent.children.filter(x=>typeof x!=='string').indexOf(a):0});a=a.parent}
  return{tag:n.tag,attrs:virtualAttributes.get(n)??n.attrs,inactive:Boolean(n.inactive),ancestors,outerSHA256:sha(overrides.get(n)??d.outer(n))}
 })
 return{sha256:sha(JSON.stringify(carriers)),count:carriers.length}
}
// Passive board data only: these two literal use-sites are never evaluated,
// forwarded, reused as headers/tracking data or used to construct requests.
// Every other program byte and all47 carrier contexts stay exact. Query URLs
// remain whole declarations: two observed URLs, no numeric/cache normalization.
const boardPassiveDataClass=d=>{
 const nodes=d.nodes.filter(n=>n.tag==='script'||n.tag==='style'||n.tag==='link'&&(n.attrs.rel||'').split(/\s+/).includes('stylesheet'))
 need(nodes.length===47,'Unreviewed board passive carrier count',{count:nodes.length})
 const specs=[
  {index:33,path:['body',0,'expression','arguments',0,'body','body',0,'declarations',0,'init'],quote:"'",frame:'27ada199c71881538045812657b2ab4b2c04c36a5b604898f9ecddca720e2e31',placeholder:'"<TRACKING_UUID>"'},
  {index:38,path:['body',2,'expression','arguments',0,'properties',1,'value','properties',0,'value'],quote:'"',frame:'ebe8975bb26482992c6cdc0731ea917420469f3ecc90d24ddca8b529963ac3ab',placeholder:'"<CSRF_UUID>"'}
 ]
 const overrides=new Map(),programs=new Set()
 for(const spec of specs){
  const n=nodes[spec.index]
  need(n.tag==='script'&&!n.attrs.src&&!n.inactive,'Unreviewed board data carrier',{index:spec.index})
  noDuplicates(n)
  let ast;try{ast=parseJavaScript(n.raw,{ecmaVersion:'latest',sourceType:'script'})}catch(cause){throw gap('Malformed passive board data program',{index:spec.index},cause)}
  const literal=spec.path.reduce((x,key)=>x?.[key],ast)
  need(literal?.type==='Literal'&&typeof literal.value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(literal.value),'Unreviewed passive board data format',{index:spec.index})
  need(n.raw.slice(literal.start,literal.end)===spec.quote+literal.value+spec.quote,'Unreviewed passive board data encoding',{index:spec.index})
  const prefix=n.raw.slice(0,literal.start),suffix=n.raw.slice(literal.end)
  need(sha(prefix+'"<UUID>"'+suffix)===spec.frame,'Unreviewed whole passive board program',{index:spec.index})
  const outer=d.outer(n),normalized=prefix+spec.placeholder+suffix
  overrides.set(n,outer.slice(0,n.openEnd-n.start)+normalized+outer.slice(n.closeStart-n.start))
  programs.add(n)
 }
 const frame=passiveCarrierFrame(d,overrides)
 // Synthetic combination of the reviewed47-carrier board layout and the
 // already allowed override URI i=565448483. The retained genuine fixture
 // declares i=1008964815; no live closing observation is claimed here.
 need(['bc802332e4fafa7379dc5a603c1263a99e5133eee0fcdc607d58cf65b64f887d','5ec1947df9e932620f571fa797cd276b8abf250ab3b07d56c77e9fd51949fb31','710f3a302145393cc0c53fce604222947b3eb4d224504a5e4638c3692789344e','1128cd20a9b434ffe95317b97bccf237d079ac60580d9b5d1b3a197d05a9ce0a'].includes(frame.sha256),'Unreviewed complete board data carrier layout',frame)
 return{frame,programs}
}
// Finite, unexecuted literal use-sites. Complete program and carrier context
// frames remain pinned; these values never construct requests or job fields.
const typedPassivePlans={"listing":{"count":50,"sites":[{"index":35,"path":["body",0,"expression","arguments",0,"body","body",0,"declarations",0,"init"],"type":"uuid","marker":"\"<TRACKING_UUID>\""},{"index":40,"path":["body",2,"expression","arguments",0,"properties",1,"value","properties",0,"value"],"type":"uuid","marker":"\"<CSRF_UUID>\""}],"programFrames":{"35":"a8ef3a948359dcf7ed1f8b9b00b2fb12bcedcbeafc31e108307476b058fb5a9d","40":"f1876e33ed18058753ddca97d1cd904e276c895832519c8b03dd387f18767ee2"},"frames":["c8e496327c46dc86d993be0fb9e25bd69fdb444f5cf9e928fe0ba898b9b81c8f","638471e37f63755032ece987db232d2c6c4293ec9d065fea925c97ce01023ade","e5b6338d4b581efcb87913f6b9948bedff03ee4c9e3e22ee8043e81258359652","0e75436f6af0843b4b38a86fa311817029d887eafdc79a59e02a0d9b62a75a02","71dc108ee9e24ac240a6017fa356299b1b2afb6306db5d81a8001c7c6d4f6ee9","242d02f44a74c4d55544ba87c144d11de6be1c6738aae9ee3e5022e9d72cfe5e","0828175e7432a3f98339c92f8a7137206f54318cc275f71afdbb5dccb8739fad"]},"detail":{"count":62,"sites":[{"index":42,"path":["body",2,"expression","arguments",0,"properties",1,"value","properties",0,"value"],"type":"uuid","marker":"\"<CSRF_UUID>\""},{"index":44,"path":["body",0,"expression","arguments",0,"properties",0,"value"],"type":"public-number","marker":"0"},{"index":44,"path":["body",0,"expression","arguments",0,"properties",6,"value","properties",3,"value"],"type":"opaque-internal","marker":"\"<OPAQUE_INTERNAL_ID>\""},{"index":46,"path":["body",0,"expression","arguments",0,"body","body",0,"declarations",0,"init"],"type":"uuid","marker":"\"<TRACKING_UUID>\""},{"index":58,"path":["body",0,"expression","arguments",0,"properties",2,"value"],"type":"public-string","marker":"\"<PUBLIC_JOB_ID>\""}],"programFrames":{"42":"30ac2286f09912c0dcb0c4912b4bb2035d8886d597aebfb02336d67a5b18f419","44":"26118a36d253ba31c3727768cb89d592540749376ad95a733559292281110072","46":"a8ef3a948359dcf7ed1f8b9b00b2fb12bcedcbeafc31e108307476b058fb5a9d","58":"e63f963797999d4d87a17bcce8e1dc44512f99305a861d8924a7cc000eda745b"},"frames":["2ae5f64bbfeb835f42213fbd4098a35e0f7410669e7b2e5a1faa2fa418c68fdb","bfe69386d1bd5b85a6c7aa1caaa6153791243427e79ebb6ddd982a9c6079ef9b","5c7c4a840cefdedc7c4cecb78c1edb2eda7454ade1b1b3efd710bb184f62eb08","b07f87af8232c38d04c7cd315430558928762c7b9f3e440303661b6df5f66f2a","96b478baca4d1b2d04347d91aab11cd4320dba444b88471a0c914950e1acbb8e","51032299027688a84689cbdc8329a9b444f710a40d09b6e017b1f8dbe4bb26e0","7eef9e209ed5a2781757dcc9fc4f7d11ca8314773569f2a230b10685adecb4a3","64b322907e40619bd9e0154f44fb48507fc8902fb149d5388d6a3494fd4bca25"]}}
// Corporate form/tracking nonce literals are retained unexecuted context only.
// Exact AST paths, quotes, complete program bytes and all43 carrier contexts
// stay bound. Values never construct native requests, credentials or job fields.
typedPassivePlans.corporate={"count":43,"sites":[{"index":25,"path":["body","2","expression","right","properties","0","value"],"type":"corporate-form-data","quote":"'","marker":"\"<PASSIVE_FORM_DATA>\""},{"index":25,"path":["body","2","expression","right","properties","1","value"],"type":"corporate-form-data","quote":"'","marker":"\"<PASSIVE_FORM_DATA>\""},{"index":28,"path":["body","0","declarations","0","init","properties","5","value"],"type":"corporate-form-data","quote":"\"","marker":"\"<PASSIVE_FORM_DATA>\""},{"index":29,"path":["body","0","declarations","0","init","properties","5","value"],"type":"corporate-form-data","quote":"\"","marker":"\"<PASSIVE_FORM_DATA>\""},{"index":31,"path":["body","0","declarations","0","init","properties","9","value","properties","0","value"],"type":"corporate-form-data","quote":"\"","marker":"\"<PASSIVE_FORM_DATA>\""},{"index":31,"path":["body","0","declarations","0","init","properties","9","value","properties","1","value"],"type":"corporate-form-data","quote":"\"","marker":"\"<PASSIVE_FORM_DATA>\""},{"index":37,"path":["body","0","declarations","0","init","properties","1","value"],"type":"corporate-form-data","quote":"\"","marker":"\"<PASSIVE_FORM_DATA>\""}],"programFrames":{"25":"88acda07d82bad5988a9a70ac0fbdeb2184d9436e7e090107dd9dc85809abad0","28":"586e47aa9e2070ce2a697bf1d6d4e3cdcb9d2cd71d44420f3d1b841a491c1ddf","29":"586e47aa9e2070ce2a697bf1d6d4e3cdcb9d2cd71d44420f3d1b841a491c1ddf","31":"2a775f62f8a6d3c2b72d1009b4886ea627a5ed665a0662e03e0dea6c9abd5f77","37":"440937ebf26307db484283bc965d22f38a8edbb361a9bf2d845425ecfe744ec9"},"frames":["bee9124f1b3c8e07682adb43be917d66f965ab5a8253dbf67ee42b5ca46a80fd"]}
// This is complianz.page_links.us['privacy-statement-children'].url, a cached
// cookie-consent fallback with an empty sibling title. Actual privacy-policy
// links remain fixed by the whole program hash. This one passive value never
// supplies requests or job authority. Its bounded same-origin WP slug type is
// checked at the exact AST site; every other byte/all43 contexts remain bound.
typedPassivePlans.corporate.sites.push({index:33,path:['body',0,'declarations',0,'init','properties',26,'value','properties',1,'value','properties',2,'value','properties',1,'value'],type:'corporate-privacy-url',marker:'"https://www.providence.in/"'})
typedPassivePlans.corporate.programFrames[33]='da906c4a4e472448d5959ae4aa060640cd35ae8ab81c0da3369cbcf47624d961'
// Genuine Nov10 uses the already reviewed ace48 stylesheet declaration with
// the present privacy program. Replacing that single declaration by reviewed
// 3fab bytes exactly recovers bee912's complete43-carrier context. Admit this
// finite vector only; every typed program/authority/other carrier stays bound.
typedPassivePlans.corporate.frames.push('4b087b71413ea3d931e353187193c23683811d5426a44281b6df6ffdf7e8abde')
const typedPassiveDataClass=(d,kind,publicId,listingContext=null)=>{
 let plan=typedPassivePlans[kind]
 need(plan,'Unreviewed passive data kind',{kind})
 const nodes=d.nodes.filter(n=>n.tag==='script'||n.tag==='style'||n.tag==='link'&&(n.attrs.rel||'').split(/\s+/).includes('stylesheet'))
 need(nodes.length===plan.count,'Unreviewed typed passive carrier count',{kind,count:nodes.length})
 // This absent-property variant is selected only by the already reviewed
 // whole1354-byte inline program at exact corporate slot33. It is a new
 // complete43 carrier class; no privacy property is grafted or generally optional.
 if(kind==='corporate'&&sha(nodes[33]?.raw??'')==='0466e7e7fea34a0310b694779ae170429d464b6dce466b32304b858d3bb64cae'){
  const n=nodes[33]
  need(n.tag==='script'&&!n.attrs.src&&!n.inactive&&Buffer.byteLength(n.raw)===1354,'Unreviewed absent corporate privacy carrier',{kind,index:33})
  noDuplicates(n)
  const sites=plan.sites.filter(spec=>!(spec.index===33&&spec.type==='corporate-privacy-url'))
  need(sites.length===7&&sites.length===plan.sites.length-1,'Unreviewed absent corporate privacy plan',{kind})
  plan={...plan,sites,frames:['5347beaae87c202c152bf672329167ec31aec6b527f99ad51952e18456cd8d4e']}
 }
 const groups=new Map(),programs=new Set(),overrides=new Map();let opaqueInternalId
 for(const spec of plan.sites){
  const n=nodes[spec.index];need(n.tag==='script'&&!n.attrs.src&&!n.inactive,'Unreviewed typed data carrier',{kind,index:spec.index});noDuplicates(n)
  let group=groups.get(spec.index)
  if(!group){let ast;try{ast=parseJavaScript(n.raw,{ecmaVersion:'latest',sourceType:'script'})}catch(cause){throw gap('Malformed typed passive program',{kind,index:spec.index},cause)}group={n,ast,spans:[]};groups.set(spec.index,group)}
  const literal=spec.path.reduce((x,key)=>x?.[key],group.ast)
  need(literal?.type==='Literal','Unreviewed typed passive literal',{kind,index:spec.index})
  const value=literal.value,raw=n.raw.slice(literal.start,literal.end)
  if(spec.type==='uuid'){
   const quote=spec.marker==='"<TRACKING_UUID>"'?"'":'"'
   need(typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value)&&raw===quote+value+quote,'Unreviewed typed passive UUID',{kind,index:spec.index})
  }else if(spec.type==='corporate-form-data'){
   need(kind==='corporate'&&typeof value==='string'&&/^[0-9a-f]{10}$/.test(value)&&raw===spec.quote+value+spec.quote,'Unreviewed corporate passive form data',{kind,index:spec.index})
  }else if(spec.type==='corporate-privacy-url'){
   need(kind==='corporate'&&typeof value==='string'&&value.length<=256&&/^https:\/\/www\.providence\.in\/(?:[a-z0-9]+(?:-[a-z0-9]+)*\/)?$/.test(value)&&raw==='"'+value+'"','Unreviewed corporate passive privacy URL',{kind,index:spec.index})
  }else if(spec.type==='public-number')need(Number.isSafeInteger(value)&&value>0&&String(value)===publicId&&raw===String(value),'Typed passive public number mismatch',{index:spec.index})
  else if(spec.type==='public-string')need(typeof value==='string'&&value===publicId&&raw==="'"+value+"'",'Typed passive public string mismatch',{index:spec.index})
  else{need(spec.type==='opaque-internal'&&typeof value==='string'&&/^[0-9]{4}-en_US$/.test(value)&&raw===JSON.stringify(value),'Unreviewed opaque internal data',{index:spec.index});opaqueInternalId=value}
  group.spans.push({start:literal.start,end:literal.end,marker:spec.marker})
 }
 for(const[index,{n,spans}]of groups){
  let normalized=n.raw
  for(const span of spans.sort((a,b)=>b.start-a.start))normalized=normalized.slice(0,span.start)+span.marker+normalized.slice(span.end)
  need(sha(normalized)===plan.programFrames[index],'Unreviewed whole typed passive program',{kind,index})
  const outer=d.outer(n);overrides.set(n,outer.slice(0,n.openEnd-n.start)+normalized+outer.slice(n.closeStart-n.start));programs.add(n)
 }
 // Listing accessibility is validated against independently parsed page facts,
 // before BOTH old known-frame and alias admission. Raw legacy profiles below
 // retain their existing bypass; they are not retroactively revalidated here.
 const virtualListingAttributes=new Map()
 if(kind==='listing'){
  const page=listingContext?.page,known=listingContext?.known
  need(page&&Array.isArray(page.rows)&&Array.isArray(page.pages),'Missing independent listing context')
  const offset=listingRequestOffset(page.url)
  need(page.start===offset+1&&page.rows.length===page.end-page.start+1,'Listing context/request mismatch')
  const declaredOffsets=page.pages.map(p=>{const value=listingRequestOffset(p.url);need(value===p.offset,'Listing context declaration mismatch');return value})
  need(known instanceof Map&&typeof listingContext.zeroWitnessed==='boolean','Missing native workflow declaration context')
  const knownOffsets=[...known].map(([value,url])=>{need(listingRequestOffset(url)===value,'Workflow declaration URL/offset mismatch');return value})
  need(offset===0||listingContext.zeroWitnessed,'Missing witnessed first-page request')
  const offsets=[...new Set([offset,...declaredOffsets,...knownOffsets])].sort((a,b)=>a-b)
  need(offsets[0]===0,'Missing explicit or current first-page declaration')
  const ordinal=offsets.indexOf(offset)+1
  const table=one(d.nodes.filter(n=>n.tag==='table'&&n.attrs.id==='searchresults'),'listing accessibility owner')
  need(nodes[23]?.tag==='script'&&inScope(nodes[23],table)&&!table.inactive,'Unreviewed listing accessibility context')
  noDuplicates(table)
  need(table.attributeTokens.length===5&&Object.keys(table.attrs).join('|')==='id|class|cellpadding|cellspacing|aria-label','Unreviewed listing accessibility attributes')
  const label=table.attrs['aria-label'],match=typeof label==='string'&&label.match(/^Search results for \. Page ([1-9]\d*) of ([1-9]\d*), Results ([1-9]\d*) to ([1-9]\d*) of ([1-9]\d*)$/)
  need(match,'Unreviewed listing accessibility label')
  const values=match.slice(1).map(Number),expected=[ordinal,offsets.length,page.start,page.end,page.total]
  need(values.every(Number.isSafeInteger)&&values.every((value,i)=>value===expected[i]),'Listing accessibility/native pagination disagreement',{expected,observed:values})
  const opening=d.outer(table).slice(0,table.openEnd-table.start)
  need(opening==='<table id="searchresults" class="searchResults full table table-striped table-hover" cellpadding="0" cellspacing="0" aria-label="'+label+'">','Unreviewed listing accessibility raw opening')
  virtualListingAttributes.set(table,{...table.attrs,'aria-label':'Search results for . Page 1 of 6, Results 1 to 15 of 80'})
 }
 const frame=passiveCarrierFrame(d,overrides),knownFrame=plan.frames.includes(frame.sha256)
 let listingAlias=false
 if(kind==='listing'&&!knownFrame){
  const n=nodes[47],oldURI='/js/override.js?locale=en_US&i=585000988',newURI='/js/override.js?locale=en_US&i=745724182',currentURI='/js/override.js?locale=en_US&i=565448483',fourthURI='/js/override.js?locale=en_US&i=1008964815'
  // Only this empty, lexical whole tag may use the four observed declarations.
  // Compare virtual records; never rewrite the DOM/Response or fetch this URL.
  if(n?.tag==='script'&&!n.inactive&&n.raw===''&&n.attrs.type==='text/javascript'&&Object.keys(n.attrs).length===2&&n.attributeTokens.length===2&&(n.attrs.src===oldURI||n.attrs.src===newURI||n.attrs.src===currentURI||n.attrs.src===fourthURI)){
   const rawURI=n.attrs.src.replace('&','&amp;'),outer=d.outer(n)
   if(outer==='<script type="text/javascript" src="'+rawURI+'"></script>'){
    const virtualOuter=new Map(overrides),virtualAttributes=new Map(virtualListingAttributes)
    virtualAttributes.set(n,{...n.attrs,src:oldURI})
    virtualOuter.set(n,'<script type="text/javascript" src="/js/override.js?locale=en_US&amp;i=585000988"></script>')
    const comparison=passiveCarrierFrame(d,virtualOuter,virtualAttributes)
    listingAlias=comparison.count===50&&comparison.sha256==='3bf6f8a5d8d87afa55fb5a7f9223d8310db289d60cd0b92fb854e166600b8e39'
   }
  }
 }
 need(knownFrame||listingAlias,'Unreviewed complete typed passive layout',{kind,...frame})
 return{frame,programs,...(kind==='detail'?{evidence:{opaqueInternalId}}:{})}
}
const passiveSurface=(d,reviewedOwner=null,kind='detail',publicId=null,listingContext=null)=>{
 let frame=passiveCarrierFrame(d),boardData=null,typedData=null
 if(kind==='board'&&!passiveClassesByKind.board.includes(frame.sha256)){boardData=boardPassiveDataClass(d);frame=boardData.frame}
 if(['corporate','listing','detail'].includes(kind)&&!passiveClassesByKind[kind].includes(frame.sha256)){typedData=typedPassiveDataClass(d,kind,publicId,listingContext);frame=typedData.frame}
 need(boardData||typedData||passiveClassesByKind[kind]?.includes(frame.sha256),'Unreviewed complete passive carrier layout',{kind,...frame})
 for(const n of d.nodes){
  if(n.tag==='script'){
   noDuplicates(n)
   need(!n.inactive||reviewedOwner&&inScope(n,reviewedOwner)&&passiveCarrierContext(n)===observedInertCarrier,'Unreviewed inert program carrier')
   need(n.attrs.src?bound.scriptSrc.has(n.attrs.src):bound.inlinePrograms.has(sha(n.raw||''))||boardData?.programs.has(n)||typedData?.programs.has(n),'Unreviewed native program',{src:n.attrs.src||null,sha256:sha(n.raw||'')})
  }
  if(n.tag==='style')need(bound.inlineStyles.has(sha(n.raw||'')),'Unreviewed native stylesheet',{sha256:sha(n.raw||'')})
  if(n.tag==='link'&&n.attrs.rel==='stylesheet')need(bound.stylesheetHref.has(n.attrs.href),'Unreviewed stylesheet declaration',{href:n.attrs.href})
 }
 return typedData?.evidence
}
const tenant=d=>{
 const values=[]
 for(const n of d.nodes.filter(n=>n.tag==='script'&&!n.attrs.src&&!n.inactive&&/ssoCompanyId/.test(n.raw||''))){
  const ast=parseJavaScript(n.raw,{ecmaVersion:'latest',sourceType:'script'})
  const visit=x=>{if(!x||typeof x!=='object')return;if(x.type==='Property'&&((x.key?.type==='Literal'&&x.key.value==='ssoCompanyId')||(x.key?.type==='Identifier'&&x.key.name==='ssoCompanyId'))){need(!x.computed&&x.kind==='init'&&!x.method&&x.value?.type==='Literal'&&typeof x.value.value==='string','Unreviewed native tenant declaration');values.push(x.value.value)}for(const[k,v]of Object.entries(x)){if(k==='start'||k==='end')continue;if(Array.isArray(v))v.forEach(visit);else if(v&&typeof v==='object')visit(v)}}
  visit(ast)
 }
 need(values.length===1&&values[0]==='providence','Native tenant mismatch',{values})
}
const canonical=(d,expected)=>{
 const n=one(d.nodes.filter(n=>n.tag==='link'&&(n.attrs.rel||'').split(/\s+/).includes('canonical')),'canonical');noDuplicates(n)
 need(!n.inactive&&n.attrs.href===expected,'Canonical mismatch',{expected,actual:n.attrs.href})
}
export const parseProvidenceNativeDate=value=>{
 if(value===null||value===undefined)return null
 need(typeof value==='string','Nonstring native date',{rawValue:value})
 const m=value.match(/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{2}) (\d{2}):(\d{2}):(\d{2}) UTC (\d{4})$/)
 need(m,'Unreviewed native date format',{rawValue:value})
 const month=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].indexOf(m[2]),year=Number(m[7]),day=Number(m[3]),hour=Number(m[4]),minute=Number(m[5]),second=Number(m[6]),date=new Date(0)
 date.setUTCFullYear(year,month,day);date.setUTCHours(hour,minute,second,0)
 need(day>=1&&hour<24&&minute<60&&second<60&&date.getUTCFullYear()===year&&date.getUTCMonth()===month&&date.getUTCDate()===day&&['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][date.getUTCDay()]===m[1],'Invalid native calendar',{rawValue:value})
 return date.toISOString()
}
const properties=['jobLocation','address','addressLocality','addressRegion','addressCountry','datePosted','validThrough','hiringOrganization','title','description']
const descriptionTags=new Set(['span','div','p','h1','h2','h3','h4','strong','b','ul','li','hr','br','em','u','a','table','thead','tbody','tr','td'])
const decorativeStyles=new Set(['color:#1d2d3e','color:black','font-family:Arial, Helvetica, sans-serif','font-size:12.0px'])

// Authored formatting data only. No CSS evaluation, navigation, sanitization,
// declaration map, inferred requirements, or visibility/qualification claim.
const criteriaEditorialDigests={"div:align":["f179a509d32bd92c923f236324daef85551c03a761bf0188be286a585281b4ac"],"div:dir":["9422b24d2f1f1fc85c11d8c79624a50a75fc77c4dedb8d12ad59d597ac545431"],"div:id":["1587f5746901892fc561651d645d2aceaab3133e2a09a3f505ee70ac67624347","93227f5549042972ce5ed9b4e86960cb9f23ebb2e69e06cffa5cb8acd7eee44e","d016e2c673d20956c2ce4c8b660cbc173ec55ad5adbbd9833758be16734c7cf8"],"hr:align":["f179a509d32bd92c923f236324daef85551c03a761bf0188be286a585281b4ac"],"hr:size":["d4735e3a265e16eee03f59718b9b5d03019c07d8b6c51f90da3a666eec13ab35"],"hr:width":["32e48995f98ce3b76f2d3f5e2d2acddfeff6650b7b18628cfa739bfef4a03312"],"table:border":["5feceb66ffc86f38d952786c6d696c79c2dbc239dd4e91b46729d73a27fb57e9"],"table:cellpadding":["5feceb66ffc86f38d952786c6d696c79c2dbc239dd4e91b46729d73a27fb57e9"],"table:class":["1fd5508b99a687b99c40db8a7bf63bf36d568a2a3819fc25848f51037d7e63b2"],"ul:type":["6bf99799d0ef91be6c25a22943f74caaf655814b216ee8cb52ef61223d4f2d06","8a39178d327e72a92d3b9800e55c5e95930f7ef61605464fe8cb43899abd1367"]}
const criteriaReferenceDigests=new Set(["1813788b427e12bd2b5d3325928e8e46229edc8a6531511b4bbd201e38dab9e4","a9e649c1a2916f2276401ad3b3742bba07945dc643d9e5f73752a3596cecf497","c43304aed6e03471cb92119eae3b8e99a40bf58c4ba38fea92a0e27d13a680f0","d9934c000eba94ae2beffb78190da7e94da89c00232cb12994ad0ebcabb0afdc","e98136867f7b4447f878893413fce208c5fff420ac6161f94f929407fc11e2bc"])
const formattingNumber='(?:[0-9]+(?:\\.[0-9]+)?|\\.[0-9]+)'
const formattingDimension=new RegExp('^(-?'+formattingNumber+')(pt|px|in|cm|%)?$','i')
const formattingCaps={margin:{pt:64.9,px:24,in:0.5,cm:0},padding:{pt:1,in:0,cm:0},'margin-left':{pt:-9,px:0,in:0},'margin-right':{in:0,cm:0},'margin-top':{px:0,in:0,cm:0},'margin-bottom':{pt:8,px:10.661764,in:0,cm:0},'text-indent':{pt:18,cm:0}}
const formattingColorNames=new Set(['black','white','navy','blue','red','gray','grey','silver','maroon','teal','green','purple','yellow','aqua','fuchsia','olive','whitesmoke','lightgray','lightgrey','darkgray','darkgrey','windowtext','currentcolor'])
const formattingColor=v=>/^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(v)||formattingColorNames.has(v.toLowerCase())
const formattingDecimal=value=>{
 if(typeof value!=='string'||value.length>128)return null
 const match=value.match(/^(-?)([0-9]*)(?:\.([0-9]+))?$/)
 if(!match||!(match[2]||match[3]))return null
 const fraction=match[3]||'',digits=(match[2]||'0')+fraction
 return{numerator:BigInt(digits)*(match[1]?-1n:1n),denominator:10n**BigInt(fraction.length)}
}
const formattingCompare=(a,b)=>{const x=formattingDecimal(a),y=formattingDecimal(String(b));if(!x||!y)return null;const n=x.numerator*y.denominator-y.numerator*x.denominator;return n<0n?-1:n>0n?1:0}
const formattingLength=(value,units,min,max,zero=true)=>{
 const m=value.match(formattingDimension);if(!m)return false
 const number=m[1],unit=(m[2]||'').toLowerCase()
 return !number.startsWith('-')&&formattingDecimal(number)!==null&&formattingCompare(number,min)>=0&&formattingCompare(number,max)<=0&&(unit?units.includes(unit):zero&&formattingCompare(number,0)===0)
}
const formattingWidth=v=>['thin','medium','thick'].includes(v)||formattingLength(v,['pt'],0,2.25)
const formattingValue=(property,value)=>{
 const v=value.trim(),words=v.split(/ +/)
 // Exact witnessed Word indentation in role56770644. Keep the general px24
 // cap and all other tuples unchanged; preserve original criteria/style bytes.
 if(property==='margin'&&v==='0.0cm 0.0cm 0.0cm 32.0px')return true
 // The witnessed zero-inch indentation is passive layout, with no added unit
 // range or alternate value admitted by this exact spelling.
 if(property==='text-indent'&&v==='0.0in')return true
 if(Object.hasOwn(formattingCaps,property)){
  if(words.length<1||words.length>(['margin','padding'].includes(property)?4:1))return false
  return words.every(token=>{const m=token.match(formattingDimension);if(!m||!formattingDecimal(m[1]))return false;const number=m[1],unit=(m[2]||'').toLowerCase();if(!unit)return !number.startsWith('-')&&formattingCompare(number,0)===0;const caps=formattingCaps[property];if(!Object.hasOwn(caps,unit))return false;return caps[unit]<0?formattingCompare(number,caps[unit])===0:!number.startsWith('-')&&formattingCompare(number,0)>=0&&formattingCompare(number,caps[unit])<=0})
 }
 if(['border','border-bottom','border-top'].includes(property)){
  if(words.length<1||words.length>3)return false;const categories=new Set()
  for(const w of words){const category=formattingWidth(w)?'width':['solid','double','none'].includes(w)?'style':formattingColor(w)?'color':null;if(!category||categories.has(category))return false;categories.add(category)}return true
 }
 if(['border-width','border-style','border-color'].includes(property))return words.length>=1&&words.length<=4&&words.every(w=>property==='border-width'?formattingWidth(w):property==='border-style'?['solid','double','none'].includes(w):formattingColor(w))
 if(property==='font-size')return formattingLength(v,['pt','px'],7,20,false)
 if(property==='font-family'){const families=v.split(',');return families.length>=1&&families.length<=5&&families.every(f=>/^(?:[A-Za-z][A-Za-z0-9 -]{0,63}|"[A-Za-z][A-Za-z0-9 -]{0,63}"|'[A-Za-z][A-Za-z0-9 -]{0,63}')$/.test(f.trim()))}
 if(['color','background-color'].includes(property))return formattingColor(v)
 if(property==='font-weight'){if(['normal','bold'].includes(v))return true;const decimal=formattingDecimal(v);return new RegExp('^'+formattingNumber+'$').test(v)&&decimal!==null&&formattingCompare(v,100)>=0&&formattingCompare(v,900)<=0&&decimal.numerator%(100n*decimal.denominator)===0n}
 if(property==='text-align')return ['left','right','center','justify','start'].includes(v)
 if(property==='line-height')return v==='normal'||formattingLength(v,['%'],100,150,false)||formattingLength(v,['pt'],14,15,false)||formattingLength(v,['px'],14,17.12,false)
 if(property==='list-style-type')return ['disc','circle','square','decimal'].includes(v)
 if(property==='font-style')return ['normal','italic'].includes(v)
 if(property==='text-decoration')return ['none','underline'].includes(v)
 if(property==='vertical-align')return ['top','middle','bottom','baseline'].includes(v)
 return false
}
const parseFormattingDeclarations=raw=>{
 need(typeof raw==='string'&&raw.length>0&&raw.length<=8192,'Unreviewed formatting declaration size')
 // Only ASCII space is formatting whitespace in the witnessed declaration
 // grammar. No controls/comments/escapes/functions or important tails.
 need(!/[^\x20-\x7e]|[\\!(){}@]|\/\*|\*\//.test(raw),'Unreviewed formatting syntax')
 const declarations=[];let start=0,quote=null
 const consume=end=>{
  const original=raw.slice(start,end),trimmed=original.trim()
  if(!trimmed){declarations.push({start,end,raw:original,empty:true});return}
  const match=original.match(/^( *)([A-Za-z]+(?:-[A-Za-z]+)*)( *):( *)(.*?)( *)$/)
  need(match&&match[5].length>0&&formattingValue(match[2].toLowerCase(),match[5]),'Unreviewed formatting property/value',{property:match?.[2]||null})
  declarations.push({start,end,raw:original,rawProperty:match[2],property:match[2].toLowerCase(),rawValue:match[5]})
 }
 for(let i=0;i<raw.length;i++){
  const c=raw[i]
  if(quote){if(c===quote)quote=null}
  else if(c==='"'||c==="'")quote=c
  else if(c===';'){consume(i);start=i+1}
 }
 need(quote===null,'Unclosed formatting quote');consume(raw.length)
 need(declarations.length<=128&&declarations.some(d=>!d.empty),'Unreviewed formatting declaration count')
 // Validate full source consumption including all empty declarations, spacing,
 // repeated properties and separators. The source style itself stays raw.
 need(declarations.map(d=>d.raw).join(';')===raw,'Incomplete formatting consumption')
 return declarations
}
const criteriaReference=value=>{
 need(typeof value==='string'&&!/[\x00-\x20\x7f]/.test(value)&&!/%(?![0-9a-f]{2})/i.test(value),'Malformed criteria reference')
 let u;try{u=new URL(value)}catch(cause){throw gap('Malformed criteria reference',{},cause)}
 need(['http:','https:'].includes(u.protocol)&&u.href===value&&!u.username&&!u.password&&!u.port&&!u.hash&&!u.search&&['secure.ethicspoint.com','urldefense.com','www.servicenow.com','www.version1.com','www.thecloudpeople.com'].includes(u.hostname)&&!/(?:^|\/)(?:auth|oauth|login|signin|apply|application)(?:\/|$)/i.test(u.pathname)&&criteriaReferenceDigests.has(sha(value)),'Unreviewed authored reference')
}
const criteriaFormattingAttribute=(tag,key,value)=>{
 if(key==='style'){parseFormattingDeclarations(value);return true}
 if(key==='class'&&value==='jobdescription')return true
 if(tag==='a'&&key==='href'){criteriaReference(value);return true}
 const digests=criteriaEditorialDigests[tag+':'+key]
 if(!digests?.includes(sha(value)))return false
 if(key==='id'||key==='class')return true
 if(key==='type')return tag==='ul'&&['disc','circle','square'].includes(value)
 if(key==='align')return ['div','hr'].includes(tag)&&['left','right','center','justify'].includes(value)
 if(key==='dir')return tag==='div'&&['ltr','rtl'].includes(value)
 if(key==='size'||key==='border'||key==='cellpadding')return /^\d{1,3}$/.test(value)&&Number(value)<=100
 if(key==='width')return /^(?:\d{1,4}|\d{1,3}%)$/.test(value)&&Number(value.replace('%',''))<=(value.endsWith('%')?100:1200)
 return false
}

const descriptionText=(raw,evidence)=>{
 need(!raw.includes('<!--'),'Unreviewed authored criteria comment',evidence)
 need(!/<!|<\?/.test(raw),'Unreviewed authored criteria declaration',evidence)
 const d=readNativeDocument(raw),root=one(d.nodes(n=>n.tag==='root'),'criteria root')
 const walk=n=>{
  need(!n.inert&&!n.nativeTagUnqualified&&(n.tag==='root'||descriptionTags.has(n.tag)),'Hidden, inert or unknown criteria carrier',evidence)
  if(n.tag==='a')need(typeof n.attrs.href==='string','Missing authored reference href',evidence)
  for(const[k,v]of Object.entries(n.attrs))need(criteriaFormattingAttribute(n.tag,k,v),'Unreviewed criteria attribute',{...evidence,tag:n.tag,key:k,value:v})
  for(const c of n.children)if(typeof c!=='string')walk(c)
 }
 walk(root)
 const t=tree(raw);for(const n of t.nodes)if(n.tag!=='root')noDuplicates(n)
 const result=text(t.root);need(result.length>=100&&/[\p{L}\p{N}]/u.test(result),'Incomplete native criteria',evidence);return result
}
export const parseProvidenceRoleHTML=(html,row,{now=new Date().toISOString()}={})=>{
 const rawEvidence={url:row.sourceUrl,rawHTML:html}
 try{
  const d=tree(html),url=roleURL(row.sourceUrl),publicId=url.pathname.split('/').filter(Boolean).at(-1)
  canonical(d,url.href)
  const scope=one(d.nodes.filter(n=>n.attrs.itemtype&&/(?:^|\/)JobPosting\/?$/.test(n.attrs.itemtype)),'raw JobPosting')
  noDuplicates(scope)
  need(!scope.inactive&&scope.tag==='div'&&scope.attrs.itemtype==='http://schema.org/JobPosting'&&scope.attrs.class==='jobDisplayShell'&&Object.hasOwn(scope.attrs,'itemscope')&&Object.keys(scope.attrs).every(k=>['class','itemscope','itemtype'].includes(k)),'Unreviewed JobPosting owner',rawEvidence)
  need(d.active.nodes(n=>n.attrs.itemtype==='http://schema.org/JobPosting').length===1,'Inactive or ambiguous JobPosting',rawEvidence)
  auditSemantics(d,scope)
  const props=d.nodes.filter(n=>n.attrs.itemprop)
  need(props.every(n=>properties.includes(n.attrs.itemprop)),'Unknown own microdata field',rawEvidence)
  const prop=(name,optional=false)=>{const ns=props.filter(n=>n.attrs.itemprop===name);need(ns.length===(optional&&ns.length===0?0:1),'Ambiguous or missing '+name,rawEvidence);const n=ns[0];if(!n)return null;noDuplicates(n);need(!n.inactive,'Inactive '+name,rawEvidence);return n}
  const place=prop('jobLocation'),address=prop('address')
  need(place.attrs.itemtype==='http://schema.org/Place'&&address.attrs.itemtype==='http://schema.org/PostalAddress'&&Object.hasOwn(place.attrs,'itemscope')&&Object.hasOwn(address.attrs,'itemscope')&&inScope(address,place)&&inScope(place,scope),'Unreviewed address hierarchy',rawEvidence)
  const typed=d.nodes.filter(n=>n.attrs.itemtype||Object.hasOwn(n.attrs,'itemscope'))
  need(typed.length===3&&typed.every(n=>[scope,place,address].includes(n)),'Orphan or unreviewed schema scope',rawEvidence)
  for(const n of [place,address])need(Object.keys(n.attrs).every(k=>['itemprop','itemscope','itemtype'].includes(k)),'Unknown typed address carrier',rawEvidence)
  const readMeta=(name,optional=false)=>{const n=prop(name,optional);if(!n)return null;need(n.tag==='meta'&&typeof n.attrs.content==='string'&&Object.keys(n.attrs).length===2&&Object.keys(n.attrs).every(k=>['itemprop','content'].includes(k)),'Unreviewed '+name,rawEvidence);return n.attrs.content}
  const locality=readMeta('addressLocality'),region=readMeta('addressRegion'),country=readMeta('addressCountry')
  for(const name of ['addressLocality','addressRegion','addressCountry'])need(inScope(prop(name),address),'Address property outside own address',rawEvidence)
  need(locality&&region&&country,'Missing native address carrier',rawEvidence)
  const employer=readMeta('hiringOrganization');need(employer==='Providence','Native employer mismatch',{...rawEvidence,employer})
  const titleNode=prop('title'),desc=prop('description'),title=text(titleNode)
  for(const n of [titleNode,desc])need(n.tag==='span'&&Object.keys(n.attrs).every(k=>['xml:lang','lang','itemprop','data-careersite-propertyid','class'].includes(k))&&n.attrs.lang==='en-US'&&n.attrs['xml:lang']==='en-US'&&n.attrs.class==='rtltextaligneligible','Unreviewed title/criteria owner attributes',rawEvidence)
  need(titleNode.attrs['data-careersite-propertyid']==='title'&&desc.attrs['data-careersite-propertyid']==='description'&&title&&title===row.title,'Native title/listing mismatch',{...rawEvidence,nativeTitle:title,listingTitle:row.title})
  // Heading ownership allows genuine h1 sections INSIDE the complete criteria.
  const titleHeading=d.nodes.filter(n=>n.tag==='h1'&&inScope(titleNode,n));need(titleHeading.length===1&&!titleHeading[0].inactive,'Native title heading binding',rawEvidence)
  const descriptionHTML=d.inner(desc),description=descriptionText(descriptionHTML,rawEvidence)
  const postedRaw=readMeta('datePosted'),closingRaw=readMeta('validThrough',true),postingDate=parseProvidenceNativeDate(postedRaw),closingDate=parseProvidenceNativeDate(closingRaw)
  const applications=d.nodes.filter(n=>n.tag==='a'&&n.attrs.href&&/\/talentcommunity\/apply\//.test(n.attrs.href))
  need(applications.length>0,'Missing native application identity',rawEvidence)
  const applyURLs=applications.map(n=>{noDuplicates(n);need(!n.inactive,'Inactive application identity',rawEvidence);const u=nativeURL(n.attrs.href);need(u.pathname==='/talentcommunity/apply/'+publicId+'/'&&[...u.searchParams.keys()].every(k=>k==='locale')&&u.searchParams.getAll('locale').length===1&&u.searchParams.get('locale')==='en_US','Native apply/public-ID mismatch',{...rawEvidence,apply:u.href});return u.href})
  const native={publicId,title,employer,legalEmployer:null,sourceUrl:url.href,applyUrl:one([...new Set(applyURLs)],'unique application route'),address:{addressLocality:locality,addressRegion:region,addressCountry:country},datePosted:postedRaw,validThrough:closingRaw,postingDate,closingDate,descriptionHTML,descriptionText:description,rawJobPostingHTML:d.outer(scope),listing:row}
  const reasons=[]
  if(country!=='IN')reasons.push(country==='PK'?'native-explicit-foreign-country-PK':'unreviewed-or-foreign-native-country')
  const at=Date.parse(now);need(Number.isFinite(at),'Invalid collection clock')
  if(Date.parse(postingDate)>at)reasons.push('future-native-posting-date')
  if(closingDate&&Date.parse(closingDate)<=at)reasons.push('native-application-deadline-expired')
  return{model:native,held:reasons.length>0,reasons}
 }catch(error){if(ownedErrors.has(error)){error.nativeRoleEvidence=rawEvidence;throw error}throw gap('Malformed native role',rawEvidence,error)}
}
const listingRequestOffset=request=>{
 need(typeof request==='string','Nonstring listing request')
 let u;try{u=new URL(request)}catch(cause){throw gap('Malformed listing request',{},cause)}
 need(request===u.href&&u.origin===origin&&u.pathname==='/search/'&&!u.username&&!u.password&&!u.hash,'Unreviewed listing request authority')
 if(request===PROVIDENCE_INDIA_SEARCH_URL)return 0
 need(u.search&&request===PROVIDENCE_INDIA_SEARCH_URL+u.search&&!u.search.includes('%'),'Unreviewed listing request encoding')
 const pairs=u.search.slice(1).split('&').map(x=>x.split('=')),keys=pairs.map(x=>x[0])
 need(pairs.length===4&&pairs.every(x=>x.length===2)&&new Set(keys).size===4&&keys.every(x=>['q','sortColumn','sortDirection','startrow'].includes(x))&&u.searchParams.get('q')===''&&u.searchParams.get('sortColumn')==='referencedate'&&u.searchParams.get('sortDirection')==='desc'&&/^(?:0|[1-9]\d*)$/.test(u.searchParams.get('startrow')),'Unreviewed listing request query')
 const offset=Number(u.searchParams.get('startrow'));need(Number.isSafeInteger(offset),'Unsafe listing offset');return offset
}
export const parseProvidenceListingHTML=(html,url=PROVIDENCE_INDIA_SEARCH_URL)=>{
 const offset=listingRequestOffset(url),d=tree(html);canonical(d,PROVIDENCE_INDIA_SEARCH_URL);auditSemantics(d,null)
 const table=one(d.nodes.filter(n=>n.tag==='table'&&n.attrs.id==='searchresults'),'search results table');need(!table.inactive,'Inactive listing')
 const labels=d.nodes.filter(n=>classes(n,'paginationLabel')).map(text),ranges=labels.map(x=>x.match(/^Results\s+(\d+)\s*[\u2013-]\s*(\d+)\s+of\s+(\d+)$/))
 need(ranges.length>0&&ranges.every(Boolean),'Unproven native pagination range')
 const range=ranges[0].slice(1).map(Number);need(ranges.every(m=>m.slice(1).map(Number).join()===range.join()),'Conflicting pagination ranges')
 const[start,end,total]=range;need(range.every(Number.isSafeInteger)&&start>=1&&end>=start&&end<=total&&total<=10000,'Invalid native pagination range')
 need(start===offset+1,'Declared pagination offset/range mismatch',{offset,start})
 const rows=d.nodes.filter(n=>n.tag==='tr'&&classes(n,'data-row')&&inScope(n,table)).map(n=>{
  need(!n.inactive,'Inactive listing row');const links=descendants(n).filter(x=>x.tag==='a'&&classes(x,'jobTitle-link'))
  need(links.length>0,'Missing row title identity');const values=links.map(x=>{need(!x.inactive,'Inactive row title');noDuplicates(x);return{url:roleURL(x.attrs.href).href,title:text(x)}})
  need(values.every(x=>x.url===values[0].url&&x.title===values[0].title)&&values[0].title,'Conflicting responsive row identities')
  const locationNodes=descendants(n).filter(x=>x.tag==='td'&&classes(x,'colLocation'))
  return{sourceUrl:values[0].url,title:values[0].title,publicId:values[0].url.split('/').filter(Boolean).at(-1),displayLocation:locationNodes.map(text),rawRowHTML:d.outer(n)}
 })
 need(rows.length===end-start+1&&new Set(rows.map(r=>r.publicId)).size===rows.length,'Listing range/identity mismatch')
 const pages=[]
 for(const n of d.nodes.filter(n=>n.tag==='a'&&n.attrs.href&&!n.inactive)){
  // A fragment-only anchor is same-document navigation, not another page read.
  if(n.attrs.href.startsWith('#'))continue
  let u;try{u=new URL(n.attrs.href,url)}catch{continue}
  if(u.origin!==origin||u.pathname!=='/search/'||!u.searchParams.has('startrow'))continue
  need(!u.username&&!u.password&&!u.hash&&[...u.searchParams.keys()].length===4&&new Set(u.searchParams.keys()).size===4&&u.searchParams.get('q')===''&&u.searchParams.get('sortColumn')==='referencedate'&&u.searchParams.get('sortDirection')==='desc'&&/^(?:0|[1-9]\d*)$/.test(u.searchParams.get('startrow')),'Unreviewed native pagination query',{url:u.href})
  const offset=listingRequestOffset(u.href);need(offset<total,'Invalid declared pagination offset');pages.push({url:u.href,offset})
 }
 const unique=[...new Map(pages.map(x=>[x.url,x])).values()]
 need(new Set(unique.map(x=>x.offset)).size===unique.length,'Duplicate offset with distinct query identity')
 return{url,start,end,total,rows,pages:unique}
}
const authorityLinkProfiles={"corporate":["11a16f43e8fe50af98d5e4395db00465313f7ed534b817c87dc5c8f985e0a716","419752169d9fc3efea082e118a6e807662f4cc7fed4dd27fcb216bb60b9ea279"],"boardSearch":["52591b13e429dfd6bed2074a4b9188114c40eb30cc799c25076d8aaad889ae55","5a5f466302983c8101f21f094b12b8c14d16ee036e765860db747ea680971f9b","90e88f9135a2f4ff54033046621dfa533af9ef34f7d6b4fe8f68a40b2d06809c"],"reciprocal":["48895af4a702e18c0e0d7186613e9d85f06830325b86e86045ec2eab958d3baa","49acddf77946b394d095e67ecbd979eb2addcf136ceaa5151a539babb35d8445","55a61fd98ba5c9d092b8beed77aaf81dea822809762ca17fcdb406b469ace59e","9cac1c8b418d4c9dcd3c3493a07e63dfc973d42fb882f4344cc81ab2355bf08c","bce110598996cafadbff66125fd0bb3130f134b54cbbbaf9850bd908923eaa8d","d332f155d9ce3c787657c07cb8703465fed9349dee6db77eb6f099bd4b246e2d"]}
const validateAuthorityLinks=(d,hrefs,kind)=>{
 const matches=d.nodes.filter(n=>n.tag==='a'&&!n.inactive&&hrefs.includes(n.attrs.href))
 need(matches.length>0,'Missing active '+kind+' handoff')
 for(const n of matches){
  const ancestors=[];let a=n.parent
  noDuplicates(n);need(!Object.keys(n.attrs).some(k=>/^on/i.test(k)),'Event-controlled handoff')
  while(a){
   if(a.attributeTokens)noDuplicates(a)
   need(!Object.keys(a.attrs).some(k=>/^on/i.test(k)),'Event-controlled handoff ancestor')
   ancestors.unshift({tag:a.tag,attrsSHA256:sha(JSON.stringify(a.attrs)),siblingTagIndex:a.parent?a.parent.children.filter(x=>typeof x!=='string'&&x.tag===a.tag).indexOf(a):0});a=a.parent
  }
  const context=sha(JSON.stringify({outerSHA256:sha(d.outer(n)),ancestors}))
  need(authorityLinkProfiles[kind]?.includes(context),'Unreviewed whole handoff carrier/context',{kind,context})
 }
}
// Authority records keep their public two-field contract. The complete validated
// selection belongs to this module; raw page digests are never canonicalized.
const validatedAuthorityModels=new WeakMap()
const authorityNodeContext=(d,n,html)=>{
 const opening=x=>x.tag==='root'?'':html.slice(x.start,x.openEnd)
 const siblings=x=>x.parent?x.parent.children.filter(c=>typeof c!=='string'):[]
 const part=x=>({tag:x.tag,attrs:x.attrs,attributeTokens:x.attributeTokens??[],rawOpeningTag:opening(x),elementSiblingIndex:x.parent?siblings(x).indexOf(x):0,siblingTagIndex:x.parent?siblings(x).filter(c=>c.tag===x.tag).indexOf(x):0})
 const ancestors=[];for(let a=n.parent;a;a=a.parent)ancestors.unshift(part(a))
 return{outerHTML:d.outer(n),...part(n),ancestors}
}
const selectedAuthorityLinks=(d,hrefs,kind,expectedCount,html)=>{
 const matches=d.nodes.filter(n=>n.tag==='a'&&hrefs.includes(n.attrs.href)),active=matches.filter(n=>!n.inactive)
 need(active.length===expectedCount,'Unexpected complete '+kind+' handoff set',{kind,count:active.length,expectedCount})
 return active.map(n=>({targetURL:n.attrs.href,context:authorityNodeContext(d,n,html)}))
}
const rememberAuthority=(d,url,nextURL,html)=>{
 const canonicalNodes=d.nodes.filter(n=>n.tag==='link'&&(n.attrs.rel||'').split(/\s+/).includes('canonical'))
 const corporate=url===PROVIDENCE_INDIA_CAREERS_URL
 need(canonicalNodes.length===(corporate?1:0),'Unexpected authority canonical set',{count:canonicalNodes.length,expectedCount:corporate?1:0})
 const selectedAuthority={requestURL:url,nextURL,baseCount:0,canonical:canonicalNodes.map(n=>({targetURL:n.attrs.href,context:authorityNodeContext(d,n,html)})),tenant:corporate?null:'providence',handoffs:corporate?{corporate:selectedAuthorityLinks(d,[PROVIDENCE_INDIA_BOARD_URL],'corporate',2,html)}:{boardSearch:selectedAuthorityLinks(d,[PROVIDENCE_INDIA_SEARCH_URL],'boardSearch',3,html),reciprocal:selectedAuthorityLinks(d,['https://www.providence.in','https://www.providence.in/'],'reciprocal',6,html)}}
 const record={nextURL,bodySHA256:sha(html)}
 // Inactive literal targets are full non-authority observations, not an
 // agreement requirement. Activation changes the strict active selection.
 const observedTargets=corporate?[PROVIDENCE_INDIA_BOARD_URL]:[PROVIDENCE_INDIA_SEARCH_URL,'https://www.providence.in','https://www.providence.in/']
 const nonAuthorityObservations={inactiveMatchingLinks:d.nodes.filter(n=>n.tag==='a'&&n.inactive&&observedTargets.includes(n.attrs.href)).map(n=>({targetURL:n.attrs.href,inactive:true,context:authorityNodeContext(d,n,html)}))}
 validatedAuthorityModels.set(record,{selectedAuthority,nonAuthorityObservations,passiveValidation:{kind:corporate?'corporate':'board',allExistingWholeSurfaceGuardsPassed:true,passiveCarrierFrame:passiveCarrierFrame(d)}})
 return record
}
export const readProvidenceAuthorityHTML=(html,url)=>{
 const d=tree(html);passiveSurface(d,null,url===PROVIDENCE_INDIA_CAREERS_URL?'corporate':'board')
 need(!d.nodes.some(n=>n.tag==='base'),'Unreviewed handoff base')
 if(url===PROVIDENCE_INDIA_CAREERS_URL){
  canonical(d,url);validateAuthorityLinks(d,[PROVIDENCE_INDIA_BOARD_URL],'corporate')
  return rememberAuthority(d,url,PROVIDENCE_INDIA_BOARD_URL,html)
 }
 need(url===PROVIDENCE_INDIA_BOARD_URL,'Unreviewed authority URL');tenant(d)
 validateAuthorityLinks(d,[PROVIDENCE_INDIA_SEARCH_URL],'boardSearch')
 validateAuthorityLinks(d,['https://www.providence.in','https://www.providence.in/'],'reciprocal')
 return rememberAuthority(d,url,PROVIDENCE_INDIA_SEARCH_URL,html)
}
const compareAuthorityClosing=(opening,closing,kind,audit)=>{
 const first=validatedAuthorityModels.get(opening),last=validatedAuthorityModels.get(closing)
 const message=kind==='board'?'Native board authority changed during closing':'Corporate authority changed during closing'
 // Compare complete selected facts every time, even when raw digests match.
 need(first&&last&&jsonEqual(first.selectedAuthority,last.selectedAuthority),message,{opening,closing,openingSelectedAuthority:first?.selectedAuthority,closingSelectedAuthority:last?.selectedAuthority})
 const receipt=(stage,record,model)=>{
  const r=one(audit.receipts.filter(x=>x.stage===stage),'authority raw response receipt')
  need(r.requestedURL===model.selectedAuthority.requestURL&&r.finalURL===r.requestedURL&&r.status===200&&r.complete===true&&typeof r.bodySHA256==='string'&&/^[a-f0-9]{64}$/.test(r.bodySHA256)&&record.nextURL===model.selectedAuthority.nextURL,'Authority raw response receipt mismatch',{stage})
  return{id:r.id,stage:r.stage,requestedURL:r.requestedURL,finalURL:r.finalURL,status:r.status,complete:r.complete,decodedBytes:r.decodedBytes,bodySHA256:r.bodySHA256}
 }
 const openingRaw=receipt('opening-'+kind,opening,first),closingRaw=receipt('closing-'+kind,closing,last)
 if(openingRaw.bodySHA256!==closingRaw.bodySHA256){
  audit.authorityClosingEvidence??=[]
  audit.authorityClosingEvidence.push({kind,selectedAuthorityModelsEntireEqual:true,wholeRawBodyEqual:false,opening:{...first,rawResponse:openingRaw,htmlInputSHA256:opening.bodySHA256},closing:{...last,rawResponse:closingRaw,htmlInputSHA256:closing.bodySHA256},qualification:'Both complete selected authority models agree after independent whole passive/programme/tenant/context guards. Entire raw pages differ outside this equality claim; unmatched page drift is retained, without browser/runtime or complete-company equivalence.'})
 }
}


// Every substituted span belongs to a separately validated exact own field.
// All other owner bytes, including programs, styles, hidden subtrees, attributes,
// text and ordering, remain in the source frame. No program literal is masked.
export const describeProvidenceOwnerFrame=model=>{
 const raw=model.rawJobPostingHTML,d=tree(raw),spans=[]
 const put=(field,from,to,expected,decoded)=>{
  const value=raw.slice(from,to);need(value===expected,'Frame binding differs from native field',{field})
  spans.push({field,from,to,marker:'[[bound-native-'+field+']]',rawSHA256:sha(value),decodedValueSHA256:sha(decoded)})
 }
 const attribute=(node,key,field,expected)=>{
  noDuplicates(node)
  const opening=raw.slice(node.start,node.openEnd),pattern=new RegExp('(?:^|[\\t\\n\\f\\r ])'+key+'[\\t\\n\\f\\r ]*=[\\t\\n\\f\\r ]*("([^"]*)"|\u0027([^\u0027]*)\u0027)','g')
  const found=[...opening.matchAll(pattern)].filter(m=>decodeHTML(m[2]??m[3])===expected)
  const m=one(found,'literal '+field+' frame binding'),value=m[2]??m[3],begin=node.start+m.index+m[0].length-value.length-1
  put(field,begin,begin+value.length,value,expected)
 }
 const expected={addressLocality:model.address.addressLocality,addressRegion:model.address.addressRegion,addressCountry:model.address.addressCountry,datePosted:model.datePosted,validThrough:model.validThrough,hiringOrganization:model.employer}
 for(const[field,value]of Object.entries(expected)){
  if(value===null)continue
  const n=one(d.nodes.filter(n=>n.attrs.itemprop===field),'frame '+field);attribute(n,'content',field,value)
 }
 const title=one(d.nodes.filter(n=>n.attrs.itemprop==='title'),'frame title'),description=one(d.nodes.filter(n=>n.attrs.itemprop==='description'),'frame description')
 need(title.children.every(c=>typeof c==='string')&&text(title)===model.title,'Non-atomic title frame')
 put('title',title.openEnd,title.closeStart,d.inner(title),model.title)
 put('description',description.openEnd,description.closeStart,model.descriptionHTML,model.descriptionText)
 const apply=d.nodes.filter(n=>n.tag==='a'&&n.attrs.href&&n.attrs.href.includes('/talentcommunity/apply/'))
 for(const n of apply){const u=nativeURL(n.attrs.href);need(u.href===model.applyUrl,'Unbound own application carrier');attribute(n,'href','applyHref',n.attrs.href)}
 const ordered=spans.sort((a,b)=>a.from-b.from);need(ordered.every((x,i)=>!i||ordered[i-1].to<=x.from),'Overlapping native frame fields')
 let frame=raw
 for(const x of [...ordered].reverse())frame=frame.slice(0,x.from)+x.marker+frame.slice(x.to)
 return{method:'whole-original-owner-source-frame-exact-own-field-spans-only',sourceFrameSHA256:sha(frame),originalOwnerSHA256:sha(raw),bindings:ordered,allOtherBytesUnchanged:true,programSpansMasked:0}
}


const ownerFrames=new Set(['f456aaaea26d4ef0387dee9e3b65bbcebca7c5d7d0fa0712051997c9fb469e25','3bef704ac013205d52c008e1072fd3cca894c305ae3f8b8f426ef60916e44798'])
const limits={maxPages:12,maxDetails:120,maxRequests:280,sourceTimeoutMs:180000,requestTimeoutMs:15000,maxBodyBytes:3*1024*1024,maxTotalBytes:32*1024*1024}
const optionsWithBounds=options=>{
 const result={...limits}
 for(const[key,ceiling]of Object.entries(limits)){
  const value=options[key]??ceiling
  need(Number.isSafeInteger(value)&&value>0&&value<=ceiling,'Invalid or excessive '+key,{value,ceiling});result[key]=value
 }
 const maxJobs=options.maxJobs??null
 need(maxJobs===null||Number.isSafeInteger(maxJobs)&&maxJobs>0&&maxJobs<=limits.maxDetails,'Invalid output cap',{maxJobs})
 return{...result,maxJobs}
}
const abortRace=(work,signal)=>new Promise((resolve,reject)=>{
 let done=false
 const finish=(action,value)=>{if(done)return;done=true;signal.removeEventListener('abort',onAbort);action(value)}
 const onAbort=()=>finish(reject,signal.reason)
 Promise.resolve(work).then(value=>finish(resolve,value),error=>finish(reject,error))
 signal.addEventListener('abort',onAbort,{once:true});if(signal.aborted)onAbort()
})
const allowedReadURL=url=>{
 if([PROVIDENCE_INDIA_CAREERS_URL,PROVIDENCE_INDIA_BOARD_URL,PROVIDENCE_INDIA_SEARCH_URL].includes(url))return true
 const u=nativeURL(url)
 if(/^\/job\/[A-Za-z0-9%._~-]+\/[1-9]\d*\/$/.test(u.pathname)&&!u.search)return roleURL(url).href===url
 return u.pathname==='/search/'&&[...u.searchParams.keys()].length===4&&new Set(u.searchParams.keys()).size===4&&u.searchParams.get('q')===''&&u.searchParams.get('sortColumn')==='referencedate'&&u.searchParams.get('sortDirection')==='desc'&&/^(?:0|[1-9]\d*)$/.test(u.searchParams.get('startrow'))
}
export const createProvidenceReader=(options={})=>{
 const config=optionsWithBounds(options),caller=options.signal,controller=new AbortController(),start=performance.now(),receipts=[],deadlines=new WeakMap()
 const fetchImpl=options.fetchImpl??globalThis.fetch;need(typeof fetchImpl==='function','Missing fetch implementation')
 const fetchCallbackErrors=new Set()
 let bytes=0,closed=false
 const stop=reason=>{if(!controller.signal.aborted)controller.abort(reason)}
 const callerAbort=()=>stop(caller.reason)
 if(caller){need(typeof caller.addEventListener==='function','Invalid caller signal');caller.addEventListener('abort',callerAbort,{once:true});if(caller.aborted)callerAbort()}
 const timeout=()=>Object.assign(gap('Aggregate native deadline exceeded',{sourceTimeoutMs:config.sourceTimeoutMs}),{nativeBudgetFailure:true})
 const timer=setTimeout(()=>stop(timeout()),config.sourceTimeoutMs)
 const check=()=>{
  if(caller?.aborted)throw caller.reason
  if(performance.now()-start>=config.sourceTimeoutMs)stop(timeout())
  if(controller.signal.aborted)throw controller.signal.reason
  need(!closed,'Native reader already closed')
 }
 const read=async(url,stage='native')=>{
  check();need(allowedReadURL(url),'Unapproved public read route',{url});need(receipts.length<config.maxRequests,'Native request cap reached',{maxRequests:config.maxRequests})
  const local=new AbortController(),deadline=performance.now()+config.requestTimeoutMs,state={response:null,reader:null,disposed:false,authorityValidated:false}
  const propagate=()=>{if(!local.signal.aborted)local.abort(controller.signal.reason)}
  controller.signal.addEventListener('abort',propagate,{once:true});if(controller.signal.aborted)propagate()
  const requestTimeout=()=>Object.assign(gap('Native request deadline exceeded',{url,stage,requestTimeoutMs:config.requestTimeoutMs}),{nativeBudgetFailure:true})
  const requestTimer=setTimeout(()=>{if(!local.signal.aborted)local.abort(requestTimeout())},config.requestTimeoutMs)
  const receipt={id:receipts.length+1,stage,requestedURL:url,method:'GET',redirect:'manual',credentials:'omit',status:null,finalURL:null,MIME:null,complete:false,decodedBytes:0,bodySHA256:null,body:null}
  receipts.push(receipt)
  const checkRequest=()=>{
   check();if(performance.now()>=deadline&&!local.signal.aborted)local.abort(requestTimeout())
   if(local.signal.aborted)throw local.signal.reason
  }
  const dispose=()=>{
   if(state.disposed||!state.response)return
   state.disposed=true
   try{const value=state.reader?.cancel?state.reader.cancel(local.signal.reason):state.response.body?.cancel?.(local.signal.reason);Promise.resolve(value).catch(()=>{})}catch{}
  }
  local.signal.addEventListener('abort',dispose,{once:true})
  const httpError=cause=>Object.assign(gap('HTTP '+receipt.status+' for '+url,{url,stage,status:receipt.status},cause),{
   status:receipt.status,upstreamOutage:[403,429].includes(receipt.status)||receipt.status>=500,
   failureKind:receipt.status===403?'blocked':receipt.status===429?'rate_limited':receipt.status>=500?'upstream_unavailable':'coverage_gap',nativeOriginalResponses:receipts,
  })
  try{
   let work
   try{work=fetchImpl(url,{method:'GET',redirect:'manual',credentials:'omit',headers:{Accept:'text/html,application/xhtml+xml'},signal:local.signal})}catch(error){fetchCallbackErrors.add(error);checkRequest();throw error}
   const owned=Promise.resolve(work).then(response=>{state.response=response;if(local.signal.aborted){dispose();throw local.signal.reason}checkRequest();return response},error=>{fetchCallbackErrors.add(error);throw error})
   owned.catch(()=>{});checkRequest()
   const response=await abortRace(owned,local.signal);checkRequest()
   need(response&&Number.isInteger(response.status)&&response.status>=100&&response.status<=599,'Malformed native response',{url,stage,rawStatus:response?.status})
   receipt.status=response.status;receipt.finalURL=response.url;receipt.MIME=response.headers?.get?.('content-type')??null
   need(response.url===url,'Response URL changed',{requested:url,actual:response.url})
   state.authorityValidated=true
   state.reader=response.body?.getReader?.()
   need(state.reader&&typeof state.reader.read==='function','Missing bounded native response body',{url,stage})
   const chunks=[]
   while(true){checkRequest();const operation=state.reader.read();checkRequest();const part=await abortRace(operation,local.signal);checkRequest();if(part.done)break
    need(part.value instanceof Uint8Array,'Unreviewed native body chunk',{url,stage})
    const chunk=Buffer.from(part.value);receipt.decodedBytes+=chunk.length;bytes+=chunk.length
    need(receipt.decodedBytes<=config.maxBodyBytes&&bytes<=config.maxTotalBytes,'Native byte budget exceeded',{url,stage,bodyBytes:receipt.decodedBytes,totalBytes:bytes})
    chunks.push(chunk)
   }
   const body=Buffer.concat(chunks);receipt.bodySHA256=sha(body)
   receipt.body=new TextDecoder('utf-8',{fatal:true}).decode(body);checkRequest();receipt.complete=true
   if(receipt.status!==200)throw httpError()
   need(/^text\/html(?:\s*;|$)/i.test(receipt.MIME||''),'Unreviewed native MIME',{url,MIME:receipt.MIME})
   const result={html:receipt.body,receipt};deadlines.set(result,deadline);return result
  }catch(error){
   if(caller?.aborted)throw caller.reason
   let failure=error
   try{checkRequest()}catch(reason){failure=reason}
   if(caller?.aborted)throw caller.reason
   // A deadline may explain a missing denial body; it cannot erase already
   // observed own HTTP metadata. Foreign-response metadata is never promoted.
   if(state.authorityValidated&&receipt.status!==null&&receipt.status!==200&&!(ownedErrors.has(failure)&&failure.status===receipt.status))throw httpError(failure)
   if(state.response&&!ownedErrors.has(failure))throw gap('Native response body failed',{url,stage,status:receipt.status},failure)
   throw failure
  }finally{
   clearTimeout(requestTimer);controller.signal.removeEventListener('abort',propagate);local.signal.removeEventListener('abort',dispose);dispose()
  }
 }
 const parse=(record,action)=>{
  check();const deadline=deadlines.get(record);need(Number.isFinite(deadline),'Unknown native response record')
  if(performance.now()>=deadline)throw Object.assign(gap('Native request parsing deadline exceeded',{url:record.receipt.requestedURL}),{nativeBudgetFailure:true})
  const result=action(record.html);check()
  if(performance.now()>=deadline)throw Object.assign(gap('Native request parsing deadline exceeded',{url:record.receipt.requestedURL}),{nativeBudgetFailure:true})
  return result
 }
 const close=()=>{clearTimeout(timer);if(caller)caller.removeEventListener('abort',callerAbort);closed=true}
 return{read,parse,check,close,receipts,signal:controller.signal,config,isFetchCallbackError:error=>fetchCallbackErrors.has(error)}
}
// Authored section-label data only. The whole native field is already checked
// by parseProvidenceRoleHTML before this additional bounded marker branch.
const authoredLabelPatterns=Object.entries({"responsibility-label":"(?:(?:key|core|main|essential|primary|job|role|principal|specific|major|typical|general|position|functional|technical)\\s+){0,2}(?:responsibilities|accountabilities|duties)(?:\\s*(?:&|and|/)\\s*(?:duties|responsibilities|accountabilities))?\\s*:","responsibility-label-no-colon":"(?:(?:key|core|main|essential|primary|job|role|principal|specific|major|typical|general|position|functional|technical)\\s+){0,2}(?:responsibilities|accountabilities|duties)(?:\\s*(?:&|and|/)\\s*(?:duties|responsibilities|accountabilities))?","qualification-label":"(?:(?:minimum|required|preferred|basic|essential|desired|mandatory|professional|technical|key|additional|educational)\\s+){0,2}qualifications(?:\\s*(?:&|and|/)\\s*(?:experience|skills))?\\s*:?","experience-label":"(?:(?:minimum|required|preferred|desired|relevant|professional|technical|key|additional|educational|work)\\s+){0,2}(?:experience|skills)(?:\\s*(?:&|and|/)\\s*(?:experience|skills))?\\s*:?","summary-label":"(?:position|job|role)\\s+summary\\s*:?"}).map(([family,pattern])=>({family,re:new RegExp('^(?:'+pattern+')$','i')}))
// Employer-authored question headings are still complete standalone labels
// inside the validated native criteria field, never substring/prose matches.
const authoredQuestionLabelPatterns=[
 {family:'responsibility-question-label',re:/^what will you be responsible for\?$/i},
 {family:'qualification-question-label',re:/^who (?:are we|we are) looking for\?$/i},
]
authoredLabelPatterns.push(...authoredQuestionLabelPatterns)
const authoredLabelWrappers=new Set(['p','div','span','strong','b','em','u','br'])
const authoredCriteriaLabels=(d,native)=>{
 const nodes=descendants(native),projected=new Map(),safe=new Map()
 // The same clean/textLeaf primitives are used exactly once per text leaf.
 // Oversized text cannot shrink into a complete <=120-character parent label.
 for(const n of [...nodes].reverse()){
  const children=n.children.filter(c=>typeof c!=='string')
  const pieces=n.children.map(c=>typeof c==='string'?clean(textLeaf(c)):projected.get(c))
  const value=n.tag==='script'||n.tag==='style'?'':pieces.some(x=>x===null)?null:clean(pieces.join(' '))
  projected.set(n,value!==null&&value.length<=120?value:null)
  safe.set(n,authoredLabelWrappers.has(n.tag)&&!n.inactive&&new Set(n.attributeTokens.map(([key])=>key)).size===n.attributeTokens.length&&Object.entries(n.attrs).every(([key,value])=>criteriaFormattingAttribute(n.tag,key,value))&&children.every(c=>safe.get(c)))
 }
 const matches=[]
 for(const n of nodes){
  if(n===native||!['p','div','strong','b'].includes(n.tag)||!safe.get(n))continue
  const label=projected.get(n)
  if(!label||!/^[A-Za-z &/:?]+$/.test(label))continue
  const families=authoredLabelPatterns.filter(x=>x.re.test(label)).map(x=>x.family)
  if(!families.length)continue
  const block=['p','div'].includes(n.tag)&&label.length<=80
  let standalone=n.parent
  while(standalone&&standalone!==native&&['span','strong','b','em','u'].includes(standalone.tag)){
   if(!safe.get(standalone)){standalone=null;break}
   standalone=standalone.parent
  }
  const emphasis=['strong','b'].includes(n.tag)&&label.length<=120&&['p','div','span'].includes(n.parent?.tag)&&standalone&&standalone!==native&&['p','div'].includes(standalone.tag)&&inScope(standalone,native)&&safe.get(standalone)&&projected.get(standalone)===label
  if(!block&&!emphasis)continue
  matches.push({n,label,families,boundary:block?'whole-p-or-div-block':'whole-standalone-strong-or-b-block'})
  // Excessive/ambiguous additional evidence stays marker-held, never a new
  // source/read budget or permission to omit native authored criteria.
  if(matches.length>128)return[]
 }
 return matches.map(({n,label,families,boundary})=>{
  const descriptionNodePath=[]
  for(let x=n;x!==native;x=x.parent)descriptionNodePath.unshift(x.parent.children.filter(c=>typeof c!=='string').indexOf(x))
  const rawLabelHTML=d.outer(n)
  return{kind:'own-native-description-authored-label',interpretation:'authored-section-label-only',tag:n.tag,boundary,grammarFamilies:families,labelText:label,labelTextSHA256:sha(label),rawLabelHTML,rawHTMLSHA256:sha(rawLabelHTML),descriptionHTMLSHA256:sha(d.inner(native)),descriptionNodePath}
 })
}

const currentRole=(html,row,now)=>{
 const d=tree(html),result=parseProvidenceRoleHTML(html,row,{now}),frame=describeProvidenceOwnerFrame(result.model)
 const reviewedOwner=ownerFrames.has(frame.sourceFrameSHA256)?one(d.nodes.filter(n=>n.attrs.itemtype==='http://schema.org/JobPosting'),'reviewed whole owner'):null
 // This exact hidden UI script is passive data, within the exact own-field-bound
 // owner frame. No program bytes are masked/executed; visibility remains unknown.
 const passiveDataEvidence=passiveSurface(d,reviewedOwner,'detail',result.model.publicId);tenant(d)
 if(passiveDataEvidence)result.passiveDataEvidence=passiveDataEvidence
 result.model.ownerFrame=frame
 if(!ownerFrames.has(frame.sourceFrameSHA256)){result.held=true;result.reasons.push('unreviewed-full-native-owner-frame')}
 const native=one(d.nodes.filter(n=>n.attrs.itemprop==='description'),'native description')
 const heldBeforeCriteriaMarker=result.held
 const headers=descendants(native).filter(n=>/^h[1-4]$/.test(n.tag)).map(text)
 if(!headers.some(v=>/responsibilit|qualification|requirement|experience|what you|position summary/i.test(v)||authoredQuestionLabelPatterns.some(({re})=>re.test(v)))){result.held=true;result.reasons.push('native-full-role-criteria-markers-unproven')}
 if(reviewedOwner&&result.reasons.includes('native-full-role-criteria-markers-unproven')){
  const authoredCriteriaLabelEvidence=authoredCriteriaLabels(d,native)
  if(authoredCriteriaLabelEvidence.length){
   result.held=heldBeforeCriteriaMarker
   result.reasons.splice(result.reasons.indexOf('native-full-role-criteria-markers-unproven'),1)
   result.authoredCriteriaLabelEvidence=authoredCriteriaLabelEvidence
  }
 }
 const closingNotice=result.model.descriptionText.match(/(?:^|[.!?]\s+)(?:this|the)\s+(?:position|role|vacancy|job)\s+(?:has been (?:filled|closed)|is (?:closed|on hold|paused)|is no longer accepting applications)\b/i)
 if(closingNotice){result.held=true;result.reasons.push('native-affirmative-own-role-closure');result.model.nativeClosureNotice=closingNotice[0]}
 for(const display of row.displayLocation||[]){
  const parts=display.split(',').map(x=>x.trim()),code=parts.at(-1)
  if(parts.length>=2&&/^[A-Z]{2}$/.test(code)&&code!==result.model.address.addressCountry){result.held=true;result.reasons.push('listing-detail-explicit-country-disagreement')}
 }
 return result
}
const jsonEqual=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
export const createProvidenceScraper=(constructorOptions={})=>({
 async run(runOptions={}){
  const options={...constructorOptions,...runOptions},config=optionsWithBounds(options),nowFn=options.now??(()=>new Date().toISOString())
  need(typeof nowFn==='function','Invalid collection clock function')
  const reader=createProvidenceReader(options)
  const audit={parser:'current-corporate-declared-providence-india-rmk-microdata',scope:'configured-India-channel-only-company-channels-unknown',sourceScopeComplete:false,lifecycleCleanupAllowed:false,companyGlobalTotal:null,companyIndiaTotal:null,configuredBoardReconciled:false,receipts:reader.receipts,openingListings:[],openingRoles:[],closingListings:[],closingRoles:[],held:[],declaredPaginationAliases:[]}
  let callbackFailure=false
  const step=async(url,stage,parse)=>{const record=await reader.read(url,stage);return reader.parse(record,html=>parse(html))}
  const clock=()=>{let value;try{value=nowFn()}catch(error){callbackFailure=true;throw error}need(typeof value==='string'&&Number.isFinite(Date.parse(value)),'Invalid collection clock');reader.check();return value}
  try{
   audit.openingCorporate=await step(PROVIDENCE_INDIA_CAREERS_URL,'opening-corporate',html=>readProvidenceAuthorityHTML(html,PROVIDENCE_INDIA_CAREERS_URL))
   audit.openingBoard=await step(PROVIDENCE_INDIA_BOARD_URL,'opening-board',html=>readProvidenceAuthorityHTML(html,PROVIDENCE_INDIA_BOARD_URL))
   const known=new Map([[0,PROVIDENCE_INDIA_SEARCH_URL]]),readOffsets=new Set(),rows=[],rowIDs=new Set();let total=null
   while([...known.keys()].some(x=>!readOffsets.has(x))){
    need(audit.openingListings.length<config.maxPages,'Native page cap reached',{knownOffsets:[...known.keys()],readOffsets:[...readOffsets]})
    const offset=[...known.keys()].filter(x=>!readOffsets.has(x)).sort((a,b)=>a-b)[0],url=known.get(offset)
    const page=await step(url,'opening-listing',html=>{const page=parseProvidenceListingHTML(html,url),d=tree(html);passiveSurface(d,null,'listing',null,{page,known,zeroWitnessed:readOffsets.has(0)&&audit.openingListings.some(p=>listingRequestOffset(p.url)===0)});tenant(d);return page})
    need(page.start===offset+1,'Declared pagination offset/range mismatch',{offset,start:page.start})
    if(total===null)total=page.total;need(page.total===total,'Native listing total changed',{openingTotal:total,currentTotal:page.total})
    for(const row of page.rows){need(!rowIDs.has(row.publicId),'Duplicate native role across pages',{publicId:row.publicId});rowIDs.add(row.publicId);rows.push(row)}
    for(const p of page.pages){if(p.offset===0)continue;if(known.has(p.offset)){if(known.get(p.offset)!==p.url)audit.declaredPaginationAliases.push({offset:p.offset,firstURL:known.get(p.offset),aliasURL:p.url})}else known.set(p.offset,p.url)}
    readOffsets.add(offset);audit.openingListings.push(page)
   }
   need(rows.length===total,'Native listing union does not equal published total',{observed:rows.length,reported:total})
   const pages=[...audit.openingListings].sort((a,b)=>a.start-b.start)
   need(pages[0]?.start===1&&pages.at(-1)?.end===total&&pages.every((p,i)=>!i||pages[i-1].end+1===p.start),'Native listing ranges are not contiguous')
   audit.nativeReportedChannelTotal=total;audit.nativeObservedRows=rows.length
   need(rows.length<=config.maxDetails,'Native detail cap reached before complete role inspection',{observed:rows.length,maxDetails:config.maxDetails})
   for(const row of rows){
    const record=await reader.read(row.sourceUrl,'opening-detail');let result
    try{result=reader.parse(record,html=>currentRole(html,row,clock()))}catch(error){if(callbackFailure||!ownedErrors.has(error)||error.nativeBudgetFailure)throw error;reader.check();result={held:true,reasons:[error.message],model:null,rawHTML:record.html,nativeEvidence:error.nativeRoleEvidence??error.nativeEvidence}}
    audit.openingRoles.push({row,...result})
   }
   for(const original of audit.openingRoles){
    const record=await reader.read(original.row.sourceUrl,'closing-detail');let result
    try{result=reader.parse(record,html=>currentRole(html,original.row,clock()))}catch(error){if(callbackFailure||!ownedErrors.has(error)||error.nativeBudgetFailure)throw error;reader.check();result={held:true,reasons:[error.message],model:null,rawHTML:record.html,nativeEvidence:error.nativeRoleEvidence??error.nativeEvidence}}
    need(jsonEqual({held:original.held,reasons:original.reasons,model:original.model,rawHTML:original.rawHTML,...(original.authoredCriteriaLabelEvidence?{authoredCriteriaLabelEvidence:original.authoredCriteriaLabelEvidence}:{}),...(original.passiveDataEvidence?{passiveDataEvidence:original.passiveDataEvidence}:{})},{held:result.held,reasons:result.reasons,model:result.model,rawHTML:result.rawHTML,...(result.authoredCriteriaLabelEvidence?{authoredCriteriaLabelEvidence:result.authoredCriteriaLabelEvidence}:{}),...(result.passiveDataEvidence?{passiveDataEvidence:result.passiveDataEvidence}:{})}),'Native whole role changed during closing',{publicId:original.row.publicId,opening:original,closing:result})
    audit.closingRoles.push({row:original.row,...result})
   }
   for(const original of audit.openingListings){const page=await step(original.url,'closing-listing',html=>{const page=parseProvidenceListingHTML(html,original.url),d=tree(html);passiveSurface(d,null,'listing',null,{page,known,zeroWitnessed:readOffsets.has(0)&&audit.openingListings.some(p=>listingRequestOffset(p.url)===0)});tenant(d);return page});need(jsonEqual(page,original),'Native whole listing changed during closing',{opening:original,closing:page});audit.closingListings.push(page)}
   audit.closingBoard=await step(PROVIDENCE_INDIA_BOARD_URL,'closing-board',html=>readProvidenceAuthorityHTML(html,PROVIDENCE_INDIA_BOARD_URL))
   compareAuthorityClosing(audit.openingBoard,audit.closingBoard,'board',audit)
   audit.closingCorporate=await step(PROVIDENCE_INDIA_CAREERS_URL,'closing-corporate',html=>readProvidenceAuthorityHTML(html,PROVIDENCE_INDIA_CAREERS_URL))
   compareAuthorityClosing(audit.openingCorporate,audit.closingCorporate,'corporate',audit)
   audit.configuredBoardReconciled=true;audit.held=audit.openingRoles.filter(x=>x.held)
   const allQualified=audit.openingRoles.filter(x=>!x.held),selected=config.maxJobs===null?allQualified:allQualified.slice(0,config.maxJobs)
   audit.outputLimited=selected.length!==allQualified.length
   const jobs=selected.map(({model:m})=>({source:'providence',company:'Providence',legalEmployer:null,title:m.title,jobId:m.publicId,requisitionId:null,nativePublicJobId:m.publicId,sourceUrl:m.sourceUrl,applyUrl:m.applyUrl,link:m.applyUrl,country:'India',city:m.address.addressLocality,state:m.address.addressRegion,location:[m.address.addressLocality,m.address.addressRegion,'India'].join(', '),department:null,employmentType:null,experienceRequired:null,minimumQualification:null,preferredQualification:null,requiredSkills:[],jobDescription:m.descriptionText,sourceDescription:m.descriptionText,nativeDescriptionHTML:m.descriptionHTML,postingDate:m.postingDate,closingDate:m.closingDate,nativeDatePosted:m.datePosted,nativeValidThrough:m.validThrough,originalPublicationDate:null,nativeEmployerLabel:m.employer,sourceNativeCountryEvidence:{kind:'own-JobPosting-Place-PostalAddress-addressCountry',rawCountry:m.address.addressCountry,rawAddress:m.address},sourceNativeCriteriaEvidence:{kind:'entire-own-native-description',rawHTML:m.descriptionHTML,fullText:m.descriptionText,ownerFrame:m.ownerFrame},sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,sourceParser:audit.parser,nativeOpeningClosingMatched:true,scrapedAt:clock()}))
   Object.defineProperty(jobs,'sourceAudit',{value:audit,configurable:true})
   attachInventoryEvidence(jobs,{status:'discovery-only',surface:PROVIDENCE_INDIA_CAREERS_URL,firstParty:true,listingComplete:false,pagesFetched:audit.openingListings.length,reportedTotal:null,indiaFacetCount:null,verifiedAt:clock(),reason:'configured-India-channel-reconciled-whole-company-other-channels-unknown'})
   attachSourceObservationEvidence(jobs,{source:'providence',recordKind:'vacancy-rows',observedRecordCount:rows.length,observedVacancyCount:rows.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
   const observations=readSourceObservationEvidence(jobs,'providence')
   need(observations,'Missing normalized native observation snapshot')
   // The registry retains this compatible rich data descriptor alongside the
   // immutable normalized symbol; callback-only/sourceAudit metadata is insufficient.
   Object.defineProperty(jobs,'nativeCollectionEvidence',{value:{...observations,...audit,source:'providence'},configurable:true})
   if(options.onAudit){try{await abortRace(options.onAudit(audit),reader.signal)}catch(error){callbackFailure=true;throw error}}
   reader.check();return jobs
  }catch(error){
   if(options.signal?.aborted)throw options.signal.reason
   if(!callbackFailure&&!reader.isFetchCallbackError(error)&&ownedErrors.has(error)){error.sourceAudit=audit;error.nativeOriginalResponses=reader.receipts;error.sourceScopeComplete=false;error.lifecycleCleanupAllowed=false}
   throw error
  }finally{reader.close()}
 },
})
