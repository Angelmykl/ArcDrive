import CryptoJS from "crypto-js";

// 🔐 Encrypt file content
export function encryptFile(fileBuffer, secretKey) {
  const wordArray = CryptoJS.lib.WordArray.create(fileBuffer);
  const encrypted = CryptoJS.AES.encrypt(wordArray, secretKey).toString();
  return encrypted;
}

// 🔓 Decrypt file
export function decryptFile(encryptedData, secretKey) {
  const decrypted = CryptoJS.AES.decrypt(encryptedData, secretKey);
  return decrypted.toString(CryptoJS.enc.Utf8);
}

// 🔑 Generate random key
export function generateKey() {
  return CryptoJS.lib.WordArray.random(32).toString();
}