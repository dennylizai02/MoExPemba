import { supabase } from './config.js';

let currentUserProfile = null;

export function getCurrentUser() { return currentUserProfile; }

export function isCurrentUserAdmin() {
  return currentUserProfile && currentUserProfile.role === 'admin';
}

export function isCurrentUserSeller() {
  return currentUserProfile && currentUserProfile.role === 'seller';
}

export function canAccessPanel() {
  const role = currentUserProfile?.role;
  return role === 'admin' || role === 'seller';
}

async function fetchProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, phone, email, role')
    .eq('id', userId)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

export async function registerUser(name, email, phone, password) {
  const cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.length < 8) return { error: "Telefone inválido (mínimo 8 dígitos)" };
  if (password.length < 6) return { error: "Palavra-passe deve ter pelo menos 6 caracteres" };

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name: name.trim(), phone: cleanPhone } }
  });
  if (error) return { error: error.message };

  if (data.user && data.session) {
    currentUserProfile = await fetchProfile(data.user.id);
  }
  return { ok: true, confirmEmail: !data.session };
}

export async function loginUser(identifier, password) {
  let email = identifier;

  const isPhone = /^\d{8,12}$/.test(identifier.replace(/\D/g, ''));
  if (isPhone) {
    const cleanPhone = identifier.replace(/\D/g, '');
    const { data } = await supabase
      .from('profiles')
      .select('email')
      .eq('phone', cleanPhone)
      .maybeSingle();
    if (!data || !data.email) return { error: "Telefone não encontrado" };
    email = data.email;
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };

  currentUserProfile = await fetchProfile(data.user.id);
  return { ok: true };
}

export async function logout() {
  await supabase.auth.signOut();
  currentUserProfile = null;
}

export async function restoreSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return false;

  currentUserProfile = await fetchProfile(session.user.id);
  return !!currentUserProfile;
}

export async function requestPasswordReset(identifier) {
  let email = identifier;

  const isPhone = /^\d{8,12}$/.test(identifier.replace(/\D/g, ''));
  if (isPhone) {
    const cleanPhone = identifier.replace(/\D/g, '');
    const { data } = await supabase
      .from('profiles')
      .select('email')
      .eq('phone', cleanPhone)
      .maybeSingle();
    if (!data || !data.email) return { error: "Telefone não encontrado" };
    email = data.email;
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + window.location.pathname
  });
  if (error) return { error: error.message };
  return { ok: true };
}

export async function completePasswordReset(newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { error: error.message };
  return { ok: true };
}

export function isRecoverySession() {
  return window.__recoveryHash !== '' || window.location.hash.includes('type=recovery');
}
