import { createHmac, createHash, createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALGORITHM = 'aes-256-gcm';

// Salt fixo por aplicação — garante derivação determinística para que dados
// já cifrados no banco continuem decifráveis entre reinicializações.
// A confidencialidade depende do CRYPTO_SECRET, não da exposição deste salt.
const KEY_DERIVATION_SALT = 'pep-tcc-aes-key-v1';

// Cache da chave derivada: scrypt é intencionalmente custoso (memory-hard),
// portanto evitamos recomputar a cada operação de cifra/decifra.
let _cachedKey: Buffer | null = null;

/**
 * Deriva uma chave AES-256 de 32 bytes a partir de CRYPTO_SECRET usando scrypt.
 * scrypt garante 256 bits de entropia efetiva independentemente do tamanho do secret.
 */
function getEncryptionKey(): Buffer {
  if (_cachedKey) return _cachedKey;

  const secret = process.env.CRYPTO_SECRET;
  if (!secret) {
    throw new Error('Variável de ambiente CRYPTO_SECRET não definida.');
  }

  _cachedKey = scryptSync(secret, KEY_DERIVATION_SALT, 32);
  return _cachedKey;
}

/**
 * Gera um hash HMAC-SHA256 determinístico do CPF.
 * Permite busca no banco sem armazenar o CPF em texto plano.
 */
export function hashCpf(cpf: string): string {
  const secret = process.env.CRYPTO_SECRET;
  if (!secret) {
    throw new Error('Variável de ambiente CRYPTO_SECRET não definida.');
  }
  return createHmac('sha256', secret).update(cpf.trim()).digest('hex');
}

/**
 * Cifra um texto com AES-256-GCM.
 * Formato do resultado: <iv_hex(24)><authTag_hex(32)><ciphertext_hex>
 */
export function encryptNome(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12); // IV de 96 bits (recomendado para GCM)
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag(); // 16 bytes
  return iv.toString('hex') + authTag.toString('hex') + encrypted.toString('hex');
}

/**
 * Decifra um valor previamente cifrado com encryptNome().
 */
export function decryptNome(encryptedData: string): string {
  const key = getEncryptionKey();
  const iv = Buffer.from(encryptedData.slice(0, 24), 'hex');       // 12 bytes
  const authTag = Buffer.from(encryptedData.slice(24, 56), 'hex'); // 16 bytes
  const ciphertext = Buffer.from(encryptedData.slice(56), 'hex');
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(ciphertext).toString('utf8') + decipher.final('utf8');
}

/**
 * Gera um hash SHA-256 determinístico de um objeto JSON.
 * Usado para o campo hash_integridade dos metadados LGPD no MongoDB,
 * permitindo verificar integridade do documento clínico.
 */
export function hashDocument(data: Record<string, unknown>): string {
  return createHash('sha256').update(JSON.stringify(data)).digest('hex');
}