/**
 * Criptografia segura para armazenamento de API Keys
 *
 * Utiliza Web Crypto API para derivação de chave via PBKDF2 e criptografia AES-GCM.
 * Implementado como parte da mitigação de vulnerabilidade crítica de exposição de API Keys.
 */

const ALGORITHM = 'AES-GCM'
const KEY_LENGTH = 256
const ITERATIONS = 100000
const SALT_LENGTH = 16
const IV_LENGTH = 12

interface EncryptedData {
  ciphertext: string
  iv: string
  salt: string
}

/**
 * Deriva uma chave criptográfica a partir de uma senha usando PBKDF2
 */
async function deriveKey(
  password: string,
  salt: BufferSource
): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  )

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: ITERATIONS,
      hash: 'SHA-256'
    },
    passwordKey,
    {
      name: ALGORITHM,
      length: KEY_LENGTH
    },
    false,
    ['encrypt', 'decrypt']
  )
}

/**
 * Criptografa dados usando AES-GCM
 */
export async function encrypt(
  plaintext: string,
  password: string
): Promise<string> {
  const encoder = new TextEncoder()
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH))
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))

  const key = await deriveKey(password, salt)

  const ciphertext = await crypto.subtle.encrypt(
    {
      name: ALGORITHM,
      iv
    },
    key,
    encoder.encode(plaintext)
  )

  const encryptedData: EncryptedData = {
    ciphertext: arrayBufferToBase64(ciphertext),
    iv: arrayBufferToBase64(iv),
    salt: arrayBufferToBase64(salt)
  }

  return JSON.stringify(encryptedData)
}

/**
 * Descriptografa dados previamente criptografados com encrypt()
 */
export async function decrypt(
  encryptedString: string,
  password: string
): Promise<string> {
  try {
    const encryptedData: EncryptedData = JSON.parse(encryptedString)

    const salt = base64ToArrayBuffer(encryptedData.salt)
    const iv = base64ToArrayBuffer(encryptedData.iv)
    const ciphertext = base64ToArrayBuffer(encryptedData.ciphertext)

    const key = await deriveKey(password, new Uint8Array(salt))

    const plaintext = await crypto.subtle.decrypt(
      {
        name: ALGORITHM,
        iv: new Uint8Array(iv)
      },
      key,
      ciphertext
    )

    const decoder = new TextDecoder()
    return decoder.decode(plaintext)
  } catch (error) {
    throw new Error(
      'Falha ao descriptografar: senha incorreta ou dados corrompidos'
    )
  }
}

/**
 * Converte ArrayBuffer ou Uint8Array para Base64
 */
function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!)
  }
  return btoa(binary)
}

/**
 * Converte Base64 para ArrayBuffer
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

/**
 * Valida força da senha de criptografia
 */
export function validatePasswordStrength(password: string): {
  valid: boolean
  message: string
} {
  if (password.length < 8) {
    return {
      valid: false,
      message: 'A senha deve ter no mínimo 8 caracteres'
    }
  }

  const hasUpperCase = /[A-Z]/.test(password)
  const hasLowerCase = /[a-z]/.test(password)
  const hasNumbers = /\d/.test(password)
  const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)

  if (!hasUpperCase || !hasLowerCase || !hasNumbers || !hasSpecialChar) {
    return {
      valid: false,
      message:
        'A senha deve conter letras maiúsculas, minúsculas, números e caracteres especiais'
    }
  }

  return {
    valid: true,
    message: 'Senha forte'
  }
}
