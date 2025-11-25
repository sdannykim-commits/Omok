
const STORAGE_KEY = 'omok_api_key_enc';
const SECRET_KEY = 'omok_v1_secure_salt';

// Simple XOR Cipher + Base64 for local obfuscation
const xorCipher = (text: string): string => {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ SECRET_KEY.charCodeAt(i % SECRET_KEY.length));
  }
  return result;
};

export const saveApiKey = (apiKey: string): void => {
  try {
    const encrypted = btoa(xorCipher(apiKey));
    localStorage.setItem(STORAGE_KEY, encrypted);
  } catch (e) {
    console.error("Failed to save API key", e);
  }
};

export const getApiKey = (): string | null => {
  try {
    const encrypted = localStorage.getItem(STORAGE_KEY);
    if (!encrypted) return null;
    return xorCipher(atob(encrypted));
  } catch (e) {
    console.error("Failed to retrieve API key", e);
    return null;
  }
};

export const clearApiKey = (): void => {
  localStorage.removeItem(STORAGE_KEY);
};
