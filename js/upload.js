import { supabase, PRODUCT_IMAGE_BUCKET } from './config.js';
import { withTimeout } from './utils.js';

const MAX_DIMENSION = 1400;

function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function shrink(file) {
  try {
    const dataUrl = await readAsDataURL(file);
    const img = await loadImage(dataUrl);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
    if (scale === 1 && file.size < 900 * 1024) return file;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    if (!blob) return file;
    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg' });
  } catch (e) {
    console.warn('Image resize skipped:', e);
    return file;
  }
}

export async function uploadProductImage(file, userId) {
  if (!file || !file.type || !file.type.startsWith('image/')) {
    throw new Error('O ficheiro seleccionado não é uma imagem.');
  }
  const prepared = await shrink(file);
  const safeName = (prepared.name || 'foto.jpg').replace(/[^a-zA-Z0-9._-]/g, '-');
  const path = `${userId || 'anon'}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${safeName}`;
  const { error } = await withTimeout(
    supabase.storage
      .from(PRODUCT_IMAGE_BUCKET)
      .upload(path, prepared, { cacheControl: '3600', upsert: true, contentType: prepared.type || 'image/jpeg' }),
    20000,
    'O envio da imagem demorou demasiado. Verifique a sua ligação.'
  );
  if (error) throw error;
  const { data } = supabase.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadProductImages(files, userId, onProgress) {
  const urls = [];
  const list = Array.from(files || []);
  for (let i = 0; i < list.length; i++) {
    if (onProgress) onProgress(i + 1, list.length);
    try {
      urls.push(await uploadProductImage(list[i], userId));
    } catch (e) {
      console.error('Upload failed:', e);
      throw e;
    }
  }
  return urls;
}
