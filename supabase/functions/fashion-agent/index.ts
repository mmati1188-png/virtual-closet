import { serve } from "https://deno.land/std@0.168/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { encodeBase64 } from "https://deno.land/std@0.203.0/encoding/base64.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Prompt de entrenamiento (System Prompt original copiado tal cual)
const PROMPT_ENTRENAMIENTO = `
# ROL Y PERSONALIDAD
Eres el Estilista Visual Oficial de Aura Closet. Puedes VER fotografias reales de las prendas. Tu tono es seguro, sofisticado y natural. Tu regla de oro es jamas inventar prendas: solo puedes crear combinaciones con los articulos reales del inventario que te proporcionan.

# ANALISIS VISUAL (MUY IMPORTANTE)
- Analiza VISUALMENTE cada imagen de prenda que recibes: identifica colores exactos, texturas, siluetas, ajuste y estilo.
- Usa tu percepcion visual para hacer combinaciones armonicas mucho mas precisas que si solo leyeras el texto.
- Detecta si una prenda es oversized, slim, estructurada, fluida, brillante o mate directamente desde la imagen.

# CONOCIMIENTO DE MODA
1. Teoria del Color: Crea combinaciones armonicas (monocromaticas, complementarias, analogas o con neutros + acento).
2. Estilismo por Ocasion: Respeta estrictamente la categoria (Formal, Informal, Casual, Deportivo, Streetwear).
3. Balance y Proporciones: Equilibra siluetas. NUNCA dos prendas de la misma subcategoria.

# FORMATO DE RESPUESTA
1. El Concepto: Frase breve y atractiva que describa la vibra del look.
2. El Outfit (Prenda por Prenda): Lista las piezas seleccionadas con nombre, tienda y color visto en la imagen.
3. Justificacion Visual: Explica por que funciona basandote en lo que VES en las imagenes (colores reales, texturas, siluetas).
`

const OCCASION_KEYWORDS: Record<string, string[]> = {
  formal: ['formal', 'trabajo', 'oficina', 'entrevista', 'reunion', 'reunión', 'boda', 'matrimonio', 'elegante', 'vestir'],
  casual: ['casual', 'diario', 'comun', 'común', 'sencillo', 'universidad', 'clases', 'salida', 'cómodo', 'comodo'],
  deportivo: ['deportivo', 'deporte', 'gym', 'gimnasio', 'ejercicio', 'entrenar', 'correr', 'running', 'sport', 'entrenamiento'],
  fiesta: ['fiesta', 'carrete', 'noche', 'club', 'disco', 'salir', 'party', 'coctel', 'cóctel', 'celebracion', 'celebración', 'evento'],
  streetwear: ['streetwear', 'urbano', 'calle', 'oversized', 'skate', 'casual urbano']
}

const OCCASION_TO_STYLE_MAPPING: Record<string, string[]> = {
  formal: ['Formal', 'Eventos de Ocasión'],
  casual: ['Casual'],
  deportivo: ['Deportivo'],
  fiesta: ['Eventos de Ocasión', 'Casual'],
  streetwear: ['Casual', 'Deportivo']
}

function detectarOcasion(query: string): string {
  const normalizedQuery = query.toLowerCase()
  let bestOccasion = 'casual'
  let maxMatches = 0

  for (const [occasion, keywords] of Object.entries(OCCASION_KEYWORDS)) {
    let matches = 0
    for (const keyword of keywords) {
      if (normalizedQuery.includes(keyword)) {
        matches++
      }
    }
    if (matches > maxMatches) {
      maxMatches = matches
      bestOccasion = occasion
    }
  }

  return bestOccasion
}

interface ClosetItem {
  id: number | string
  name: string
  brand?: string
  store?: string
  category: string
  color?: string
  gender?: string
  image_url?: string
  purchase_url?: string
  price?: number
  status?: string
  style?: string
  created_at?: string
  owner_email?: string
}

function filtrarInventario(query: string, items: ClosetItem[]): { ocasionDetectada: string, itemsFiltrados: ClosetItem[] } {
  const ocasion = detectarOcasion(query)
  const allowedStyles = OCCASION_TO_STYLE_MAPPING[ocasion] || ['Casual']

  let filtered = items.filter(item => {
    const itemStyle = item.style || 'Casual'
    return allowedStyles.includes(itemStyle)
  })

  if (filtered.length === 0) {
    filtered = items
  }

  const categoryCounts: Record<string, number> = {}
  const limitedItems: ClosetItem[] = []

  for (const item of filtered) {
    const cat = item.category || 'tops'
    if (!categoryCounts[cat]) {
      categoryCounts[cat] = 0
    }
    if (categoryCounts[cat] < 7) {
      limitedItems.push(item)
      categoryCounts[cat]++
    }
  }

  return {
    ocasionDetectada: ocasion,
    itemsFiltrados: limitedItems
  }
}

async function descargarImagenBase64(url: string | undefined): Promise<string | null> {
  if (!url || url.trim() === "" || url.includes("nan") || url.includes("None")) {
    return null
  }

  // Las imágenes subidas localmente pueden tener URLs relativas como /uploads/garment-...
  // No se pueden descargar vía HTTP si es relativa, a menos que sea una URL absoluta.
  if (!url.startsWith("http")) {
    console.log(`Imagen omitida (ruta relativa): ${url}`)
    return null
  }

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!response.ok) {
      console.log(`Error al descargar imagen: HTTP ${response.status} para ${url}`)
      return null
    }
    const buffer = await response.arrayBuffer()
    return encodeBase64(buffer)
  } catch (err) {
    console.log(`Error descargando imagen desde ${url}:`, err)
    return null
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { query, userEmail } = await req.json()

    if (!userEmail) {
      return new Response(
        JSON.stringify({ error: "El parámetro userEmail es requerido." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ""
    const supabaseServiceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ""

    if (!supabaseUrl || !supabaseServiceRole) {
      return new Response(
        JSON.stringify({ error: "Faltan configurar las variables de entorno de Supabase en Deno." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const geminiApiKey = Deno.env.get("GEMINI_API_KEY")
    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({ error: "La variable de entorno GEMINI_API_KEY no está configurada en Supabase." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRole, {
      auth: { persistSession: false }
    })

    // Consultar la tabla "clothes" filtrando por owner_email
    const { data: clothes, error } = await supabase
      .from('clothes')
      .select('*')
      .eq('owner_email', userEmail)

    if (error) {
      throw error
    }

    // Filtrar inventario
    const { ocasionDetectada, itemsFiltrados } = filtrarInventario(query || "", clothes || [])

    // Construir partes del prompt multimodal (intercalando textos e imágenes en base64)
    const contentsParts: any[] = [
      {
        text: `A continuacion te muestro el inventario completo de prendas.\n` +
              `Para cada prenda te envio su imagen real y sus datos.\n` +
              `Usa AMBAS fuentes (texto y vision) para tu recomendacion.\n\n` +
              `PETICION DEL USUARIO: ${query || "Recomiéndame un outfit"}\n\n` +
              `--- INVENTARIO ---\n`
      }
    ]

    for (let i = 0; i < itemsFiltrados.length; i++) {
      const prenda = itemsFiltrados[i]
      let textoPrenda = `\nPRENDA #${i + 1}\n` +
                        `  ID:        ${prenda.id}\n` +
                        `  Nombre:    ${prenda.name}\n` +
                        `  Tienda:    ${prenda.store || prenda.brand || "Sin tienda"}\n` +
                        `  Categoria: ${prenda.category}\n` +
                        `  Color:     ${prenda.color || "No especificado"}\n`

      if (prenda.style) {
        textoPrenda += `  Ocasion:   ${prenda.style}\n`
      }
      contentsParts.push({ text: textoPrenda })

      // Descarga segura de la imagen de la prenda
      const base64Image = await descargarImagenBase64(prenda.image_url)
      if (base64Image) {
        contentsParts.push({
          inlineData: {
            mimeType: "image/jpeg",
            data: base64Image
          }
        })
      } else {
        contentsParts.push({ text: `  [Imagen no disponible]\n` })
      }
    }

    // Instrucción final para forzar la respuesta JSON estructurada requerida por la API route y el frontend
    contentsParts.push({
      text: `\nINSTRUCCIÓN ADICIONAL IMPORTANTE:
Debes responder estrictamente en formato JSON utilizando el esquema response_mime_type.
El JSON debe tener exactamente estas dos propiedades:
- "text": Una cadena de texto formateada en Markdown con la recomendación de moda oficial (El Concepto, El Outfit prenda por prenda, Justificación Visual).
- "suggestedIds": Un array conteniendo únicamente los IDs (como números enteros) de las prendas seleccionadas para el outfit.

Ejemplo de respuesta esperada:
{
  "text": "# Concepto\\nEstilo casual elegante...\\n\\n# Outfit\\n- Camisa (ID: 12)...\\n\\n# Justificación\\nCombina perfectamente...",
  "suggestedIds": [12, 45, 7]
}`
    })

    // Llamada directa vía fetch a la API REST de Gemini (sin SDK)
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`

    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: contentsParts
          }
        ],
        systemInstruction: {
          parts: [
            { text: PROMPT_ENTRENAMIENTO }
          ]
        },
        generationConfig: {
          temperature: 0.6,
          responseMimeType: "application/json"
        }
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Gemini API respondió con código ${response.status}: ${errorText}`)
    }

    const resultData = await response.json()
    const responseText = resultData.candidates?.[0]?.content?.parts?.[0]?.text

    if (!responseText) {
      throw new Error("Respuesta vacía o formato inválido de la API de Gemini")
    }

    // Retornamos el JSON devuelto por Gemini
    const finalResult = JSON.parse(responseText.trim())

    return new Response(
      JSON.stringify({
        success: true,
        text: finalResult.text,
        suggestedIds: finalResult.suggestedIds || []
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )

  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
