import os
import io
import requests
import pandas as pd
from PIL import Image
from google import genai
from google.genai import types

# =====================================================================
# RUTAS DE FUENTES DE DATOS (en orden de prioridad)
# =====================================================================
# 1. Archivo local de prueba (base de datos temporal hasta conectar Supabase)
EXCEL_LOCAL = r"C:\Users\ferod\OneDrive\Escritorio\OneDrive - Universidad Adolfo Ibanez\5 Comercial Quinto Año (2026)\B6\Automatizacion e IA\Base ropa hombres.xlsx"

# 2. URL RAW de GitHub de respaldo
URL_GITHUB = "https://raw.githubusercontent.com/javignzzz/virtual-closet/main/inventario_closet.xlsx"


# =====================================================================
# 1. FUNCIÓN PARA LEER EL INVENTARIO
# =====================================================================
def obtener_inventario() -> list:
    """
    Lee el inventario en este orden de prioridad:
      1. Archivo Excel local de prueba
      2. URL pública RAW de GitHub
    Mapea las columnas al formato estándar del agente.
    """

    def cargar_y_mapear(df: pd.DataFrame) -> list:
        """Normaliza el DataFrame al esquema interno del agente."""
        registros = []
        for _, fila in df.iterrows():
            registros.append({
                "id":        str(fila.get("id", fila.name + 1)),
                "nombre":    str(fila.get("Producto", fila.get("name", fila.get("nombre", "Sin nombre")))),
                "tienda":    str(fila.get("Tienda",   fila.get("brand",  fila.get("marca",  "Sin tienda")))),
                "categoria": str(fila.get("Categoría", fila.get("category", fila.get("categoria", "Sin categoria")))),
                "ocasion":   str(fila.get("Ocasion",  fila.get("occasion", fila.get("ocasion", "")))),
                "color":     str(fila.get("Color",    fila.get("predominant_color", fila.get("color", "No especificado")))),
                "url_compra": str(fila.get("URL de Compra", fila.get("URL", ""))),
                "url_imagen": str(fila.get("URL de Imagen", fila.get("image_url", fila.get("imagen", "")))),
            })
        return registros

    # --- Intento 1: archivo local ---
    if os.path.exists(EXCEL_LOCAL):
        try:
            print(f"Cargando inventario desde archivo local:\n  {EXCEL_LOCAL}")
            df = pd.read_excel(EXCEL_LOCAL)
            registros = cargar_y_mapear(df)
            print(f"Inventario cargado: {len(registros)} prendas encontradas.")
            return registros
        except Exception as e:
            print(f"Error al leer el archivo local: {e}")

    # --- Intento 2: URL de GitHub ---
    try:
        print(f"Archivo local no encontrado. Cargando desde GitHub:\n  {URL_GITHUB}")
        df = pd.read_excel(URL_GITHUB)
        registros = cargar_y_mapear(df)
        print(f"Inventario cargado: {len(registros)} prendas encontradas.")
        return registros
    except Exception as e:
        print(f"No se pudo cargar desde GitHub: {e}")

    return []


# =====================================================================
# 2. FUNCIÓN PARA DESCARGAR IMAGEN COMO BYTES DESDE URL
# =====================================================================
def descargar_imagen_bytes(url: str) -> bytes | None:
    """
    Descarga una imagen desde una URL y la retorna como bytes JPEG.
    Retorna None si la URL está vacía o la descarga falla.
    """
    if not url or url in ("nan", "None", ""):
        return None
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        img = Image.open(io.BytesIO(response.content)).convert("RGB")
        img.thumbnail((512, 512))
        buffer = io.BytesIO()
        img.save(buffer, format="JPEG")
        return buffer.getvalue()
    except Exception as e:
        print(f"  No se pudo cargar imagen desde {url}: {e}")
        return None


# =====================================================================
# 3. PROMPT DE ENTRENAMIENTO
# =====================================================================
PROMPT_ENTRENAMIENTO = """
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
"""


# =====================================================================
# 4. FUNCIÓN PRINCIPAL
# =====================================================================
def main():
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("\nADVERTENCIA: La variable de entorno GEMINI_API_KEY no esta configurada.")
        print("Ejemplo en PowerShell: $env:GEMINI_API_KEY=\"TU_CLAVE\"")
        print("Ejemplo en CMD/Bash:   export GEMINI_API_KEY=\"TU_CLAVE\"\n")

    client = genai.Client()

    # Cargamos el inventario
    inventario = obtener_inventario()
    if not inventario:
        print("No se pudo obtener el inventario. Verifica la ruta del archivo o la URL de GitHub.")
        return

    print("\n--- BIENVENIDO AL ASISTENTE DE MODA VISUAL DE AURA CLOSET ---")
    peticion = input("¿Que ocasion o evento tienes hoy? (ej: Una reunion casual de trabajo): ")

    print("\nDescargando imagenes de las prendas para analisis visual...")

    # Construimos el prompt multimodal: texto + imagenes intercaladas
    partes_multimodal = [
        types.Part.from_text(text=
            f"A continuacion te muestro el inventario completo de prendas.\n"
            f"Para cada prenda te envio su imagen real y sus datos.\n"
            f"Usa AMBAS fuentes (texto y vision) para tu recomendacion.\n\n"
            f"PETICION DEL USUARIO: {peticion}\n\n"
            f"--- INVENTARIO ---\n"
        )
    ]

    imagenes_cargadas = 0
    for i, prenda in enumerate(inventario):
        texto_prenda = (
            f"\nPRENDA #{i+1}\n"
            f"  Nombre:    {prenda['nombre']}\n"
            f"  Tienda:    {prenda['tienda']}\n"
            f"  Categoria: {prenda['categoria']}\n"
            f"  Color:     {prenda['color']}\n"
        )
        if prenda.get("ocasion") and prenda["ocasion"] not in ("", "nan", "None"):
            texto_prenda += f"  Ocasion:   {prenda['ocasion']}\n"

        partes_multimodal.append(types.Part.from_text(text=texto_prenda))

        # Intentamos cargar la imagen
        img_bytes = descargar_imagen_bytes(prenda.get("url_imagen", ""))
        if img_bytes:
            partes_multimodal.append(
                types.Part.from_bytes(data=img_bytes, mime_type="image/jpeg")
            )
            imagenes_cargadas += 1
        else:
            partes_multimodal.append(
                types.Part.from_text(text="  [Imagen no disponible]\n")
            )

    print(f"Imagenes cargadas: {imagenes_cargadas}/{len(inventario)}")
    print("\nEl estilista visual esta analizando las prendas y generando tu look...")

    try:
        config_agente = types.GenerateContentConfig(
            system_instruction=PROMPT_ENTRENAMIENTO,
            temperature=0.6,
        )

        response = client.models.generate_content(
            model="gemini-1.5-flash",
            contents=[types.Content(parts=partes_multimodal, role="user")],
            config=config_agente,
        )

        print("\n==========================================")
        print("PROPUESTA DE OUTFIT VISUAL")
        print("==========================================")
        print(response.text)

    except Exception as e:
        print(f"\nError al llamar a la API de Gemini: {str(e)}")


if __name__ == "__main__":
    main()
