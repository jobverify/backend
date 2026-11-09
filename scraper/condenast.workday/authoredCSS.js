import {need} from './nativeModels.js'

// Finite, source-scoped expansion of the reviewed stylesheet's native CSS
// nesting. Conditional rules remain conservative: every possibly applicable
// hiding rule is retained. No stylesheet or publisher program is executed.
export function expandReviewedCSS(css){
 need(typeof css==='string'&&css.length<=1000000,'authored CSS bound');css=css.replace(/\/\*[\s\S]*?\*\//g,'');const rules=[],animations=[]
 function split(value){const result=[];let start=0,quote='',depth=0;for(let i=0;i<value.length;i++){const c=value[i];if(c==='\\'){i++;continue}if(quote){if(c===quote)quote='';continue}if(c==='"'||c==="'")quote=c;else if(c==='('||c==='[')depth++;else if(c===')'||c===']')depth--;else if(c===','&&depth===0){result.push(value.slice(start,i).trim());start=i+1}}need(!quote&&depth===0,'unreadable authored selector');result.push(value.slice(start).trim());need(result.every(Boolean),'empty authored selector');return result}
 function closing(text,start){let depth=1,quote='';for(let i=start;i<text.length;i++){const c=text[i];if(c==='\\'){i++;continue}if(quote){if(c===quote)quote='';continue}if(c==='"'||c==="'")quote=c;else if(c==='{')depth++;else if(c==='}'&&--depth===0)return i}need(false,'unclosed authored CSS block')}
 function scope(text,parents=[],depth=0){need(depth<=20&&rules.length<=10000,'authored CSS nesting/rule bound');const declarations=[];let start=0,quote='',paren=0
  for(let i=0;i<text.length;i++){const c=text[i];if(c==='\\'){i++;continue}if(quote){if(c===quote)quote='';continue}if(c==='"'||c==="'"){quote=c;continue}if(c==='('||c==='['){paren++;continue}if(c===')'||c===']'){paren--;need(paren>=0,'authored CSS delimiter');continue}if(paren)continue
   if(c===';'){const declaration=text.slice(start,i).trim();if(declaration)declarations.push(declaration);start=i+1}
   else if(c==='{'){const head=text.slice(start,i).trim(),end=closing(text,i+1),body=text.slice(i+1,end);need(head,'missing authored CSS selector');if(/^@(?:media|supports|layer|container)\b/.test(head))scope(body,parents,depth+1);else if(/^@(?:-\w+-)?keyframes\b/.test(head)){animations.push({declaration:head,body})}else if(/^@font-face\b/.test(head)){need(!/(?:opacity|visibility|content-visibility)\s*:/i.test(body),'unreviewed authored font visibility')}else{need(!head.startsWith('@'),'unreviewed authored at-rule');const children=split(head),selectors=parents.length?parents.flatMap(parent=>children.map(child=>child.includes('&')?child.replaceAll('&',parent):parent+' '+child)):children;need(parents.length||selectors.every(s=>!s.includes('&')),'unbound authored nesting selector');scope(body,selectors,depth+1)}i=end;start=end+1}
  }
  need(!quote&&paren===0,'unreadable authored CSS declaration');const tail=text.slice(start).trim();if(tail)declarations.push(tail);if(parents.length&&declarations.length)rules.push({selectors:parents,declarations:declarations.join(';')});else need(declarations.every(d=>/^@(?:charset|import|layer)\b/.test(d)),'unbound authored CSS declarations')
 }
 scope(css);const uncertainAnimations=animations.some(a=>/(?:opacity|display|visibility|content-visibility)\s*:/i.test(a.body));return{css:rules.map(r=>r.selectors.join(',')+'{'+r.declarations+(uncertainAnimations&&/(?:^|;)\s*(?:-\w+-)?animation(?:-name)?\s*:(?!\s*none\s*(?:;|$))/i.test(r.declarations)?';opacity:0':'')+'}').join('\n'),rules,animations}
}
