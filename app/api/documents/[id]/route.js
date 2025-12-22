import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  const documentId = Number(params?.id);
  if (!documentId) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = Number(searchParams.get("projectId"));

  const db = getDb();
  const document = db
    .prepare("SELECT id, project_id, version, text, created_at FROM documents WHERE id = ?")
    .get(documentId);

  if (!document) {
    return NextResponse.json({ error: "No existe el documento." }, { status: 404 });
  }
  if (projectId && Number(document.project_id) !== projectId) {
    return NextResponse.json({ error: "No existe el documento." }, { status: 404 });
  }

  return NextResponse.json({ document });
}

