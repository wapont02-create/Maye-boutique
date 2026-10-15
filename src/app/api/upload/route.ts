import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const data = await request.formData();
    const file = data.get('image') as File;

    if (!file) {
      return NextResponse.json({ success: false, error: 'No se ha proporcionado ninguna imagen.' }, { status: 400 });
    }

    const apiKey = process.env.IMGBB_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'Falta configurar la IMGBB_API_KEY en las variables de entorno.' }, { status: 500 });
    }

    // Convertir el archivo a buffer y luego a base64 para enviarlo de forma segura a ImgBB
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64Image = buffer.toString('base64');

    // Preparar los datos para la API de ImgBB
    const body = new URLSearchParams();
    body.append('key', apiKey);
    body.append('image', base64Image);

    const imgbbResponse = await fetch('https://api.imgbb.com/1/upload', {
      method: 'POST',
      body: body,
    });

    const result = await imgbbResponse.json();

    if (result && result.success) {
      return NextResponse.json({
        success: true,
        url: result.data.url, // URL pública de la imagen
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error?.message || 'Error desconocido por parte de ImgBB',
      }, { status: 400 });
    }

  } catch (error) {
    console.error('Error interno en /api/upload:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor al procesar la imagen.' }, { status: 500 });
  }
}
