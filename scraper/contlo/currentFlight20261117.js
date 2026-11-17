import{createHash}from'node:crypto'
import{parse}from'acorn'
import{isDeepStrictEqual as equal}from'node:util'
import{clientScriptDeclarations}from'../../scraper-support/utils/reviewedClientProgram.js'
const sha=s=>createHash('sha256').update(s).digest('hex'),check=(ok,why)=>{if(!ok)throw Object.assign(Error('Contlo native hydration contract: '+why),{failureKind:'parser_or_contract_error',abortRetries:true,sourceScopeComplete:false,lifecycleCleanupAllowed:false})}
export function nativeFlightRows(html){
 const chunks=[];for(const n of clientScriptDeclarations(html)){if(n.attrs.src)continue;const ast=parse(n.raw??'',{ecmaVersion:'latest',sourceType:n.attrs.type==='module'?'module':'script'});if(ast.body.length!==1)continue;const call=ast.body[0]?.expression,c=call?.callee,a=call?.arguments?.[0]
  if(call?.type==='CallExpression'&&call.arguments.length===1&&c?.type==='MemberExpression'&&!c.computed&&c.property.name==='push'&&c.object?.type==='MemberExpression'&&!c.object.computed&&c.object.object?.name==='self'&&c.object.property.name==='__next_f'&&a?.type==='ArrayExpression'&&a.elements.length===2&&a.elements[0]?.type==='Literal'&&a.elements[0].value===1&&a.elements[1]?.type==='Literal'&&typeof a.elements[1].value==='string')chunks.push(a.elements[1].value)
 }
 check(chunks.length>0,'complete active literal data frames required');const bytes=Buffer.from(chunks.join('')),rows=[],ids=new Set(),decode=b=>new TextDecoder('utf-8',{fatal:true}).decode(b);let at=0
 while(at<bytes.length){if(bytes[at]===10){at++;continue}const colon=bytes.indexOf(58,at);check(colon>=at,'complete native wire header');const id=decode(bytes.subarray(at,colon));check(id===''||/^[a-f0-9]+$/i.test(id),'native wire identity');at=colon+1
  if(id){check(!ids.has(id),'unique native wire identity');ids.add(id)}check(rows.length<512,'native wire record budget')
  if(id&&bytes[at]===84){const comma=bytes.indexOf(44,at),hex=comma<0?'':decode(bytes.subarray(at+1,comma));check(/^[a-f0-9]+$/i.test(hex),'native text byte length');const length=parseInt(hex,16),start=comma+1;check(Number.isSafeInteger(length)&&length>=0&&start+length<=bytes.length,'whole native text record');rows.push({id,kind:'text',value:decode(bytes.subarray(start,start+length))});at=start+length
  }else{const newline=bytes.indexOf(10,at),end=newline<0?bytes.length:newline,raw=decode(bytes.subarray(at,end));if(id&&/^[[{"]/.test(raw))rows.push({id,kind:'model',value:JSON.parse(raw)});else rows.push({id,kind:id?'directive':'resource-hint',raw});at=end+1}
 }
 return rows
}
const expected=(kind,row,schema)=>({token:row.url.split('/').at(-1),url:row.url,title:row.title,location:row.location,department:row.department,employment:row.type,criteria:schema.description,pageTitle:row.title+' at Contlo | Contlo Careers',socialTitle:row.title+' at Contlo',date:row.postedAt}[kind])
const atPath=(value,path)=>path.reduce((v,k)=>v?.[k],value)
export function flightBindingProfile(html,row,schema){
 const rows=nativeFlightRows(html),bindings=[],formPaths=[]
 const visit=(value,path)=>{if(typeof value==='string'){let kind;for(const key of['token','url','title','location','department','employment','criteria','pageTitle','socialTitle','date'])if(value===expected(key,row,schema)){kind=key;break}if(!kind){try{if(equal(JSON.parse(value),schema))kind='serializedJobPosting'}catch{}}if(kind)bindings.push({path,kind});return}if(!value||typeof value!=='object')return;if(!Array.isArray(value)&&Object.hasOwn(value,'token')&&Object.hasOwn(value,'organization')&&Object.hasOwn(value,'description'))formPaths.push(path);for(const[k,v]of Object.entries(value))visit(v,[...path,k])};visit(rows,[])
 check(formPaths.length===1&&bindings.some(b=>b.kind==='criteria')&&bindings.some(b=>b.kind==='serializedJobPosting'),'whole literal form/criteria/schema hydration carriers')
 const profile={bindings,formPath:formPaths[0]};profile.wholeWireModelSHA256=sha(JSON.stringify(boundShape(rows,row,schema,profile)));return profile
}
function boundShape(rows,row,schema,profile){
 const shape=structuredClone(rows);for(const b of profile.bindings){const value=atPath(rows,b.path);if(b.kind==='serializedJobPosting'){let parsed;try{parsed=JSON.parse(value)}catch{check(false,'literal serialized job schema')};check(equal(parsed,schema),'whole hydration/visible native schema agreement')}else check(value===expected(b.kind,row,schema),'typed hydration role field '+b.kind)
  const parent=atPath(shape,b.path.slice(0,-1));check(parent&&Object.hasOwn(parent,b.path.at(-1)),'exact native hydration data carrier');parent[b.path.at(-1)]='<BOUND-NATIVE-'+b.kind+'>'
 }
 const form=atPath(rows,profile.formPath);check(form&&form.token===expected('token',row,schema)&&form.organization==='Contlo'&&form.description&&typeof form.description==='object','exact native application token/employer/full criteria context')
 return shape
}
export function bindNativeFlight(html,row,schema,profile){const rows=nativeFlightRows(html);check(sha(JSON.stringify(boundShape(rows,row,schema,profile)))===profile.wholeWireModelSHA256,'whole native hydration model changed outside exact bound role data, including imports/resources/unknown passive context');return rows}
