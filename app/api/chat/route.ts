import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const { query, userEmail } = await request.json();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    // Usamos service_role en el backend para consultar los datos completos
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: 'Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY.' },
        { status: 500 }
      );
    }

    // 1. Hacer un fetch a la Edge Function desplegada
    const edgeFunctionUrl = `${supabaseUrl}/functions/v1/fashion-agent`;
    
    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}` // Autorización con anon key
      },
      body: JSON.stringify({ query, userEmail })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Fallo al llamar a la Edge Function: ${errorText}` },
        { status: response.status }
      );
    }

    // Obtener respuesta de la Edge Function (devuelve { success, text, suggestedIds })
    const data = await response.json();

    // 2. Mapear suggestedIds contra la base de datos de Supabase para obtener las prendas recomendadas (suggestedItems)
    const suggestedIds = data.suggestedIds || [];
    let suggestedItems = [];

    if (suggestedIds.length > 0) {
      // Inicializar cliente Supabase para obtener los detalles del armario
      const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey);
      const { data: clothes, error: dbError } = await supabase
        .from('clothes')
        .select('*')
        .in('id', suggestedIds);

      if (dbError) {
        console.error('Error al mapear las prendas sugeridas en el backend:', dbError.message);
      } else {
        suggestedItems = clothes || [];
      }
    }

    // 3. Responder al frontend con el formato requerido
    return NextResponse.json({
      text: data.text,
      suggestedItems: suggestedItems
    });

  } catch (error: any) {
    console.error('Error en /api/chat route:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
