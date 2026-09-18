"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Users,
  UserPlus,
  Pencil,
  Trash2,
  Loader2,
  Shield,
  User as UserIcon,
  Check,
} from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

type User = {
  id: number;
  name: string;
  email: string | null;
  role: "admin" | "operator";
  active: boolean;
};

export function AccessSettings() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    email: "",
    role: "operator" as "admin" | "operator",
    active: true,
  });
  const [creating, setCreating] = useState(false);

  const [editUser, setEditUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    role: "operator" as "admin" | "operator",
    active: true,
  });
  const [updating, setUpdating] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const abort = new AbortController();
    fetch("/api/usuarios", { signal: abort.signal })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Não foi possível carregar os acessos.");
        setUsers(result.users);
      })
      .catch((error) => {
        if (!abort.signal.aborted) toast.error(error.message);
      })
      .finally(() => setLoading(false));
    return () => abort.abort();
  }, []);

  function handleOpenCreate() {
    setCreateForm({
      name: "",
      email: "",
      role: "operator",
      active: true,
    });
    setCreateOpen(true);
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    const trimmedName = createForm.name.trim();
    if (!trimmedName) {
      toast.error("Informe o nome do funcionário.");
      return;
    }

    setCreating(true);
    try {
      const response = await fetch("/api/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          email: createForm.email.trim() || null,
          role: createForm.role,
          active: createForm.active,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível cadastrar o funcionário.");

      setUsers((current) => [...current, result.user].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")));
      setCreateOpen(false);
      toast.success("Funcionário cadastrado com sucesso!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao cadastrar.");
    } finally {
      setCreating(false);
    }
  }

  function handleOpenEdit(user: User) {
    setEditUser(user);
    setEditForm({
      name: user.name,
      email: user.email || "",
      role: user.role,
      active: user.active,
    });
  }

  async function handleUpdate(event: React.FormEvent) {
    event.preventDefault();
    if (!editUser) return;
    const trimmedName = editForm.name.trim();
    if (!trimmedName) {
      toast.error("Informe o nome do funcionário.");
      return;
    }

    setUpdating(true);
    try {
      const response = await fetch("/api/usuarios", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editUser.id,
          name: trimmedName,
          email: editForm.email.trim() || null,
          role: editForm.role,
          active: editForm.active,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível salvar as alterações.");

      setUsers((current) =>
        current
          .map((item) => (item.id === editUser.id ? result.user : item))
          .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
      );
      setEditUser(null);
      toast.success("Dados do funcionário atualizados!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao atualizar.");
    } finally {
      setUpdating(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/usuarios?id=${deleteTarget.id}`, {
        method: "DELETE",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível excluir o funcionário.");

      setUsers((current) => current.filter((item) => item.id !== deleteTarget.id));
      setDeleteTarget(null);
      toast.success("Funcionário excluído do sistema.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao excluir.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
        <div className="flex items-start gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#09090b] text-white">
            <Users className="size-5" />
          </div>
          <div>
            <h2 className="font-semibold text-[#09090b]">Cadastro de Funcionários e Acessos</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Cadastre novos colaboradores, edite nomes, e-mails e perfis ou ative/desative acessos ao sistema.
            </p>
          </div>
        </div>
        <Button
          onClick={handleOpenCreate}
          className="bg-[#09090b] text-white hover:bg-[#27272a] self-start sm:self-center"
        >
          <UserPlus className="mr-1.5 size-4" />
          Novo Funcionário
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8 text-sm text-slate-500 gap-2">
          <Loader2 className="size-4 animate-spin text-slate-400" />
          Carregando funcionários...
        </div>
      ) : users.length === 0 ? (
        <div className="py-8 text-center text-sm text-slate-500">
          Nenhum funcionário cadastrado. Clique no botão acima para adicionar o primeiro.
        </div>
      ) : (
        <div className="mt-4 divide-y divide-slate-100">
          {users.map((user) => {
            const initials = user.name
              .split(" ")
              .filter(Boolean)
              .slice(0, 2)
              .map((p) => p[0])
              .join("")
              .toUpperCase();

            return (
              <div
                key={user.id}
                className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between hover:bg-[#fafaf8] px-2 rounded-lg transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="grid size-9 shrink-0 place-items-center rounded-full bg-[#09090b] text-xs font-semibold text-white">
                    {initials || "U"}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-slate-900 truncate">{user.name}</p>
                      {user.role === "admin" ? (
                        <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-[10px] py-0 px-2">
                          <Shield className="size-3 mr-0.5" /> Administrador
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-slate-600 text-[10px] py-0 px-2">
                          <UserIcon className="size-3 mr-0.5" /> Operador
                        </Badge>
                      )}
                      {user.active ? (
                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] py-0 px-2">
                          Acesso Ativo
                        </Badge>
                      ) : (
                        <Badge className="bg-slate-100 text-slate-500 border-slate-200 text-[10px] py-0 px-2">
                          Acesso Bloqueado
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">
                      {user.email ? (
                        user.email
                      ) : (
                        <span className="italic text-slate-400">Sem e-mail cadastrado (não pode logar)</span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1.5"
                    onClick={() => handleOpenEdit(user)}
                  >
                    <Pencil className="size-3.5" />
                    Editar
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-slate-400 hover:text-red-600 hover:bg-red-50"
                    onClick={() => setDeleteTarget(user)}
                    aria-label={`Excluir funcionário ${user.name}`}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Novo Funcionário */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleCreate}>
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-[#09090b]">
                Cadastrar Novo Funcionário
              </DialogTitle>
              <DialogDescription>
                Adicione um novo colaborador com permissão de acesso ao Sistema de Ofícios.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nome Completo <span className="text-red-500">*</span>
                </label>
                <Input
                  required
                  value={createForm.name}
                  onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Ex.: Maria Francisca de Souza"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  E-mail de Acesso
                </label>
                <Input
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="Ex.: maria@cartorio.com.br"
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  E-mail utilizado para entrar no sistema com autenticação por código.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Perfil de Permissão
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCreateForm((f) => ({ ...f, role: "operator" }))}
                    className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
                      createForm.role === "operator"
                        ? "border-[#09090b] bg-[#09090b]/5 ring-1 ring-[#09090b]"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-medium text-xs text-slate-800">
                      <UserIcon className="size-3.5 text-[#09090b]" /> Operador
                    </div>
                    <span className="mt-1 text-[11px] text-slate-500">
                      Emite ofícios, minutas e assina documentos.
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCreateForm((f) => ({ ...f, role: "admin" }))}
                    className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
                      createForm.role === "admin"
                        ? "border-amber-600 bg-amber-50 ring-1 ring-amber-600"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-medium text-xs text-amber-900">
                      <Shield className="size-3.5 text-amber-600" /> Administrador
                    </div>
                    <span className="mt-1 text-[11px] text-slate-500">
                      Acesso total, configurações e equipe.
                    </span>
                  </button>
                </div>
              </div>

              <div className="pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
                  <input
                    type="checkbox"
                    className="size-4 rounded border-slate-300 text-[#09090b] focus:ring-[#09090b]"
                    checked={createForm.active}
                    onChange={(e) => setCreateForm((f) => ({ ...f, active: e.target.checked }))}
                  />
                  <span>Liberar acesso ao sistema imediatamente</span>
                </label>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setCreateOpen(false)}
                disabled={creating}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={creating}
                className="bg-[#09090b] text-white hover:bg-[#27272a]"
              >
                {creating ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Check className="mr-1.5 size-4" />}
                Cadastrar Funcionário
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Editar Funcionário */}
      <Dialog open={Boolean(editUser)} onOpenChange={(open) => !open && setEditUser(null)}>
        <DialogContent className="sm:max-w-md">
          {editUser && (
            <form onSubmit={handleUpdate}>
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold text-[#09090b]">
                  Editar Funcionário
                </DialogTitle>
                <DialogDescription>
                  Altere os dados cadastrais, e-mail de login ou permissão do colaborador.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nome Completo <span className="text-red-500">*</span>
                  </label>
                  <Input
                    required
                    value={editForm.name}
                    onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Nome completo"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    E-mail de Acesso
                  </label>
                  <Input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="E-mail de acesso"
                  />
                  <p className="mt-1 text-[11px] text-slate-400">
                    Se alterado, eventuais sessões anteriores serão encerradas por segurança.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Perfil de Permissão
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setEditForm((f) => ({ ...f, role: "operator" }))}
                      className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
                        editForm.role === "operator"
                          ? "border-[#09090b] bg-[#09090b]/5 ring-1 ring-[#09090b]"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-medium text-xs text-slate-800">
                        <UserIcon className="size-3.5 text-[#09090b]" /> Operador
                      </div>
                      <span className="mt-1 text-[11px] text-slate-500">
                        Emite ofícios, minutas e assina documentos.
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setEditForm((f) => ({ ...f, role: "admin" }))}
                      className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
                        editForm.role === "admin"
                          ? "border-amber-600 bg-amber-50 ring-1 ring-amber-600"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-medium text-xs text-amber-900">
                        <Shield className="size-3.5 text-amber-600" /> Administrador
                      </div>
                      <span className="mt-1 text-[11px] text-slate-500">
                        Acesso total, configurações e equipe.
                      </span>
                    </button>
                  </div>
                </div>

                <div className="pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
                    <input
                      type="checkbox"
                      className="size-4 rounded border-slate-300 text-[#09090b] focus:ring-[#09090b]"
                      checked={editForm.active}
                      onChange={(e) => setEditForm((f) => ({ ...f, active: e.target.checked }))}
                    />
                    <span>Acesso liberado ao sistema</span>
                  </label>
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setEditUser(null)}
                  disabled={updating}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={updating}
                  className="bg-[#09090b] text-white hover:bg-[#27272a]"
                >
                  {updating ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Check className="mr-1.5 size-4" />}
                  Salvar Alterações
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal: Confirmar Exclusão */}
      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-red-700 flex items-center gap-2">
              <Trash2 className="size-5" /> Excluir Funcionário
            </DialogTitle>
            <DialogDescription className="pt-2 text-slate-600">
              Tem certeza que deseja remover o cadastro de{" "}
              <strong className="text-slate-900">{deleteTarget?.name}</strong>?
              <br />
              Esta ação removerá o acesso e invalidará quaisquer sessões ativas deste colaborador.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Trash2 className="mr-1.5 size-4" />}
              Excluir Funcionário
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

