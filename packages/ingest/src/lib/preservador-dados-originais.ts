import type { Db, ObjectId } from 'mongodb'
import type {
  DocumentoOriginal,
  TipoColecaoOriginal
} from '../types/documento-original.ts'

type CreatePreservadorOptions = {
  collectionName: string
  collectionType: TipoColecaoOriginal
}

type SalvarDocumentosOptions = {
  pipelineVersion: string
}

type ListarPendentesOptions = {
  iptId?: string
  limit?: number
}

type MarcarComoProcessadosOptions = {
  documentos: Array<{
    _id: ObjectId
    pipelineVersion: string
  }>
}

type ResultadoSalvar = {
  inseridos: number
  atualizados: number
}

type PreservadorDadosOriginais<TDados = Record<string, unknown>> = {
  salvarDocumentos: (
    documentos: DocumentoOriginal<TDados>[],
    options: SalvarDocumentosOptions
  ) => Promise<ResultadoSalvar>
  listarPendentes: (
    options: ListarPendentesOptions
  ) => Promise<DocumentoOriginal<TDados>[]>
  marcarComoProcessados: (
    options: MarcarComoProcessadosOptions
  ) => Promise<void>
}

const notImplemented = (fn: string): Error =>
  new Error(`Função não implementada: preservador.${fn}`)

export async function createPreservadorDadosOriginais<
  TDados = Record<string, unknown>
>(
  _db: Db,
  _options: CreatePreservadorOptions
): Promise<PreservadorDadosOriginais<TDados>> {
  return {
    async salvarDocumentos(): Promise<ResultadoSalvar> {
      throw notImplemented('salvarDocumentos')
    },
    async listarPendentes(): Promise<DocumentoOriginal<TDados>[]> {
      throw notImplemented('listarPendentes')
    },
    async marcarComoProcessados(): Promise<void> {
      throw notImplemented('marcarComoProcessados')
    }
  }
}

export type {
  CreatePreservadorOptions,
  ListarPendentesOptions,
  MarcarComoProcessadosOptions,
  PreservadorDadosOriginais,
  ResultadoSalvar,
  SalvarDocumentosOptions
}
