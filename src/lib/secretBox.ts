/**
 * Criptografia de segredos guardados no banco (ex.: a chave de IA de cada workspace, ai_builder_configs.api_key_enc).
 *
 * AES-256-GCM com a chave-mestra em AI_KEY_ENCRYPTION_SECRET (variável de ambiente, nunca no banco).
 * Formato gravado: "enc:v1:<iv>:<tag>:<texto cifrado>" (tudo em base64). Valores antigos, gravados em texto puro,
 * continuam legíveis (decryptSecret os devolve como estão) e são recriptografados quando possível.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const PREFIX = 'enc:v1:'

/** Chave-mestra: 32 bytes em base64 (gere com `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`). */
function masterKey(env: NodeJS.ProcessEnv = process.env): Buffer {
  const raw = env.AI_KEY_ENCRYPTION_SECRET
  if (!raw) throw new Error('AI_KEY_ENCRYPTION_SECRET não está configurada no servidor')
  const key = Buffer.from(raw, 'base64')
  if (key.length !== 32) throw new Error('AI_KEY_ENCRYPTION_SECRET deve ter 32 bytes em base64')
  return key
}

export function isEncryptedSecret(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(PREFIX)
}

export function encryptSecret(plain: string, env: NodeJS.ProcessEnv = process.env): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', masterKey(env), iv)
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return PREFIX + [iv, tag, data].map(b => b.toString('base64')).join(':')
}

/** Valor em texto puro (formato antigo) volta como está; valor cifrado exige a chave-mestra correta. */
export function decryptSecret(stored: string, env: NodeJS.ProcessEnv = process.env): string {
  if (!isEncryptedSecret(stored)) return stored
  const parts = stored.slice(PREFIX.length).split(':')
  if (parts.length !== 3) throw new Error('Segredo criptografado em formato inválido')
  const [iv, tag, data] = parts.map(p => Buffer.from(p, 'base64'))
  const decipher = createDecipheriv('aes-256-gcm', masterKey(env), iv)
  decipher.setAuthTag(tag)
  try {
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
  } catch {
    throw new Error('Não foi possível descriptografar o segredo (chave-mestra diferente ou dado alterado)')
  }
}
