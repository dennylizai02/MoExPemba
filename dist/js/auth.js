import { supabase } from './config.js';
import { withTimeout, isOfflineError, isDbMissingError } from './utils.js';

const NET_TIMEOUT = 15000;

function offlineError() {
  return { error: 'Serviço indisponível. Verifique a sua ligação e tente novamente.' };
}

function handleAuthError(error, fallback) {
  if (isOfflineError(error)) return offlineError();
  return { error: (error && error.message) || fallback };
}

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

function localProfileKey(userId) {
  return 'moex_local:profile:' + userId;
}

export function saveLocalProfile(profile) {
  if (!profile || !profile.id) return;
  try { localStorage.setItem(localProfileKey(profile.id), JSON.stringify(profile)); } catch { /* quota */ }
}

export function readLocalProfile(userId) {
  try {
    const raw = localStorage.getItem(localProfileKey(userId));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

async function fallbackProfile(userId) {
  let user = null;
  try {
    const res = await supabase.auth.getUser();
    user = res?.data?.user || null;
  } catch (e) {
    console.warn('[auth] getUser falhou:', e);
  }
  if (!user) return readLocalProfile(userId);
  const meta = user.user_metadata || {};
  const appMeta = user.app_metadata || {};
  const profile = {
    id: userId,
    name: meta.name || meta.full_name || (user.email || '').split('@')[0],
    phone: meta.phone || user.phone || '',
    email: user.email || '',
    role: appMeta.role || (meta.role === 'seller' ? 'seller' : 'user')
  };
  saveLocalProfile(profile);
  console.log('[auth] perfil local (tabela profiles ausente):', profile);
  return profile;
}

async function fetchProfile(userId) {
  let data, error;
  try {
    ({ data, error } = await withTimeout(
      supabase.from('profiles').select('id, name, phone, email, role').eq('id', userId).maybeSingle(),
      NET_TIMEOUT,
      'Servidor indisponível'
    ));
  } catch (e) {
    if (isDbMissingError(e)) return fallbackProfile(userId);
    console.warn('[auth] fetchProfile failed:', e);
    return readLocalProfile(userId) || await fallbackProfile(userId);
  }
  if (error) {
    if (isDbMissingError(error)) return fallbackProfile(userId);
    console.warn('[auth] fetchProfile error:', error);
    return readLocalProfile(userId) || await fallbackProfile(userId);
  }
  if (data) {
    console.log('[auth] profile loaded:', { id: data.id, name: data.name, role: data.role });
    let profile = data;
    // O role do servidor (app_metadata) prevalece sempre que for admin/seller.
    // Sem ele, um profile 'user' pode subir a seller pelo metadata do registo.
    // Nunca despromove admin/seller definidos na base de dados.
    try {
      const { data: authData } = await supabase.auth.getUser();
      const appRole = authData?.user?.app_metadata?.role;
      const metaRole = authData?.user?.user_metadata?.role;
      let desired = profile.role;
      if (appRole === 'admin' || appRole === 'seller') {
        desired = appRole;
      } else if (profile.role !== 'admin' && profile.role !== 'seller') {
        desired = metaRole === 'seller' ? 'seller' : 'user';
      }
      if (desired !== profile.role) {
        const { error: upErr } = await supabase.from('profiles').update({ role: desired }).eq('id', userId);
        if (upErr) console.warn('[auth] role sync failed:', upErr);
        profile = { ...profile, role: desired };
      }
    } catch (e) {
      console.warn('[auth] role sync failed:', e);
    }
    saveLocalProfile(profile);
    return profile;
  }
  console.warn('[auth] fetchProfile: no profile found for userId', userId, '- attempting auto-create');
  const { data: authData } = await supabase.auth.getUser();
  const meta = authData?.user?.user_metadata || {};
  const appRole = authData?.user?.app_metadata?.role;
  const newProfile = {
    id: userId,
    name: meta.name || '',
    phone: (meta.phone || '').trim() || null,
    email: authData?.user?.email || '',
    role: appRole === 'admin' || appRole === 'seller' ? appRole : (meta.role === 'seller' ? 'seller' : 'user')
  };
  let inserted = null;
  try {
    const res = await withTimeout(
      supabase.from('profiles').insert(newProfile).select('id, name, phone, email, role').maybeSingle(),
      NET_TIMEOUT,
      'Servidor indisponível'
    );
    inserted = res.data;
    if (res.error) throw res.error;
  } catch (e) {
    if (isDbMissingError(e)) return fallbackProfile(userId);
    console.error('[auth] auto-create profile failed:', e);
    // Perfil pode já existir (trigger concorrente) ou o telefone pode colidir
    // com outra conta: usar o perfil existente ou seguir com os dados do Auth.
    try {
      const { data: existing } = await supabase
        .from('profiles').select('id, name, phone, email, role').eq('id', userId).maybeSingle();
      if (existing) {
        saveLocalProfile(existing);
        return existing;
      }
    } catch (readErr) {
      console.warn('[auth] profile re-read failed:', readErr);
    }
    return fallbackProfile(userId);
  }
  console.log('[auth] profile auto-created:', inserted);
  saveLocalProfile(inserted || newProfile);
  return inserted || newProfile;
}

export async function registerUser(name, email, phone, password, role) {
  const cleanPhone = phone.replace(/\D/g, '');
  const accountRole = role === 'seller' ? 'seller' : 'user';
  if (cleanPhone.length < 8) return { error: "Telefone inválido (mínimo 8 dígitos)" };
  if (password.length < 6) return { error: "Palavra-passe deve ter pelo menos 6 caracteres" };

  let data, error;
  try {
    ({ data, error } = await withTimeout(
      supabase.auth.signUp({
        email,
        password,
        options: { data: { name: name.trim(), phone: cleanPhone, role: accountRole } }
      }),
      NET_TIMEOUT,
      'Servidor indisponível'
    ));
  } catch (e) {
    console.error('signUp failed:', e);
    return handleAuthError(e, 'Erro ao criar conta');
  }
  if (error) return handleAuthError(error, 'Erro ao criar conta');

  if (data.user && data.session) {
    currentUserProfile = await fetchProfile(data.user.id);
    if (accountRole === 'seller' && currentUserProfile && currentUserProfile.role !== 'seller') {
      try {
        const { error: upErr } = await supabase.from('profiles').update({ role: 'seller' }).eq('id', data.user.id);
        if (!upErr) {
          currentUserProfile = { ...currentUserProfile, role: 'seller' };
          saveLocalProfile(currentUserProfile);
        }
      } catch (e) {
        console.warn('[auth] role sync failed:', e);
      }
    }
  }
  return { ok: true, confirmEmail: !data.session, email, role: accountRole };
}

export async function loginUser(identifier, password) {
  let email = identifier;

  const isPhone = /^\d{8,12}$/.test(identifier.replace(/\D/g, ''));
  if (isPhone) {
    const cleanPhone = identifier.replace(/\D/g, '');
    let data, lookupErr;
    try {
      ({ data, error: lookupErr } = await withTimeout(
        supabase.rpc('lookup_phone_email', { p_phone: cleanPhone }),
        NET_TIMEOUT,
        'Servidor indisponível'
      ));
    } catch (e) {
      console.error('Phone lookup failed:', e);
      return handleAuthError(e, 'Erro ao procurar telefone');
    }
    if (lookupErr) { console.error('Phone lookup error:', lookupErr); return handleAuthError(lookupErr, 'Erro ao procurar telefone'); }
    if (!data) return { error: "Telefone não encontrado" };
    email = data;
  }

  let data, error;
  try {
    ({ data, error } = await withTimeout(
      supabase.auth.signInWithPassword({ email, password }),
      NET_TIMEOUT,
      'Servidor indisponível'
    ));
  } catch (e) {
    console.error('signIn failed:', e);
    return handleAuthError(e, 'Erro ao entrar');
  }
  if (error) return handleAuthError(error, 'Erro ao entrar');

  currentUserProfile = await fetchProfile(data.user.id);
  return { ok: true };
}

export async function logout() {
  try {
    await withTimeout(supabase.auth.signOut(), 4000, 'Servidor indisponível');
  } catch (e) {
    console.warn('Sign out falhou (possivelmente offline):', e);
  }
  currentUserProfile = null;
}

export async function restoreSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return false;

  try {
    currentUserProfile = await fetchProfile(session.user.id);
  } catch (e) {
    console.warn('Perfil indisponível:', e);
    currentUserProfile = null;
  }
  return !!currentUserProfile;
}

export async function requestPasswordReset(identifier) {
  let email = identifier;

  const isPhone = /^\d{8,12}$/.test(identifier.replace(/\D/g, ''));
  if (isPhone) {
    const cleanPhone = identifier.replace(/\D/g, '');
    let data, lookupErr;
    try {
      ({ data, error: lookupErr } = await withTimeout(
        supabase.rpc('lookup_phone_email', { p_phone: cleanPhone }),
        NET_TIMEOUT,
        'Servidor indisponível'
      ));
    } catch (e) {
      console.error('Phone lookup failed:', e);
      return handleAuthError(e, 'Erro ao procurar telefone');
    }
    if (lookupErr) { console.error('Phone lookup error:', lookupErr); return handleAuthError(lookupErr, 'Erro ao procurar telefone'); }
    if (!data) return { error: "Telefone não encontrado" };
    email = data;
  }

  let error;
  try {
    ({ error } = await withTimeout(
      supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + window.location.pathname
      }),
      NET_TIMEOUT,
      'Servidor indisponível'
    ));
  } catch (e) {
    return handleAuthError(e, 'Erro ao enviar email');
  }
  if (error) return handleAuthError(error, 'Erro ao enviar email');
  return { ok: true };
}

export async function completePasswordReset(newPassword) {
  let error;
  try {
    ({ error } = await withTimeout(
      supabase.auth.updateUser({ password: newPassword }),
      NET_TIMEOUT,
      'Servidor indisponível'
    ));
  } catch (e) {
    return handleAuthError(e, 'Erro ao redefinir senha');
  }
  if (error) return handleAuthError(error, 'Erro ao redefinir senha');
  return { ok: true };
}

export async function resendConfirmation(identifier) {
  let email = identifier;
  const isPhone = /^\d{8,12}$/.test(identifier.replace(/\D/g, ''));
  if (isPhone) {
    const cleanPhone = identifier.replace(/\D/g, '');
    let data, lookupErr;
    try {
      ({ data, error: lookupErr } = await withTimeout(
        supabase.rpc('lookup_phone_email', { p_phone: cleanPhone }),
        NET_TIMEOUT,
        'Servidor indisponível'
      ));
    } catch (e) {
      console.error('Phone lookup failed:', e);
      return handleAuthError(e, 'Erro ao procurar telefone');
    }
    if (lookupErr) { console.error('Phone lookup error:', lookupErr); return handleAuthError(lookupErr, 'Erro ao procurar telefone'); }
    if (!data) return { error: "Telefone não encontrado" };
    email = data;
  }
  let error;
  try {
    ({ error } = await withTimeout(
      supabase.auth.resend({ email, type: 'signup' }),
      NET_TIMEOUT,
      'Servidor indisponível'
    ));
  } catch (e) {
    return handleAuthError(e, 'Erro ao reenviar email');
  }
  if (error) return handleAuthError(error, 'Erro ao reenviar email');
  return { ok: true };
}

export function isRecoverySession() {
  return window.__recoveryHash !== '' || window.location.hash.includes('type=recovery');
}
