export class HttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

export function apiError(error: unknown): Response {
  if (error instanceof HttpError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof SyntaxError) {
    return Response.json({ error: "Requisição inválida." }, { status: 400 });
  }
  // Do not return database errors, provider responses or credentials to clients.
  console.error("Falha na operação", { type: error instanceof Error ? error.name : "Unknown" });
  return Response.json({ error: "Não foi possível concluir a operação. Tente novamente." }, { status: 500 });
}

export function parseId(value: string): number {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) throw new HttpError(400, "Identificador inválido.");
  return id;
}

export type RouteContext = { params: Promise<{ id: string }> };
