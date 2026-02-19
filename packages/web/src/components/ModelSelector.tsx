import { CogIcon } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import PasswordInput from './PasswordInput'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from './ui/select'

export type Provider = 'openai' | 'anthropic' | 'google'

export interface ChatConfig {
  provider: Provider
  apiKey: string
  model: string
  modelDisplayName: string
}

interface ModelOption {
  id: string
  displayName: string
}

const STORAGE_KEY = 'chatConfig'

const providerLabels: Record<Provider, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google Gemini'
}

const providerKeyUrls: Record<Provider, string> = {
  openai: 'https://platform.openai.com/api-keys',
  anthropic: 'https://console.anthropic.com/settings/keys',
  google: 'https://aistudio.google.com/app/apikey'
}

export default function ModelSelector({
  onChange
}: {
  onChange: (config: ChatConfig | null) => void
}) {
  const [loaded, setLoaded] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)

  const [storedKeys, setStoredKeys] = useState<Record<string, string>>({})

  const [provider, setProvider] = useState<Provider | ''>('')
  const [apiKey, setApiKey] = useState('')
  const [models, setModels] = useState<ModelOption[]>([])
  const [selectedModelId, setSelectedModelId] = useState('')
  const [selectedModelName, setSelectedModelName] = useState('')

  const [isLoadingModels, setIsLoadingModels] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [config, setConfig] = useState<ChatConfig | null>(null)

  const saveConfig = useCallback(
    (cfg: ChatConfig, keys: Record<string, string>) => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ...cfg, apiKeys: keys })
      )
    },
    []
  )

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed.provider && parsed.apiKey && parsed.model) {
          const cfg: ChatConfig = {
            provider: parsed.provider,
            apiKey: parsed.apiKey,
            model: parsed.model,
            modelDisplayName: parsed.modelDisplayName || parsed.model
          }
          setConfig(cfg)
          setProvider(cfg.provider)
          setApiKey(cfg.apiKey)
          setSelectedModelId(cfg.model)
          setSelectedModelName(cfg.modelDisplayName)
          setStoredKeys(parsed.apiKeys || { [cfg.provider]: cfg.apiKey })
          onChange(cfg)
        }
      }
    } catch {
      /* ignore corrupt storage */
    }
    setLoaded(true)
  }, [])

  const handleProviderChange = (value: string) => {
    const p = value as Provider
    setProvider(p)
    setApiKey(storedKeys[p] || '')
    setModels([])
    setSelectedModelId('')
    setError(null)
  }

  const handleLoadModels = async () => {
    if (!provider || apiKey.length < 10) return

    setIsLoadingModels(true)
    setError(null)
    setModels([])
    setSelectedModelId('')

    try {
      const res = await fetch('/api/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, apiKey })
      })
      const body = await res.json()

      if (!body.success) {
        setError(body.error || 'Erro ao carregar modelos')
        return
      }

      setModels(body.models || [])
      const newKeys = { ...storedKeys, [provider]: apiKey }
      setStoredKeys(newKeys)
    } catch {
      setError('Erro de conexão ao carregar modelos')
    } finally {
      setIsLoadingModels(false)
    }
  }

  const handleModelSelect = (modelId: string) => {
    const model = models.find((m) => m.id === modelId)
    if (!model || !provider) return

    setSelectedModelId(modelId)
    setSelectedModelName(model.displayName)

    const cfg: ChatConfig = {
      provider,
      apiKey,
      model: modelId,
      modelDisplayName: model.displayName
    }
    const newKeys = { ...storedKeys, [provider]: apiKey }
    setConfig(cfg)
    setIsExpanded(false)
    saveConfig(cfg, newKeys)
    onChange(cfg)
  }

  const handleEdit = () => {
    setIsExpanded(true)
    onChange(null)
  }

  if (!loaded) return null

  if (config && !isExpanded) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-xs">
          {providerLabels[config.provider]} · {config.modelDisplayName}
        </Badge>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-6 w-6"
          onClick={handleEdit}
          aria-label="Alterar configuração de IA"
          title="Alterar configuração de IA"
        >
          <CogIcon className="h-3 w-3" />
        </Button>
      </div>
    )
  }

  const canLoadModels = !!provider && apiKey.length >= 10 && !isLoadingModels

  return (
    <div className="flex flex-col gap-3 rounded-md border border-slate-300 p-3">
      <div className="text-sm font-medium">Configuração da IA</div>

      <Select value={provider} onValueChange={handleProviderChange}>
        <SelectTrigger className="h-auto p-1 px-2 text-xs">
          <SelectValue placeholder="Selecione o provedor..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="openai">OpenAI</SelectItem>
          <SelectItem value="anthropic">Anthropic</SelectItem>
          <SelectItem value="google">Google Gemini</SelectItem>
        </SelectContent>
      </Select>

      {provider && (
        <>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            Obtenha uma chave em{' '}
            <a
              href={providerKeyUrls[provider]}
              target="_blank"
              rel="noopener noreferrer"
              className="text-black hover:underline"
            >
              {new URL(providerKeyUrls[provider]).hostname}
            </a>
          </div>
          <PasswordInput
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value)
              setModels([])
              setSelectedModelId('')
              setError(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canLoadModels) {
                e.preventDefault()
                handleLoadModels()
              }
            }}
            placeholder="Digite sua chave de API..."
          />
        </>
      )}

      <Button
        type="button"
        size="sm"
        disabled={!canLoadModels}
        onClick={handleLoadModels}
        className="self-start"
      >
        {isLoadingModels ? 'Carregando...' : 'Carregar Modelos'}
      </Button>

      {error && <div className="text-xs text-red-600">{error}</div>}

      {models.length > 0 && (
        <Select value={selectedModelId} onValueChange={handleModelSelect}>
          <SelectTrigger className="h-auto p-1 px-2 text-xs">
            <SelectValue placeholder="Selecione o modelo..." />
          </SelectTrigger>
          <SelectContent>
            {models.map((model) => (
              <SelectItem key={model.id} value={model.id} className="text-xs">
                {model.displayName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {config && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="self-start"
          onClick={() => {
            setIsExpanded(false)
            onChange(config)
          }}
        >
          Cancelar
        </Button>
      )}
    </div>
  )
}
