
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL_KEY = 'gen_pm_supabase_url';
const SUPABASE_KEY_KEY = 'gen_pm_supabase_key';

export const getSupabaseConfig = () => {
  return {
    url: localStorage.getItem(SUPABASE_URL_KEY) || '',
    key: localStorage.getItem(SUPABASE_KEY_KEY) || ''
  };
};

export const saveSupabaseConfig = (url: string, key: string) => {
  localStorage.setItem(SUPABASE_URL_KEY, url);
  localStorage.setItem(SUPABASE_KEY_KEY, key);
};

export const getSupabaseClient = () => {
  const { url, key } = getSupabaseConfig();
  if (!url || !key) return null;
  return createClient(url, key);
};
