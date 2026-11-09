// Read the retained Nuxt serializer's literal-only IIFE. Never execute source JS.
export function decodeNuxt(source) {
  if (typeof source !== 'string' || Buffer.byteLength(source) > 2 * 1024 * 1024) throw Error('Nuxt size bound');
  let at = 0, nodes = 0;
  const fail = () => { throw Error('Unsupported Nuxt literal syntax at ' + at); };
  const ws = () => { while (at < source.length && /\s/.test(source[at])) at++; };
  const token = value => { ws(); if (!source.startsWith(value, at)) fail(); at += value.length; };
  const peek = value => { ws(); return source.startsWith(value, at); };
  const identifier = () => { ws(); const match = /^[A-Za-z_$][\w$]*/.exec(source.slice(at)); if (!match) fail(); at += match[0].length; return match[0]; };
  const string = () => {
    ws(); const start = at; if (source[at++] !== '"') fail();
    let closed = false;
    while (at < source.length) {
      const char = source[at++];
      if (char === '\\') { if (at === source.length) fail(); at++; }
      else if (char === '"') { closed = true; break; }
    }
    if (!closed) fail();
    try { return JSON.parse(source.slice(start, at)); } catch { fail(); }
  };
  const value = (allowReference, depth = 0) => {
    ws(); if (++nodes > 50000 || depth > 64) fail();
    if (peek('"')) return { kind: 'literal', value: string() };
    if (peek('{')) {
      token('{'); const entries = [], seen = new Set();
      while (!peek('}')) {
        const key = peek('"') ? string() : identifier();
        if (seen.has(key) || ['__proto__', 'constructor', 'prototype'].includes(key)) fail();
        seen.add(key); token(':'); entries.push([key, value(allowReference, depth + 1)]);
        if (peek('}')) break; token(','); if (peek('}')) fail();
      }
      token('}'); return { kind: 'object', entries };
    }
    if (peek('[')) {
      token('['); const entries = [];
      while (!peek(']')) { entries.push(value(allowReference, depth + 1)); if (peek(']')) break; token(','); if (peek(']')) fail(); }
      token(']'); return { kind: 'array', entries };
    }
    const number = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(source.slice(at));
    if (number) { at += number[0].length; const result = Number(number[0]); if (!Number.isFinite(result)) fail(); return { kind: 'literal', value: result }; }
    const name = identifier();
    if (name === 'true' || name === 'false' || name === 'null') return { kind: 'literal', value: name === 'null' ? null : name === 'true' };
    if (!allowReference) fail();
    return { kind: 'reference', name };
  };
  if (identifier() !== 'window') fail(); token('.'); if (identifier() !== '__NUXT__') fail();
  token('='); token('('); if (identifier() !== 'function') fail(); token('(');
  const parameters = [];
  const reserved = new Set('await break case catch class const continue debugger default delete do else enum export extends false finally for function if import in instanceof new null return super switch this throw true try typeof var void while with yield let static implements interface package private protected public'.split(' '));
  while (!peek(')')) { const name = identifier(); if (reserved.has(name) || parameters.includes(name) || parameters.length >= 64) fail(); parameters.push(name); if (peek(')')) break; token(','); }
  token(')'); token('{'); if (identifier() !== 'return') fail();
  const root = value(true); token('}'); token('(');
  const argumentsList = [];
  while (!peek(')')) { argumentsList.push(value(false)); if (peek(')')) break; token(','); }
  token(')'); token(')'); token(';'); ws(); if (at !== source.length || argumentsList.length !== parameters.length) fail();
  const environment = Object.create(null);
  const resolve = (node, depth = 0) => {
    if (depth > 64) fail();
    if (node.kind === 'literal') return node.value;
    if (node.kind === 'reference') { if (!Object.hasOwn(environment, node.name)) fail(); return environment[node.name]; }
    if (node.kind === 'array') return node.entries.map(item => resolve(item, depth + 1));
    const result = Object.create(null);
    for (const [key, item] of node.entries) result[key] = resolve(item, depth + 1);
    return result;
  };
  parameters.forEach((name, index) => { environment[name] = resolve(argumentsList[index]); });
  return resolve(root);
}
