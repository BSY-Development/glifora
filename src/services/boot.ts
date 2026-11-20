// O que roda antes da primeira tela: abrir o banco e alinhar o idioma. Só a falha ao abrir o banco mostra a tela de erro de armazenamento.
import { startLocaleMirror, syncLocaleOnBoot } from "./locale";
import { openStorage } from "./storage";

export async function boot(): Promise<void> {
  await openStorage();
  await syncLocaleOnBoot(); // nunca rejeita
  startLocaleMirror();
}
