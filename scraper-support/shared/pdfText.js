const normalizePdfWhitespace = (value) => String(value ?? '')
  .replace(/[ \t]+\n/g, '\n')
  .replace(/\n[ \t]+/g, '\n')
  .replace(/[ \t]{2,}/g, ' ')
  .replace(/\n{3,}/g, '\n\n')
  .trim()

const OCR_RENDER_SCALE = 2
const OCR_MAX_PAGES = 2
const OCR_WORKER_COUNT = 2
const DEFAULT_PDF_TEXT_EXTRACTION_TIMEOUT_MS = 30 * 1000
const PDF_TASK_CLEANUP_TIMEOUT_MS = 1000

let ocrWorkerPoolPromise = null
let ocrWorkerCursor = 0

export class PdfTextExtractionTimeoutError extends Error {
  constructor(timeoutMs) {
    super(`PDF text extraction timed out after ${timeoutMs}ms`)
    this.name = 'PdfTextExtractionTimeoutError'
    this.localTimeout = true
    this.failureKind = 'pdf_text_timeout'
  }
}

export const resolvePdfTextExtractionTimeoutMs = (
  value = process.env.PDF_TEXT_EXTRACTION_TIMEOUT_MS,
  fallback = DEFAULT_PDF_TEXT_EXTRACTION_TIMEOUT_MS,
) => {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10)
  if (!Number.isFinite(parsed) || parsed < 0) return fallback
  return parsed
}

const getAbortReason = (signal, fallbackMessage) => (
  signal && 'reason' in signal ? signal.reason : new Error(fallbackMessage)
)

const throwIfAborted = (signal, fallbackMessage = 'PDF text extraction aborted') => {
  if (signal?.aborted) {
    throw getAbortReason(signal, fallbackMessage)
  }
}

const createTimeoutSignal = (timeoutMs) => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return { signal: null, dispose: () => {}, check: () => {} }
  }

  const controller = new AbortController()
  const expiresAt = performance.now() + timeoutMs
  const timeoutId = setTimeout(() => {
    controller.abort(new PdfTextExtractionTimeoutError(timeoutMs))
  }, timeoutMs)

  return {
    signal: controller.signal,
    dispose: () => clearTimeout(timeoutId),
    check: () => {
      if (performance.now() >= expiresAt && !controller.signal.aborted) {
        controller.abort(new PdfTextExtractionTimeoutError(timeoutMs))
      }
      throwIfAborted(controller.signal)
    },
  }
}

const raceWithAbortSignals = async (promise, signals = []) => {
  const activeSignals = signals.filter(Boolean)
  for (const signal of activeSignals) {
    throwIfAborted(signal)
  }

  if (activeSignals.length === 0) return promise

  let settled = false
  const cleanups = []
  const abortPromise = new Promise((_, reject) => {
    for (const signal of activeSignals) {
      const onAbort = () => {
        reject(getAbortReason(signal, 'PDF text extraction aborted'))
      }
      signal.addEventListener('abort', onAbort, { once: true })
      cleanups.push(() => signal.removeEventListener('abort', onAbort))
    }
  })

  try {
    return await Promise.race([
      promise.finally(() => {
        settled = true
      }),
      abortPromise,
    ])
  } finally {
    for (const cleanup of cleanups) cleanup()
    if (!settled) {
      promise.catch(() => {})
    }
  }
}

const toPdfUint8Array = (value) => {
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value)
  }

  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
  }

  return new Uint8Array(value)
}

const getOcrWorkerPool = async (check) => {
  check()
  if (!ocrWorkerPoolPromise) {
    const { createWorker } = await import('tesseract.js')
    check()
    ocrWorkerPoolPromise ??= Promise.all(
      Array.from({ length: OCR_WORKER_COUNT }, () => createWorker('eng')),
    ).then((workers) => ({
      workers,
      queues: workers.map(() => Promise.resolve()),
    }))
  }

  return ocrWorkerPoolPromise
}

const renderPdfPageToPng = async (page, check) => {
  check()
  const { createCanvas } = await import('@napi-rs/canvas')
  check()
  const viewport = page.getViewport({ scale: OCR_RENDER_SCALE })
  const canvas = createCanvas(
    Math.max(1, Math.ceil(viewport.width)),
    Math.max(1, Math.ceil(viewport.height)),
  )
  const context = canvas.getContext('2d')
  await page.render({
    canvasContext: context,
    viewport,
  }).promise
  check()
  return canvas.toBuffer('image/png')
}

const extractTextFromPdfWithOcr = async (pdf, check) => {
  const pageCount = Math.min(pdf.numPages, OCR_MAX_PAGES)
  if (pageCount === 0) return ''

  const pool = await getOcrWorkerPool(check)
  check()
  const pages = []

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    check()
    const page = await pdf.getPage(pageNumber)
    const imageBuffer = await renderPdfPageToPng(page, check)
    check()
    const workerIndex = ocrWorkerCursor % pool.workers.length
    ocrWorkerCursor += 1
    const recognize = () => { check(); return pool.workers[workerIndex].recognize(imageBuffer) }
    const resultPromise = pool.queues[workerIndex].then(recognize, recognize)
    pool.queues[workerIndex] = resultPromise.catch(() => {})
    const result = await resultPromise
    const pageText = normalizePdfWhitespace(result?.data?.text)
    if (pageText) {
      pages.push(pageText)
    }
  }

  return pages.join('\n\n')
}

const destroyPdfTask = async (task) => {
  if (!task) return
  let timer
  try {
    await Promise.race([
      Promise.resolve().then(() => task.destroy()),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(Object.assign(
          new Error('PDF native task cleanup timed out'),
          { name: 'PdfTextExtractionCleanupError', code: 'PDF_TEXT_CLEANUP_TIMEOUT' },
        )), PDF_TASK_CLEANUP_TIMEOUT_MS)
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}

export const extractTextFromPdfBuffer = async (value, {
  signal = null,
  timeoutMs = resolvePdfTextExtractionTimeoutMs(),
} = {}) => {
  throwIfAborted(signal)
  const timeout = createTimeoutSignal(timeoutMs)
  const abortSignals = [signal, timeout.signal]
  const check = () => { throwIfAborted(signal); timeout.check() }
  const wait = async (promise) => {
    check()
    try {
      const result = await raceWithAbortSignals(promise, abortSignals)
      check()
      return result
    } catch (error) {
      check()
      throw error
    }
  }
  let loadingTask
  let result
  let failed = false
  let failure
  try {
    check()
    const pdfData = toPdfUint8Array(value)
    check()
    const { extractPdfTextWorkerCore } = await wait(import('./pdfTextWorkerCore.js'))
    check()
    // The core owns its transport cleanup and uses this same caller deadline.
    // Await its shutdown instead of returning while parser ports are still live.
    const direct = await extractPdfTextWorkerCore(pdfData, { check, wait })
    check()
    if (direct.text) {
      result = direct.text
    } else {
      const extractionPromise = (async () => {
        // Only a fully extracted zero-text document needs the display/OCR runtime.
        // Keep the cached native import error intact for restricted audit callers.
        const { getDocument, VerbosityLevel } = await import('pdfjs-dist/legacy/build/pdf.mjs')
        check()
        loadingTask = getDocument({
          data: pdfData,
          useWorkerFetch: false,
          isEvalSupported: false,
          verbosity: VerbosityLevel.ERRORS,
        })
        check()
        const pdf = await loadingTask.promise
        check()
        return await extractTextFromPdfWithOcr(pdf, check)
      })()
      result = await wait(extractionPromise)
    }
    check()
  } catch (error) {
    failed = true
    failure = error
  } finally {
    try {
      await destroyPdfTask(loadingTask)
    } catch (error) {
      if (!failed) { failed = true; failure = error }
    }
    timeout.dispose()
  }
  // Elapsed synchronous conversion/import/cleanup and caller cancellation take
  // precedence without changing the identity of null, false, '' or frozen errors.
  check()
  if (failed) throw failure
  return result
}
