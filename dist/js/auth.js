import { storage } from './storage.js';
import { uid, fmt, showToast } from './utils.js';

let users = [];
let currentUser = null;

export function getCurrentUser() { return currentUser; }
export function getUsers() { return users; }

async function hashPassword(pw) {
  const enc = new TextEncoder();
  const data = enc.encode(pw);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function loadUsers() {
  try {
    const r = await storage.get('users', false);
    users = r ? JSON.parse(r.value) : [];
  } catch (e) { users = []; }
}

export async function saveUsers() {
  await storage.set('users', JSON.stringify(users), false);
}

export async function seedAdmin() {
  if (users.length === 0) {
    const hash = await hashPassword('admin123');
    users.push({ id: uid(), name: 'Administrador', phone: '840000000', password_hash: hash, role: 'admin' });
    await saveUsers();
  }
}

export async function registerUser(name, phone, password) {
  const cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.length < 8) return { error: "Telefone inválido (mínimo 8 dígitos)" };
  if (password.length < 6) return { error: "Palavra-passe deve ter pelo menos 6 caracteres" };
  if (users.find(u => u.phone === cleanPhone)) return { error: "Este telefone já está registado" };
  const hash = await hashPassword(password);
  const user = { id: uid(), name: name.trim(), phone: cleanPhone, password_hash: hash, role: 'user' };
  users.push(user);
  await saveUsers();
  currentUser = { id: user.id, name: user.name, phone: user.phone, role: user.role };
  sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
  return { ok: true };
}

export async function loginUser(phone, password) {
  const cleanPhone = phone.replace(/\D/g, '');
  const user = users.find(u => u.phone === cleanPhone);
  if (!user) return { error: "Telefone não encontrado" };
  const hash = await hashPassword(password);
  if (hash !== user.password_hash) return { error: "Palavra-passe incorreta" };
  currentUser = { id: user.id, name: user.name, phone: user.phone, role: user.role };
  sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
  return { ok: true };
}

export function logout() {
  currentUser = null;
  sessionStorage.removeItem('currentUser');
}

export function restoreSession() {
  const saved = sessionStorage.getItem('currentUser');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      const match = users.find(u => u.id === parsed.id);
      if (match) { currentUser = parsed; return true; }
    } catch (e) { /* ignore */ }
    sessionStorage.removeItem('currentUser');
  }
  return false;
}

export function isCurrentUserAdmin() {
  return currentUser && currentUser.role === 'admin';
}
