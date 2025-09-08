import { getCollection } from './mongo'
import { writeFile, readFile, stat } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'

export interface TaxonomicCache {
  families: string[]
  genera: Record<string, string[]>
  species: Record<string, string[]>
  lastUpdated: string
}

const CACHE_FILE = join(process.cwd(), 'src', 'data', 'phenological-cache.json')

// Função para verificar se o cache precisa ser atualizado (segundas-feiras)
function shouldUpdateCache(lastUpdated: string): boolean {
  const now = new Date()
  const lastUpdate = new Date(lastUpdated)
  
  // Verifica se é segunda-feira (getDay() === 1)
  const isMonday = now.getDay() === 1
  
  // Verifica se já passou uma semana desde a última atualização
  const weekInMs = 7 * 24 * 60 * 60 * 1000
  const weekPassed = (now.getTime() - lastUpdate.getTime()) > weekInMs
  
  return isMonday && weekPassed
}

// Função para carregar o cache do arquivo
export async function loadCache(): Promise<TaxonomicCache | null> {
  try {
    if (!existsSync(CACHE_FILE)) {
      return null
    }
    
    const cacheData = await readFile(CACHE_FILE, 'utf-8')
    const cache: TaxonomicCache = JSON.parse(cacheData)
    
    // Verifica se o cache precisa ser atualizado
    if (shouldUpdateCache(cache.lastUpdated)) {
      console.log('📅 Cache precisa ser atualizado - é segunda-feira')
      return null
    }
    
    return cache
  } catch (error) {
    console.error('❌ Erro ao carregar cache:', error)
    return null
  }
}

// Função para gerar e salvar o cache
export async function generateCache(): Promise<TaxonomicCache> {
  try {
    console.log('🔄 Gerando cache taxonomico para calendario fenológico...')
    
    const calFeno = await getCollection('dwc2json', 'calFeno')
    if (!calFeno) {
      throw new Error('Collection calFeno não disponível')
    }

    // Buscar todas as famílias
    const families = await calFeno.distinct('family', { kingdom: 'Plantae' })
    const cleanFamilies = families.filter(f => f && f.trim() !== '').sort()

    // Buscar gêneros por família
    const genera: Record<string, string[]> = {}
    for (const family of cleanFamilies) {
      const familyGenera = await calFeno.distinct('genus', { 
        kingdom: 'Plantae', 
        family: family 
      })
      genera[family] = familyGenera.filter(g => g && g.trim() !== '').sort()
    }

    // Buscar espécies por família e gênero
    const species: Record<string, string[]> = {}
    for (const family of cleanFamilies) {
      for (const genus of genera[family] || []) {
        const key = `${family}|${genus}`
        const familySpecies = await calFeno.distinct('canonicalName', { 
          kingdom: 'Plantae', 
          family: family,
          genus: genus
        })
        species[key] = familySpecies.filter(s => s && s.trim() !== '').sort()
      }
    }

    const cache: TaxonomicCache = {
      families: cleanFamilies,
      genera,
      species,
      lastUpdated: new Date().toISOString()
    }

    // Criar diretório se não existir
    const fs = await import('fs')
    const cacheDir = join(process.cwd(), 'src', 'data')
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true })
    }

    // Salvar cache
    await writeFile(CACHE_FILE, JSON.stringify(cache, null, 2))
    console.log('✅ Cache taxonomico salvo com sucesso')
    
    return cache
  } catch (error) {
    console.error('❌ Erro ao gerar cache:', error)
    throw error
  }
}

// Função para obter famílias (com cache)
export async function getCachedFamilies(): Promise<string[]> {
  try {
    let cache = await loadCache()
    
    if (!cache) {
      cache = await generateCache()
    }
    
    return cache.families
  } catch (error) {
    console.error('❌ Erro ao obter famílias em cache:', error)
    // Fallback para busca direta no MongoDB
    const calFeno = await getCollection('dwc2json', 'calFeno')
    if (!calFeno) return []
    
    const families = await calFeno.distinct('family', { kingdom: 'Plantae' })
    return families.filter(f => f && f.trim() !== '').sort()
  }
}

// Função para obter gêneros de uma família (com cache)
export async function getCachedGenera(family: string): Promise<string[]> {
  try {
    let cache = await loadCache()
    
    if (!cache) {
      cache = await generateCache()
    }
    
    return cache.genera[family] || []
  } catch (error) {
    console.error('❌ Erro ao obter gêneros em cache:', error)
    // Fallback para busca direta no MongoDB
    const calFeno = await getCollection('dwc2json', 'calFeno')
    if (!calFeno) return []
    
    const genera = await calFeno.distinct('genus', { 
      kingdom: 'Plantae', 
      family: family 
    })
    return genera.filter(g => g && g.trim() !== '').sort()
  }
}

// Função para obter espécies de uma família e gênero (com cache)
export async function getCachedSpecies(family: string, genus: string): Promise<string[]> {
  try {
    let cache = await loadCache()
    
    if (!cache) {
      cache = await generateCache()
    }
    
    const key = `${family}|${genus}`
    return cache.species[key] || []
  } catch (error) {
    console.error('❌ Erro ao obter espécies em cache:', error)
    // Fallback para busca direta no MongoDB
    const calFeno = await getCollection('dwc2json', 'calFeno')
    if (!calFeno) return []
    
    const species = await calFeno.distinct('canonicalName', { 
      kingdom: 'Plantae', 
      family: family,
      genus: genus
    })
    return species.filter(s => s && s.trim() !== '').sort()
  }
}