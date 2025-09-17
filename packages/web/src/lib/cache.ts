import { getCollection } from './mongo'
import { writeFile, readFile } from 'fs/promises'
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
    
    // Usar a view calFeno que já tem os dados filtrados
    console.log('📊 Usando view calFeno para dados fenológicos...')
    const calFeno = await getCollection('dwc2json', 'calFeno')
    if (!calFeno) {
      throw new Error('View calFeno não disponível')
    }

    // Contar registros fenológicos
    const totalCount = await calFeno.countDocuments()
    console.log(`📊 View calFeno stats: total=${totalCount}`)

    let collection = calFeno

    // A view calFeno já filtra plantas com dados de floração, não precisa de filtro adicional
    const phenoFilter = {}

    // Buscar todas as famílias com dados fenológicos
    const families = await collection.distinct('family', phenoFilter)
    console.log(`🔍 Found ${families.length} families with phenological data:`, families.slice(0, 5))
    const cleanFamilies = families.filter(f => f && f.trim() !== '').sort()

    // Buscar gêneros por família (com dados fenológicos)
    const genera: Record<string, string[]> = {}
    console.log(`🔄 Processando gêneros para ${cleanFamilies.length} famílias...`)
    for (const family of cleanFamilies) {
      const familyGenera = await collection.distinct('genus', { 
        family: family 
      })
      genera[family] = familyGenera.filter(g => g && g.trim() !== '').sort()
    }

    // Buscar espécies por família e gênero (com dados fenológicos)
    const species: Record<string, string[]> = {}
    console.log(`🔄 Processando espécies...`)
    for (const family of cleanFamilies) {
      for (const genus of genera[family] || []) {
        const key = `${family}|${genus}`
        // Tentar primeiro canonicalName, depois scientificName
        let familySpecies = await collection.distinct('canonicalName', { 
          family: family,
          genus: genus
        })
        
        if (familySpecies.length === 0) {
          familySpecies = await collection.distinct('scientificName', { 
            family: family,
            genus: genus
          })
        }
        
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
      console.log('🔄 Cache não encontrado ou desatualizado, gerando novo cache...')
      try {
        cache = await generateCache()
      } catch (cacheError) {
        console.warn('⚠️  Falha ao gerar cache, usando fallback:', cacheError)
        // Fallback para busca direta no MongoDB
        const calFeno = await getCollection('dwc2json', 'calFeno')
        if (!calFeno) {
          console.warn('⚠️  Collection calFeno não disponível')
          return []
        }
        
        const families = await calFeno.distinct('family', { kingdom: 'Plantae' })
        return families.filter(f => f && f.trim() !== '').sort()
      }
    }
    
    return cache.families
  } catch (error) {
    console.error('❌ Erro ao obter famílias em cache:', error)
    return []
  }
}

// Função para obter gêneros de uma família (com cache)
export async function getCachedGenera(family: string): Promise<string[]> {
  try {
    let cache = await loadCache()
    
    if (!cache) {
      try {
        cache = await generateCache()
      } catch (cacheError) {
        console.warn('⚠️  Falha ao gerar cache, usando fallback para gêneros:', cacheError)
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
    
    return cache.genera[family] || []
  } catch (error) {
    console.error('❌ Erro ao obter gêneros em cache:', error)
    return []
  }
}

// Função para obter espécies de uma família e gênero (com cache)
export async function getCachedSpecies(family: string, genus: string): Promise<string[]> {
  try {
    let cache = await loadCache()
    
    if (!cache) {
      try {
        cache = await generateCache()
      } catch (cacheError) {
        console.warn('⚠️  Falha ao gerar cache, usando fallback para espécies:', cacheError)
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
    
    const key = `${family}|${genus}`
    return cache.species[key] || []
  } catch (error) {
    console.error('❌ Erro ao obter espécies em cache:', error)
    return []
  }
}