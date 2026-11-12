// Observe genuine standard objects. Never substitute a reader or its result.
const Stream = globalThis.ReadableStream
const Reader = globalThis.ReadableStreamDefaultReader
const ResponseConstructor = globalThis.Response
const originals = Object.freeze({ getReader: Stream.prototype.getReader,
  read: Reader.prototype.read, cancel: Reader.prototype.cancel, releaseLock: Reader.prototype.releaseLock })
export const nativeReferences = Object.freeze({ Stream, Reader, ResponseConstructor, ...originals })

export function observeNativeStream(stream) {
  if (!(stream instanceof Stream)) throw Error('Observer requires an actual ReadableStream')
  const records = [], acquired = []
  Object.defineProperty(stream, 'getReader', { configurable: true, value: function (...args) {
    records.push({ operation: 'getReader', receiverExact: this === stream, argc: args.length, args })
    const reader = Reflect.apply(originals.getReader, this, args)
    if (!(reader instanceof Reader)) throw Error('Native getReader must return its actual standard reader')
    acquired.push(reader)
    for (const name of ['read', 'cancel', 'releaseLock']) Object.defineProperty(reader, name, {
      configurable: true, value: function (...methodArgs) {
        records.push({ operation: name, receiverExact: this === reader, argc: methodArgs.length, args: methodArgs })
        return Reflect.apply(originals[name], this, methodArgs)
      },
    })
    return reader
  } })
  return { stream, records, acquired,
    summary: () => ({ nativeStream: stream instanceof Stream, nativeReaders: acquired.every(reader => reader instanceof Reader),
      locked: stream.locked, calls: records.map(record => ({ operation: record.operation,
        receiverExact: record.receiverExact, argc: record.argc, noReasonArgument: record.args.length === 0 })) }),
  }
}

export function assertNativeReferencesUnchanged(assert) {
  assert.equal(globalThis.ReadableStream, Stream)
  assert.equal(globalThis.ReadableStreamDefaultReader, Reader)
  assert.equal(globalThis.Response, ResponseConstructor)
  assert.equal(Stream.prototype.getReader, originals.getReader)
  for (const name of ['read', 'cancel', 'releaseLock']) assert.equal(Reader.prototype[name], originals[name])
}
