
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
    const cleanKey = apiKey.trim();
    // Validate ascii to avoid btoa errors
    if (/[^\x00-\x7F]/.test(cleanKey)) {
        console.error("API Key contains invalid characters");
        return;
    }
    const encrypted = btoa(xorCipher(cleanKey));
    localStorage.setItem(STORAGE_KEY, encrypted);
  } catch (e) {
    console.error("Failed to save API key", e);
  }
};

export const getApiKey = (): string | null => {
  try {
    const encrypted = localStorage.getItem(STORAGE_KEY);
    if (!encrypted) return null;
    
    const decrypted = xorCipher(atob(encrypted));
    
    // Safety Check: API Keys should be printable ASCII characters only.
    // If the decrypted string has weird control chars or high-bit chars, storage is likely corrupt.
    // \x20-\x7E covers standard printable characters (space to ~).
    if (/[^\x20-\x7E]/.test(decrypted)) {
       console.warn("Detected corrupt API key in storage. Clearing...");
       localStorage.removeItem(STORAGE_KEY);
       return null;
    }
    
    return decrypted;
  } catch (e) {
    console.error("Failed to retrieve API key", e);
    // If we can't decode it, it's garbage. Clear it.
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
};

export const clearApiKey = (): void => {
  localStorage.removeItem(STORAGE_KEY);
};