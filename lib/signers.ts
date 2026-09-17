export const signers = [
  { name: "Késsila Tayná Ambrózio da Silva", role: "Escrevente Autorizada" },
  { name: "Marcellus Mozart Silva Batista", role: "Oficial Substituto" },
  { name: "Altair Ferreira Thury Neto", role: "Escrevente Autorizado" },
  { name: "Lucas do Espírito Santo Ribeiro", role: "Escrevente Autorizado" },
  { name: "Gilvany dos Santos Thury", role: "Escrevente Autorizado" },
];

export function normalizedName(value: string) {
  return value.split(":")[0].normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toUpperCase();
}

export function sameSigner(left: string, right: string) {
  return Boolean(left.trim() && right.trim()) && normalizedName(left) === normalizedName(right);
}
