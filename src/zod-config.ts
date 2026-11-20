// Zod em modo `jitless`: sem `new Function`, para a CSP não precisar de 'unsafe-eval' (W0-03 §2.8).
// Tem de rodar antes de qualquer parse. Por isso é um módulo próprio, o PRIMEIRO import do main.tsx:
// os imports de ES módulos são avaliados na ordem em que aparecem e antes do corpo do arquivo, então
// uma chamada no corpo do main.tsx rodaria depois do catálogo e das telas já terem sido carregados.
import { z } from "zod";

z.config({ jitless: true });
