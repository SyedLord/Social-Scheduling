import { createClient, SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

export function isSupabaseConfigured() {
  return Boolean(process.env.SUPABASE_URL && (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY));
}

export function getSupabase() {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error('Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
    }
    client = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return client;
}

export async function readTable<T = any>(table: string) {
  const { data, error } = await getSupabase().from(table).select('*');
  if (error) throw error;
  return (data || []) as T[];
}

export async function upsertRows(table: string, rows: any[]) {
  if (!rows.length) return;
  const { error } = await getSupabase().from(table).upsert(rows, { onConflict: 'id' });
  if (error) throw error;
}

export async function replaceRows(table: string, rows: any[]) {
  const db = getSupabase();
  const { error: deleteError } = await db.from(table).delete().not('id', 'is', null);
  if (deleteError) throw deleteError;
  if (!rows.length) return;
  const { error } = await db.from(table).insert(rows);
  if (error) throw error;
}
