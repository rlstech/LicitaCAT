export type Conselho = 'CREA' | 'CAU'

export type CatFileType = 'pdf_scanned' | 'pdf_copyable' | 'excel' | 'manual'

export type CatExtractionStatus =
  | 'pending'
  | 'processing'
  | 'review_pending'
  | 'completed'
  | 'error'

export type CatItemOrigem = 'ai_extracted' | 'human_added' | 'excel_imported'

export interface ProfissionalTecnico {
  id: string
  tenantId: string
  nome: string
  numeroCreaCau: string
  conselho: Conselho
  ufRegistro: string
  ativo: boolean
  createdAt: Date
  updatedAt: Date
}

export interface Cat {
  id: string
  tenantId: string
  profissionalId: string
  uploadedBy: string
  fileName: string
  fileUrl: string
  fileType: CatFileType
  numeroCat: string | null
  empresaContratante: string | null
  tipoObraServico: string | null
  descricaoTecnica: string | null
  quantitativoValor: number | null
  quantitativoUnidade: string | null
  dataInicio: Date | null
  dataConclusao: Date | null
  statusExtracao: CatExtractionStatus
  aiConfidenceScore: number | null
  ativo: boolean
  createdAt: Date
  updatedAt: Date
}

export interface CatItem {
  id: string
  tenantId: string
  catId: string
  numeroItem: number | null
  descricao: string
  unidade: string | null
  quantidade: number | null
  origem: CatItemOrigem
  aiConfidenceScore: number | null
  ordem: number
  createdAt: Date
  updatedAt: Date
}
