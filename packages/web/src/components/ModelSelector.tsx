import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue
} from './ui/select'

const availableModels = {
  OpenAI: ['gpt-4.1', 'gpt-4.1-mini'],
  Google: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash']
}

export type Provider = 'openai' | 'google'
export default function ModelSelector({
  availableProviders,
  onModelChange,
  initialModel
}: {
  availableProviders: Array<'openai' | 'google'>
  onModelChange: (model: { provider: Provider; model: string }) => void
  initialModel?:
    | {
        provider: Provider
        model: string
      }
    | undefined
}) {
  return (
    <Select
      onValueChange={(value) => {
        const [provider, model] = value.split(':')
        onModelChange({
          provider: provider as 'openai' | 'google',
          model: model as string
        })
      }}
      defaultValue={
        initialModel
          ? `${initialModel.provider.toLowerCase()}:${initialModel.model}`
          : ''
      }
    >
      <SelectTrigger className="p-1 px-2 text-xs h-auto">
        <SelectValue placeholder="modelo" />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(availableModels)
          .filter(([provider]) =>
            availableProviders.includes(
              provider.toLowerCase() as 'openai' | 'google'
            )
          )
          .map(([provider, models]) => (
            <SelectGroup key={provider}>
              <SelectLabel className="text-normal font-semibold">
                {provider}
              </SelectLabel>
              {models.map((model) => (
                <SelectItem
                  className="text-xs"
                  key={model}
                  value={`${provider.toLowerCase()}:${model}`}
                >
                  {model}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
      </SelectContent>
    </Select>
  )
}
