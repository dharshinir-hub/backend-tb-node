import CryptoJS from "crypto-js";

// Replace with a secure key in production (never hardcode in frontend)
const SECRET_KEY = "9f8d7c6b5a4e3d2c1b0a864637899xgt";

/**
 * Encrypts a plain text string using AES
 * @param {string} text - Plain text to encrypt
 * @returns {string} Encrypted text
 */
export const encryptText = (text) => {
  if (!text) return "";
  return CryptoJS.AES.encrypt(text, SECRET_KEY).toString();
};

/**
 * Decrypts an AES-encrypted string
 * @param {string} encryptedText - Encrypted text
 * @returns {string} Decrypted plain text
 */
export const decryptText = (encryptedText) => {
  if (!encryptedText) return "";
  const bytes = CryptoJS.AES.decrypt(encryptedText, SECRET_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
};
