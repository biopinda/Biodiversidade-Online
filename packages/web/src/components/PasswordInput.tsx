import { EyeIcon, EyeOffIcon } from 'lucide-react'
import { forwardRef, useState } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'

const PasswordInput = forwardRef<
  HTMLInputElement,
  { initialValue?: string; placeholder?: string }
>(({ initialValue, placeholder }, ref) => {
  const [showPassword, setShowPassword] = useState(false)
  return (
    <div className="flex gap-1">
      <Input
        ref={ref}
        defaultValue={initialValue}
        type={showPassword ? 'text' : 'password'}
        autoComplete="existing-password"
        placeholder={placeholder}
      />
      <Button variant="ghost" onClick={() => setShowPassword((prev) => !prev)}>
        {showPassword ? <EyeIcon /> : <EyeOffIcon />}
      </Button>
    </div>
  )
})

export default PasswordInput
