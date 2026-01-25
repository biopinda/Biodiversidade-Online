import { EyeIcon, EyeOffIcon } from 'lucide-react'
import { forwardRef, useState } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'

interface PasswordInputProps {
  initialValue?: string
  placeholder?: string
  id?: string
  value?: string
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void
}

const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ initialValue, placeholder, id, value, onChange, onKeyDown }, ref) => {
    const [showPassword, setShowPassword] = useState(false)
    return (
      <div className="flex gap-1">
        <Input
          ref={ref}
          id={id}
          defaultValue={initialValue}
          value={value}
          onChange={onChange}
          onKeyDown={onKeyDown}
          type={showPassword ? 'text' : 'password'}
          autoComplete="existing-password"
          placeholder={placeholder}
        />
        <Button
          type="button"
          variant="ghost"
          onClick={() => setShowPassword((prev) => !prev)}
        >
          {showPassword ? <EyeIcon /> : <EyeOffIcon />}
        </Button>
      </div>
    )
  }
)

export default PasswordInput
