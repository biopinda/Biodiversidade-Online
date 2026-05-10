'use client'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { Label } from '@/components/ui/label'
import { validatePasswordStrength } from '@/lib/crypto'
import { useState } from 'react'
import PasswordInput from './PasswordInput'

interface EncryptionPasswordDialogProps {
  open: boolean
  onPasswordSet: (password: string) => void
  isFirstTime?: boolean
}

export default function EncryptionPasswordDialog({
  open,
  onPasswordSet,
  isFirstTime = true
}: EncryptionPasswordDialogProps) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = () => {
    setError('')

    if (isFirstTime) {
      if (password !== confirmPassword) {
        setError('As senhas não coincidem')
        return
      }

      const validation = validatePasswordStrength(password)
      if (!validation.valid) {
        setError(validation.message)
        return
      }
    }

    onPasswordSet(password)
    setPassword('')
    setConfirmPassword('')
  }

  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isFirstTime
              ? 'Proteja suas API Keys'
              : 'Digite sua senha de criptografia'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isFirstTime
              ? 'Crie uma senha forte para criptografar suas API Keys. Esta senha será necessária sempre que você acessar o chat.'
              : 'Digite a senha para descriptografar suas API Keys armazenadas.'}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex flex-col gap-4 py-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="encryption-password">
              {isFirstTime ? 'Nova senha' : 'Senha'}
            </Label>
            <PasswordInput
              id="encryption-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={
                isFirstTime ? 'Mínimo 8 caracteres' : 'Digite sua senha'
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (!isFirstTime || confirmPassword)) {
                  handleSubmit()
                }
              }}
            />
          </div>

          {isFirstTime && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="encryption-password-confirm">
                Confirmar senha
              </Label>
              <PasswordInput
                id="encryption-password-confirm"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Digite a senha novamente"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && password && confirmPassword) {
                    handleSubmit()
                  }
                }}
              />
            </div>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}

          {isFirstTime && (
            <div className="rounded-md bg-yellow-50 p-3 text-sm text-yellow-800">
              <strong>Atenção:</strong> Não é possível recuperar esta senha. Se
              você esquecer, terá que reconfigurar suas API Keys.
            </div>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogAction
            onClick={handleSubmit}
            disabled={!password || (isFirstTime && !confirmPassword)}
          >
            {isFirstTime ? 'Criar senha' : 'Desbloquear'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
