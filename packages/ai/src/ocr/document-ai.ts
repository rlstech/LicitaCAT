import { DocumentProcessorServiceClient } from '@google-cloud/documentai'

const PROJECT_ID = process.env['GOOGLE_DOCUMENT_AI_PROJECT_ID']
const PROCESSOR_ID = process.env['GOOGLE_DOCUMENT_AI_PROCESSOR_ID']
const LOCATION = 'us'

const COST_PER_PAGE_USD = 0.0015 // $1.50 per 1000 pages (Form Parser pricing)

export interface OcrResult {
  text: string
  pageCount: number
  pdfType: 'copyable' | 'scanned' | 'mixed'
  costUsd: number
}

export interface FormParserResult {
  text: string          // raw text from document
  formattedText: string // text with tables formatted as markdown
  pageCount: number
  costUsd: number
}

function getClient(): DocumentProcessorServiceClient {
  return new DocumentProcessorServiceClient()
}

function getProcessorName(): string {
  if (!PROJECT_ID || !PROCESSOR_ID) {
    throw new Error(
      'GOOGLE_DOCUMENT_AI_PROJECT_ID and GOOGLE_DOCUMENT_AI_PROCESSOR_ID are required',
    )
  }
  return `projects/${PROJECT_ID}/locations/${LOCATION}/processors/${PROCESSOR_ID}`
}

function getTextFromAnchor(
  fullText: string,
  textAnchor: { textSegments?: Array<{ startIndex?: unknown; endIndex?: unknown }> } | null | undefined,
): string {
  if (!textAnchor?.textSegments?.length) return ''
  return textAnchor.textSegments
    .map((seg) => {
      const start = Number(seg.startIndex ?? 0)
      const end = Number(seg.endIndex ?? 0)
      return fullText.slice(start, end)
    })
    .join('')
}

export async function processDocumentOcr(
  fileBuffer: Buffer,
  mimeType: 'application/pdf',
): Promise<OcrResult> {
  const client = getClient()
  const processorName = getProcessorName()

  const [result] = await client.processDocument({
    name: processorName,
    rawDocument: {
      content: fileBuffer.toString('base64'),
      mimeType,
    },
  })

  const document = result.document
  if (!document) {
    throw new Error('Document AI returned no document')
  }

  const text = document.text ?? ''
  const pageCount = document.pages?.length ?? 0

  // Heuristic to detect PDF type
  const hasOcrText = document.pages?.some((page) =>
    page.blocks?.some((block) => block.layout?.textAnchor?.textSegments?.length),
  )
  const hasNativeText = text.length > 0 && !hasOcrText

  let pdfType: OcrResult['pdfType']
  if (hasNativeText && hasOcrText) {
    pdfType = 'mixed'
  } else if (hasOcrText) {
    pdfType = 'scanned'
  } else {
    pdfType = 'copyable'
  }

  const costUsd = pageCount * COST_PER_PAGE_USD

  return { text, pageCount, pdfType, costUsd }
}

export async function processDocumentFormParser(
  fileBuffer: Buffer,
  mimeType: 'application/pdf',
): Promise<FormParserResult> {
  const client = getClient()
  const processorName = getProcessorName()

  const [result] = await client.processDocument({
    name: processorName,
    rawDocument: {
      content: fileBuffer.toString('base64'),
      mimeType,
    },
  })

  const document = result.document
  if (!document) throw new Error('Document AI returned no document')

  const fullText = document.text ?? ''
  const pageCount = document.pages?.length ?? 0
  const costUsd = pageCount * COST_PER_PAGE_USD

  const sections: string[] = []

  for (const page of document.pages ?? []) {
    // Form fields (key-value pairs)
    for (const field of page.formFields ?? []) {
      const name = getTextFromAnchor(fullText, field.fieldName?.textAnchor).trim()
      const value = getTextFromAnchor(fullText, field.fieldValue?.textAnchor).trim()
      if (name && value) {
        sections.push(`${name}: ${value}`)
      }
    }

    // Tables formatted as markdown
    for (const table of page.tables ?? []) {
      const rows: string[][] = []

      for (const row of table.headerRows ?? []) {
        const cells = (row.cells ?? []).map((cell) =>
          getTextFromAnchor(fullText, cell.layout?.textAnchor).trim().replace(/\n/g, ' '),
        )
        rows.push(cells)
      }

      for (const row of table.bodyRows ?? []) {
        const cells = (row.cells ?? []).map((cell) =>
          getTextFromAnchor(fullText, cell.layout?.textAnchor).trim().replace(/\n/g, ' '),
        )
        rows.push(cells)
      }

      if (rows.length > 0) {
        const maxCols = Math.max(...rows.map((r) => r.length))
        const tableLines: string[] = []
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i]!
          while (row.length < maxCols) row.push('')
          tableLines.push('| ' + row.join(' | ') + ' |')
          if (i === 0) {
            tableLines.push('|' + Array(maxCols).fill('---').join('|') + '|')
          }
        }
        sections.push(tableLines.join('\n'))
      }
    }
  }

  // Use structured sections if found, otherwise fall back to raw text
  const formattedText = sections.length > 0 ? sections.join('\n\n') : fullText

  return { text: fullText, formattedText, pageCount, costUsd }
}
