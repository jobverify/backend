import path from 'node:path'

// A bounded, non-executing recognizer for a deliberately small set of module
// shapes. Unsupported syntax is inconclusive. This never evaluates company code
// and never treats an arbitrary occurrence of "discovery-only" as capability.
function tokenize(code) {
  if (code.length > 1024 * 1024) return null
  const tokens=[], stack=[], pairs=new Map(), opens=new Map([['(',')'],['[',']'],['{','}']])
  const push=(value,kind,start,end)=>tokens.push({value,kind,start,end,depth:stack.length})
  for(let i=0;i<code.length;){
    if(/\s/.test(code[i])){i++;continue}
    const start=i,c=code[i]
    if(code.startsWith('//',i)){i=code.indexOf('\n',i+2);if(i<0)break;continue}
    if(code.startsWith('/*',i)){const end=code.indexOf('*/',i+2);if(end<0)return null;i=end+2;continue}
    if(c==='"'||c==="'"||c==='`'){
      let escaped=false;i++
      while(i<code.length){if(code[i]==='\\'){escaped=true;i+=2;continue}if(c==='`'&&code.startsWith('${',i))return null;if(code[i]===c)break;i++}
      if(i>=code.length)return null;i++;push(escaped?'':code.slice(start+1,i-1),'string',start,i);continue
    }
    if(c==='/'&&(!tokens.length||['(','[','{','=',':',',',';','return','=>','!','&&','||','?'].includes(tokens.at(-1).value))){
      let inClass=false;i++
      for(;i<code.length;i++){if(code[i]==='\\'){i++;continue}if(code[i]==='[')inClass=true;if(code[i]===']')inClass=false;if(code[i]==='/'&&!inClass)break;if(/[\r\n]/.test(code[i]))return null}
      if(i>=code.length)return null;i++;while(/[a-z]/i.test(code[i]||'')&&i<code.length)i++;push('<regex>','opaque',start,i);continue
    }
    if(/[A-Za-z_$0-9]/.test(c)){i++;while(i<code.length&&/[A-Za-z_$0-9]/.test(code[i]))i++;push(code.slice(start,i),'word',start,i);continue}
    const value=['...','=>','?.','&&','||'].find(v=>code.startsWith(v,i))||c;i+=value.length
    if(opens.has(value)){push(value,'punctuation',start,i);stack.push({index:tokens.length-1,close:opens.get(value)})}
    else if([')',']','}'].includes(value)){const previous=stack.pop();if(!previous||previous.close!==value)return null;push(value,'punctuation',start,i);pairs.set(previous.index,tokens.length-1)}
    else push(value,'punctuation',start,i)
    if(tokens.length>100000)return null
  }
  return stack.length?null:{tokens,pairs}
}

export function isDiscoveryOnlyExecutable(code,{modulePath,evidenceModulePath}={}) {
  if(typeof code!=='string'||!code.includes('discovery-only')||!modulePath||!evidenceModulePath)return false
  const parsed=tokenize(code);if(!parsed)return false
  const {tokens:t,pairs}=parsed,v=i=>t[i]?.value,end=i=>pairs.get(i),aliases=new Set(),bindings=new Map()
  const skip=i=>pairs.has(i)?end(i)+1:i+1
  const statementStarts=new Set(['export','const','let','var','if','for','while','switch','try','throw','function','class'])
  const expressionEnd=(start,limit=t.length)=>{let i=start;for(;i<limit;){if(v(i)===';'||['}',')',']'].includes(v(i))
    ||i>start&&t[i].depth===t[start].depth&&statementStarts.has(v(i))&&/[\r\n]/.test(code.slice(t[i-1].end,t[i].start)))break;i=skip(i)}return i}
  function readFunction(start){
    let i=start;if(v(i)==='async')i++
    if(v(i)==='function'){i++;if(t[i]?.kind==='word')i++;if(v(i)!=='('||end(i)==null)return null;const params=i;i=end(i)+1;return v(i)==='{'?{params,body:i,finish:end(i),block:true}:null}
    const params=i
    if(v(i)==='('&&end(i)!=null)i=end(i)+1;else if(t[i]?.kind==='word')i++;else return null
    if(v(i)!=='=>')return null;i++
    return{params,body:i,finish:v(i)==='{'?end(i):expressionEnd(i),block:v(i)==='{'}
  }
  for(let i=0;i<t.length;i++){
    if(t[i].depth!==0)continue
    if(v(i)==='import'&&v(i+1)==='{'&&end(i+1)!=null){const close=end(i+1),module=t[close+2];if(v(close+1)==='from'&&module?.kind==='string'
      &&module.value.startsWith('.')&&path.resolve(path.dirname(modulePath),module.value)===path.resolve(evidenceModulePath)){
      for(let j=i+2;j<close;j++)if(v(j)==='attachInventoryEvidence')aliases.add(v(j+1)==='as'?v(j+2):v(j))}}
    if(['const','let','var'].includes(v(i))&&t[i+1]?.kind==='word'&&v(i+2)==='='){const fn=readFunction(i+3);if(fn){const name=v(i+1);if(bindings.has(name))return false;bindings.set(name,{...fn,declarationIndex:i+1,mutable:v(i)!=='const',exported:v(i-1)==='export'})}}
    if(v(i)==='function'&&t[i+1]?.kind==='word'){const fn=readFunction(i);if(fn){const name=v(i+1);if(bindings.has(name))return false;bindings.set(name,{...fn,declarationIndex:i+1,exported:v(i-1)==='export'||v(i-1)==='async'&&v(i-2)==='export'})}}
  }
  if(!aliases.size)return false
  // A local declaration cannot replace the imported metadata-only helper.
  if([...aliases].some(name=>bindings.has(name)))return false
  for(let i=0;i<t.length;i++){
    if(bindings.has(v(i))&&i!==bindings.get(v(i)).declarationIndex
      &&(v(i+1)==='='||['||','&&','?','+','-','*','/'].includes(v(i+1))&&v(i+2)==='='))return false
    if(['{','['].includes(v(i))&&v(end(i)+1)==='='){
      for(let j=i+1;j<end(i);j++)if(bindings.has(v(j)))return false
    }
  }
  function shadowsHelper(fn){
    const parameterEnd=v(fn.params)==='('?end(fn.params)+1:fn.params+1
    for(let i=fn.params;i<parameterEnd;i++)if(aliases.has(v(i)))return true
    for(let i=fn.body+1;i<fn.finish;i++)if(['const','let','var','function'].includes(v(i))){let j=i+1,finish=j+1;if(pairs.has(j))finish=end(j)+1;for(;j<finish;j++)if(aliases.has(v(j)))return true}
    return false
  }
  function returns(fn){
    if(!fn.block)return[[fn.body,fn.finish]]
    const found=[]
    for(let i=fn.body+1;i<fn.finish;i++){
      if(v(i)==='function'){const nested=readFunction(i);if(!nested)return null;i=nested.finish;continue}
      if(v(i)==='=>'&&v(i+1)==='{'){i=end(i+1);continue}
      if(v(i)!=='return')continue
      const start=i+1;if(!t[start]||/[\r\n]/.test(code.slice(t[i].end,t[start].start)))return null
      const finish=expressionEnd(start,fn.finish);found.push([start,finish]);i=finish-1
    }
    return found
  }
  function discoveryStatus(object){
    const finish=end(object);let statuses=0
    for(let i=object+1;i<finish;){
      if(v(i)==='...'||v(i)==='[')return false
      const key=v(i);if(!['word','string'].includes(t[i]?.kind))return false
      // An ordinary shorthand field cannot replace the explicit status key.
      // Unknown/duplicate shorthand status, methods, computed keys and spreads
      // remain inconclusive; only non-status identifier properties are skipped.
      if(v(i+1)!==':'){
        if(t[i]?.kind!=='word'||!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)||key==='status'
          ||!['}',','].includes(v(i+1)))return false
        i+=2;continue
      }
      const start=i+2;let next=start;while(next<finish&&v(next)!==',')next=skip(next)
      if(key==='status'){statuses++;if(t[start]?.kind!=='string'||v(start)!=='discovery-only'||start+1!==next)return false}
      i=next+1
    }
    return statuses===1
  }
  function emptyReturn(start,finish){
    if(v(start)==='await')start++
    if(v(start)==='['&&end(start)===start+1&&start+2===finish)return'empty'
    if(!aliases.has(v(start))||v(start+1)!=='('||end(start+1)!==finish-1)return null
    const array=start+2;if(v(array)!=='['||end(array)!==array+1||v(array+2)!==','||v(array+3)!=='{')return null
    const object=array+3;if(end(object)!==finish-2)return null
    return discoveryStatus(object)?'discovery':null
  }
  function factoryMethod(fn){
    if(fn.block||fn.mutable||shadowsHelper(fn))return null
    let start=fn.body,finish=fn.finish
    while(v(start)==='('&&end(start)===finish-1){start++;finish--}
    if(v(start)!=='{'||end(start)!==finish-1)return null
    let run=null
    for(let i=start+1;i<finish-1;){
      let next=i;while(next<finish-1&&v(next)!==',')next=skip(next)
      if(['...','['].includes(v(i))||['get','set'].includes(v(i))&&v(i+1)==='run')return null
      let at=i;if(v(at)==='async')at++
      if(v(at)==='run'){
        if(run)return null
        if(v(at+1)==='('&&v(end(at+1)+1)==='{')run={params:at+1,body:end(at+1)+1,finish:end(end(at+1)+1),block:true}
        else if(v(at+1)===':')run=readFunction(at+2)
        else return null
        if(!run)return null
      }
      i=next+1
    }
    return run
  }
  function prove(fn,depth=0){
    if(!fn||fn.mutable||depth>3||shadowsHelper(fn))return false
    const exits=returns(fn);if(!exits?.length)return false
    const types=exits.map(([a,b])=>emptyReturn(a,b));if(types.every(Boolean)&&types.includes('discovery'))return true
    if(exits.length!==1)return false
    let [start,finish]=exits[0];if(v(start)==='await')start++
    const factory=bindings.get(v(start));if(!factory||v(start+1)!=='(')return false
    const after=end(start+1)+1
    if(v(after)!=='.'||v(after+1)!=='run'||v(after+2)!=='('||end(after+2)!==finish-1)return false
    return prove(factoryMethod(factory),depth+1)
  }
  const entry=bindings.get('run');return entry?.exported===true&&prove(entry)
}
