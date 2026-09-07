import { NextResponse } from "next/server";

import { ApiError } from "./api-error";

/** Enveloppe d'erreur contractuelle ({ error: { code, message } }). */
export function toErrorResponse(e: unknown): NextResponse {
  if (e instanceof ApiError) {
    return NextResponse.json(
      { error: { code: e.code, message: e.message } },
      { status: e.status }
    );
  }
  console.error("[api] erreur inattendue:", e);
  return NextResponse.json(
    { error: { code: "internal_error", message: "Erreur interne" } },
    { status: 500 }
  );
}
