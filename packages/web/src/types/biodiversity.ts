/**
 * Biodiversity Data Types
 * Defines core entities for the Biodiversidade.Online platform
 */

export interface Taxa {
  _id: string
  scientificName: string
  kingdom?: string
  phylum?: string
  class?: string
  order?: string
  family?: string
  genus?: string
  species?: string
  threatStatus?: 'threatened' | 'near-threatened' | 'least-concern' | 'unknown'
  invasiveStatus?: 'invasive' | 'native' | 'unknown'
  conservationUnitAssociations?: string[]
  lastUpdated: Date
  dataSource?: string
}

export interface Occurrence {
  _id: string
  taxonID?: string
  scientificName?: string
  decimalLatitude: number
  decimalLongitude: number
  eventDate?: string
  basisOfRecord?: string
  country?: string
  stateProvince?: string
  county?: string
  municipality?: string
  threatStatus?: string
  invasiveStatus?: string
  conservationUnit?: string
  lastUpdated: Date
  dataSource?: string
}

export interface ThreatStatus {
  _id: string
  taxonID: string
  scientificName: string
  threatLevel: 'extinct' | 'critically-endangered' | 'endangered' | 'vulnerable' | 'near-threatened' | 'least-concern'
  protectionStatus?: string
  recoveryStatus?: string
  assessmentDate?: Date
  source: string
}

export interface InvasiveStatus {
  _id: string
  taxonID: string
  scientificName: string
  geographicOrigin?: string
  ecosystemImpact?: string
  invasivenessLevel?: 'high' | 'medium' | 'low'
  source: string
  assessmentDate?: Date
}

export interface ConservationUnit {
  _id: string
  name: string
  designationType: string
  managementStatus?: string
  geometry?: GeoJSON.Geometry
  area?: number
  jurisdictionCode?: string
  managingAgency?: string
  lastUpdated: Date
}

export interface DashboardSummary {
  totalSpecies: number
  threatenedCount: number
  invasiveCount: number
  totalOccurrences: number
  lastUpdated: Date
}

export interface MCPQuery {
  type: 'taxa' | 'occurrences' | 'statistics' | 'spatial'
  params: Record<string, unknown>
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  dataSources?: string[]
  timestamp: Date
}

export interface ChatSession {
  _id: string
  userId?: string
  messages: ChatMessage[]
  createdAt: Date
  updatedAt: Date
  expiresAt: Date
}

export interface PaginationParams {
  limit: number
  offset: number
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  limit: number
  offset: number
}
