/*
Pasos seguidos:
1) Validar el texto del documento y crear el proyecto/documento con sus chunks.
2) Enviar los chunks al modelo para generar el backlog en JSON.
3) Guardar las tareas en SQLite con trazabilidad y devolver el resumen.
*/
import { NextResponse } from "next/server";
import { generatePlan } from "@/lib/plan-generation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  const body = await request.json();
  try {
    const result = await generatePlan({
      text: body?.text,
      version: body?.version || "v1",
      projectId: body?.projectId,
      context: body?.context || "",
    });
    return NextResponse.json(result);
  } catch (error) {
    const status = Number(error?.status) || 500;
    return NextResponse.json(
      { error: error.message || "No se pudo generar el backlog." },
      { status },
    );
  }
}
