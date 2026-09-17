"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

type User = { id: number; name: string; email: string | null; role: "admin" | "operator"; active: boolean };
export function AccessSettings() {
  const [users, setUsers] = useState<User[]>([]);
  const [busy, setBusy] = useState<number | null>(null);
  useEffect(() => {
    const abort = new AbortController();
    fetch("/api/usuarios", { signal: abort.signal }).then(async (response) => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível carregar os acessos.");
      setUsers(result.users);
    }).catch((error) => { if (!abort.signal.aborted) toast.error(error.message); });
    return () => abort.abort();
  }, []);
  async function save(user: User) {
    setBusy(user.id);
    try {
      const response = await fetch("/api/usuarios", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: user.id, email: user.email || "", active: user.active }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível salvar o acesso.");
      setUsers((current) => current.map((item) => item.id === user.id ? result.user : item));
      toast.success("Acesso atualizado.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Falha ao salvar."); }
    finally { setBusy(null); }
  }
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
    <h2 className="font-semibold text-[#18332e]">Acessos ao sistema</h2>
    <p className="mt-1 text-sm text-slate-500">Cadastre o e-mail usado para entrar na conta de cada operador. O cadastro de signatário, sozinho, não libera acesso.</p>
    <div className="mt-4 space-y-3">{users.map((user) => <form key={user.id} className="flex flex-wrap items-center gap-3 rounded-xl border p-3" onSubmit={(event) => { event.preventDefault(); void save(user); }}>
      <div className="min-w-56 flex-1"><p className="font-medium">{user.name}</p><p className="text-xs text-slate-500">{user.role === "admin" ? "Administrador" : "Operador"}</p></div>
      <Input className="sm:w-72" type="email" required aria-label={"E-mail de " + user.name} value={user.email || ""} disabled={user.role === "admin" || busy !== null} placeholder="E-mail de acesso" onChange={(event) => setUsers((current) => current.map((item) => item.id === user.id ? { ...item, email: event.target.value } : item))} />
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={user.active} disabled={user.role === "admin" || busy !== null} onChange={(event) => setUsers((current) => current.map((item) => item.id === user.id ? { ...item, active: event.target.checked } : item))} />Acesso liberado</label>
      {user.role !== "admin" && <Button disabled={busy !== null} type="submit">{busy === user.id ? "Salvando…" : "Salvar"}</Button>}
    </form>)}</div>
  </section>;
}
