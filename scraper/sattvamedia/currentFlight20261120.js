import{parse}from'acorn'
import{parseEightfoldJson}from'../../scraper-support/utils/recruitmentEightfoldData.js'
import{clientScriptDeclarations}from'../../scraper-support/utils/reviewedClientProgram.js'
const check=(ok,why)=>{if(!ok)throw Object.assign(Error('Sattva native literal data contract: '+why),{failureKind:'parser_or_contract_error',abortRetries:true,sourceScopeComplete:false,lifecycleCleanupAllowed:false})}
export function nativeFlightRows(html){
 const chunks=[];for(const n of clientScriptDeclarations(html)){if(n.attrs.src||!n.raw?.includes('__next_f'))continue;const ast=parse(n.raw??'',{ecmaVersion:'latest',sourceType:n.attrs.type==='module'?'module':'script'});if(ast.body.length!==1)continue;const call=ast.body[0]?.expression,c=call?.callee,a=call?.arguments?.[0]
  if(call?.type==='CallExpression'&&call.arguments.length===1&&c?.type==='MemberExpression'&&!c.computed&&c.property.name==='push'&&c.object?.type==='MemberExpression'&&!c.object.computed&&c.object.object?.name==='self'&&c.object.property.name==='__next_f'&&a?.type==='ArrayExpression'&&a.elements.length===2&&a.elements[0]?.type==='Literal'&&a.elements[0].value===1&&a.elements[1]?.type==='Literal'&&typeof a.elements[1].value==='string')chunks.push(a.elements[1].value)
 }
 check(chunks.length>0,'complete active literal data frames required');const bytes=Buffer.from(chunks.join('')),rows=[],ids=new Set(),streams=new Map(),decode=b=>new TextDecoder('utf-8',{fatal:true}).decode(b);let at=0
 while(at<bytes.length){if(bytes[at]===10){at++;continue}const colon=bytes.indexOf(58,at);check(colon>=at,'complete native wire header');const id=decode(bytes.subarray(at,colon));check(id===''||/^[a-f0-9]+$/i.test(id),'native wire identity');at=colon+1
  check(rows.length<512,'native wire record budget')
  if(id&&bytes[at]===84){const comma=bytes.indexOf(44,at),hex=comma<0?'':decode(bytes.subarray(at+1,comma));check(/^[a-f0-9]+$/i.test(hex),'native text byte length');const length=parseInt(hex,16),start=comma+1;check(Number.isSafeInteger(length)&&length>=0&&start+length<=bytes.length,'whole native text record');rows.push({id,kind:'text',value:decode(bytes.subarray(start,start+length))});at=start+length
  }else{const newline=bytes.indexOf(10,at),end=newline<0?bytes.length:newline,raw=decode(bytes.subarray(at,end));if(id&&/^[[{"]/.test(raw))rows.push({id,kind:'model',value:parseEightfoldJson(raw)});else rows.push({id,kind:id?'directive':'resource-hint',raw});at=end+1}
  const row=rows.at(-1);if(id){if(row.kind==='directive'&&row.raw==='X'){check(!ids.has(id),'unique empty native stream start');ids.add(id);streams.set(id,'open')}else if(row.kind==='directive'&&row.raw==='C'){check(streams.get(id)==='open','paired empty native stream close');streams.set(id,'closed')}else{check(!ids.has(id)&&!(row.kind==='directive'&&/^[XC]/.test(row.raw)),'unique native wire identity and typed control');ids.add(id)}}
 }
 check([...streams.values()].every(state=>state==='closed'),'complete native stream control pairs')
 return rows
}
export function nativeText(rows,value){const seen=new Set();while(typeof value==='string'&&/^\$[a-f0-9]+$/i.test(value)){const id=value.slice(1),targets=rows.filter(r=>r.id===id);check(!seen.has(id)&&targets.length===1&&['text','model'].includes(targets[0].kind),'unique data-only native text dependency');seen.add(id);value=targets[0].value}check(typeof value==='string'&&!/^\$/.test(value),'complete native text value');return value}
