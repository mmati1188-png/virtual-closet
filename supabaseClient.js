import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    '\n[ERROR] Faltan variables de entorno SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.\n' +
    'Crea un archivo .env en la raíz del proyecto (puedes copiar .env.example) y complétalo\n' +
    'con los valores de tu proyecto en https://app.supabase.com -> Project Settings -> API.\n'
  );
  process.exit(1);
}

// El backend usa la service_role key porque tiene privilegios completos.
// Esta key NUNCA debe usarse en el frontend ni exponerse en el navegador.
export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

export default supabase;
