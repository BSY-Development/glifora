// Tabela de testes da D-43 (obrigatória) e os casos portados do match.ts do arquivo comercial (D-38).
import { describe, expect, it } from "vitest";
import { checkClosingAnswer, closingTargets, contentWords, matchReply, MAX_UTTERANCE, normalize, type MatchableReply } from "./match";

const en = (s: string) => normalize(s, "en");

/** Resposta de teste. */
const r = (text: string, keywords?: string[][], flawed = false): MatchableReply => ({ text, keywords, flawed });
/** Índice da resposta casada, ou null. */
const pick = (replies: readonly MatchableReply[], said: string | readonly string[]) => matchReply(replies, said, "en")?.index ?? null;

// ---------------------------------------------------------------- normalização

describe("normalize: maiúsculas, acentos, pontuação e espaços", () => {
  it.each([
    ["HONEY ROLL", "honey roll"],
    ["Honey Roll!!!", "honey roll"],
    ["  honey,   roll…  ", "honey roll"],
    ["honey-roll", "honey roll"],
    ["Café crème brûlée", "cafe creme brulee"],
    ["Pão de queijo", "pao de queijo"],
    ["¿Qué?", "que"],
    ["?!", ""],
    ["", ""],
  ])("%j → %j", (input, out) => expect(en(input)).toBe(out));

  it("apóstrofos tipográficos viram o comum antes das contrações", () => {
    for (const apos of ["’", "‘", "´", "`", "ʼ"]) expect(en(`I${apos}m here`)).toBe("i am here");
  });
});

describe("normalize: contrações com e sem apóstrofo (D-43)", () => {
  it.each([
    ["I'm", "Im", "i am"],
    ["you're", "youre", "you are"],
    ["they're", "theyre", "they are"],
    ["I've", "Ive", "i have"],
    ["we've", "weve", "we have"],
    ["I'd", "Id", "i would"],
    ["you'll", "youll", "you will"],
    ["it's", "its", "it is"],
    ["he's", "hes", "he is"],
    ["she's", "shes", "she is"],
    ["that's", "thats", "that is"],
    ["what's", "whats", "what is"],
    ["where's", "wheres", "where is"],
    ["there's", "theres", "there is"],
    ["don't", "dont", "do not"],
    ["doesn't", "doesnt", "does not"],
    ["didn't", "didnt", "did not"],
    ["isn't", "isnt", "is not"],
    ["aren't", "arent", "are not"],
    ["wasn't", "wasnt", "was not"],
    ["haven't", "havent", "have not"],
    ["won't", "wont", "will not"],
    ["wouldn't", "wouldnt", "would not"],
    ["couldn't", "couldnt", "could not"],
    ["can't", "cant", "can not"],
  ])("%s = %s = %s", (withApos, without, full) => {
    expect(en(withApos)).toBe(full);
    expect(en(without)).toBe(full);
    expect(en(full)).toBe(full);
  });

  it('"cannot", "can not" e "can\'t" ficam iguais', () => {
    expect(en("I cannot")).toBe("i can not");
    expect(en("I can not")).toBe("i can not");
    expect(en("I can't")).toBe("i can not");
  });

  it('"\'s" só se expande depois de pronome ou palavra interrogativa: o possessivo não muda', () => {
    expect(en("Tilda's bread")).toBe("tildas bread");
    expect(en("the baker's cat")).toBe("the bakers cat");
    expect(en("How's it going?")).toBe("how is it going");
    expect(en("Who's there?")).toBe("who is there");
  });

  it("contração ambígua sem apóstrofo fica como palavra", () => {
    expect(en("we were here")).toBe("we were here"); // were ≠ we're
    expect(en("I feel ill")).toBe("i feel ill"); // ill ≠ I'll
    expect(en("very well")).toBe("very well"); // well ≠ we'll
    expect(en("we're")).toBe("we are");
    expect(en("I'll")).toBe("i will");
  });
});

describe("normalize: números por extenso ou em dígito", () => {
  it.each([
    ["2 rolls", "two rolls"],
    ["two rolls", "two rolls"],
    ["0", "zero"],
    ["12", "twelve"],
    ["20", "twenty"],
    ["21", "twenty one"],
    ["twenty-one", "twenty one"],
    ["99", "ninety nine"],
    ["100", "100"],
    ["05", "five"],
  ])("%j → %j", (input, out) => expect(en(input)).toBe(out));

  it("espanhol e português, com gênero e grafia dobrados", () => {
    expect(normalize("2 cafés", "es")).toBe("dos cafes");
    expect(normalize("una mesa, 1 silla", "es")).toBe("uno mesa uno silla");
    expect(normalize("31", "es")).toBe("treinta y uno");
    expect(normalize("duas", "pt-BR")).toBe(normalize("2", "pt-BR"));
    expect(normalize("quatorze", "pt-BR")).toBe(normalize("14", "pt-BR"));
    expect(normalize("vinte e uma", "pt-BR")).toBe(normalize("21", "pt-BR"));
  });

  it("casos do arquivo comercial, na forma nova", () => {
    expect(en("I'd like TWO rolls!")).toBe("i would like two rolls");
    expect(en("  2 honey-rolls, please… ")).toBe("two honey rolls please");
    expect(en("That’s all.")).toBe("that is all");
    expect(en("20 or 21")).toBe("twenty or twenty one");
  });
});

// ---------------------------------------------------------------- casamento

/** A padaria do arquivo comercial (passo "honey": quantos?). */
const howMany = [r("Just one, please.", [["one"], ["won"]]), r("Two honey rolls, please.", [["two"], ["to"], ["too"]])];
/** Passo "price-two": despedida. */
const bye = [
  r("Thank you! Bye!", [["thank", "bye"], ["thanks", "bye"], ["bye"], ["goodbye"], ["thank"], ["thanks"]]),
  r("Thanks! See you tomorrow.", [["see you", "tomorrow"], ["see you"], ["tomorrow"]]),
];
/** Pedido com resposta boa e resposta com erro previsto. */
const order = [
  r("Two rolls, please.", [["two", "rolls"]]),
  r("Two roll, please.", [["two", "roll"]], true),
];

describe("matchReply: regra mantida do arquivo comercial", () => {
  it("fala livre cai na resposta certa; empate e nada → null", () => {
    expect(pick(howMany, "two please")).toBe(1);
    expect(pick(howMany, "2")).toBe(1);
    expect(pick(howMany, "I want to")).toBe(1); // homófono do reconhecedor
    expect(pick(howMany, "uh, just one")).toBe(0);
    expect(pick(howMany, "one or two?")).toBeNull(); // empate entre boas
    expect(pick(howMany, "bread")).toBeNull();
    expect(pick(howMany, "")).toBeNull();
    expect(pick(howMany, "?!")).toBeNull();
  });

  it("a alternativa mais longa vence", () => {
    expect(pick(bye, "thank you, see you tomorrow")).toBe(1);
    expect(pick(bye, "thanks bye")).toBe(0);
  });

  it("expressão de várias palavras tem de vir junta e na ordem", () => {
    const replies = [r("How much is it?", [["how much"]]), r("No, thanks.", [["no"]])];
    expect(pick(replies, "No thanks, how much is it?")).toBe(0); // how much (2) > no (1)
    expect(pick(replies, "much how")).toBeNull();
  });
});

describe("matchReply: maiúsculas, acentos e pontuação não fazem errar", () => {
  it.each(["TWO ROLLS", "two rolls!!!", "Two... rolls?", "twó rólls", "  two   rolls  "])("%j", (said) => {
    expect(pick(order, said)).toBe(0);
  });
});

describe("matchReply: contrações casam com e sem apóstrofo", () => {
  const replies = [r("I'm new here.", [["i am", "new"]]), r("I don't know.", [["do not", "know"]])];
  it.each([
    ["I'm new", 0],
    ["Im new", 0],
    ["I am new", 0],
    ["I’m new", 0],
    ["I don't know", 1],
    ["I dont know", 1],
    ["I do not know", 1],
  ])("%j → %i", (said, idx) => expect(pick(replies, said)).toBe(idx));

  it("palavra-chave escrita contraída também casa com a forma longa", () => {
    const contracted = [r("I'd like tea.", [["i'd like"]]), r("No.", [["no"]])];
    expect(pick(contracted, "I would like some tea")).toBe(0);
    expect(pick(contracted, "id like tea")).toBe(0);
  });
});

describe("matchReply: erro de digitação (passe tolerante)", () => {
  const menu = [r("A cheese roll, please.", [["cheese"]]), r("Some chocolate, please.", [["chocolate"]]), r("Tea.", [["tea"]])];
  it.each([
    ["chese", 0, "1 letra a menos em palavra de 6"],
    ["cheeze", 0, "1 letra trocada"],
    ["cheesse", 0, "1 letra a mais"],
    ["cheees", 0, "letras vizinhas invertidas contam 1"],
    ["chocolat", 1, "1 letra em palavra de 9"],
    ["chocolote", 1, "1 letra trocada em palavra de 9"],
    ["choclat", 1, "2 letras em palavra de 9"],
  ])("%j → %i (%s)", (said, idx) => expect(pick(menu, said)).toBe(idx));

  it.each([
    ["chz", "3 letras de distância"],
    ["chosse", "2 letras em palavra de 6"],
    ["chcolt", "3 letras em palavra de 9"],
    ["tee", "palavra de 3 letras precisa ser exata"],
    ["te", "palavra de 3 letras precisa ser exata"],
  ])("%j não casa (%s)", (said) => expect(pick(menu, said)).toBeNull());

  it("informa o passe", () => {
    expect(matchReply(menu, "cheese", "en")?.pass).toBe("exact");
    expect(matchReply(menu, "chese", "en")?.pass).toBe("fuzzy");
  });

  it("vale também para expressões de várias palavras", () => {
    const replies = [r("See you tomorrow!", [["see you", "tomorrow"]]), r("Bye.", [["bye"]])];
    expect(pick(replies, "see you tomorow")).toBe(0);
  });
});

describe('matchReply: "roll" × "rolls" — a tolerância nunca leva para a resposta com erro', () => {
  it.each([
    ["two rolls", 0, "a boa, exata"],
    ["two roll", 1, "a com erro, exata"],
    ["2 roll please", 1, "a com erro, com dígito"],
    ["two rols", 0, "erro de digitação vai para a boa"],
    ["two rollz", 0, "erro de digitação vai para a boa"],
    ["two rull", null, "a 1 letra da com erro: não casa"],
  ])("%j → %s (%s)", (said, idx, why) => expect(pick(order, said), why).toBe(idx));

  it("a resposta com erro sozinha não casa por tolerância", () => {
    const onlyFlawedNear = [r("Bye.", [["bye"]]), r("Two breads.", [["breads"]], true)];
    expect(pick(onlyFlawedNear, "two breads")).toBe(1);
    expect(pick(onlyFlawedNear, "two breadz")).toBeNull();
  });
});

describe("matchReply: empates (D-43)", () => {
  it("boa × com erro com os mesmos pontos → a boa", () => {
    const replies = [r("A loaf of bread.", [["bread"]]), r("Two breads.", [["breads"]], true), r("One bread.", [["one"]], true)];
    expect(pick(replies, "one bread")).toBe(0);
    const tied = [r("Two loaves.", [["two"]]), r("Two breads.", [["two"]], true)];
    expect(pick(tied, "two")).toBe(0);
  });

  it("com erro com mais pontos vence a boa", () => {
    const replies = [r("Bread, please.", [["bread"]]), r("Two breads.", [["two", "breads"]], true)];
    expect(pick(replies, "two breads bread")).toBe(1);
  });

  it("empate entre duas boas → null; empate entre duas boas e uma com erro → null", () => {
    expect(pick(howMany, "one two")).toBeNull();
    const replies = [...howMany, r("Three.", [["one"]], true)];
    expect(pick(replies, "one two")).toBeNull();
  });

  it("empate só entre respostas com erro → null", () => {
    const replies = [r("Fine.", [["fine"]]), r("Two breads.", [["breads"]], true), r("A breads.", [["breads"]], true)];
    expect(pick(replies, "breads")).toBeNull();
  });
});

describe("matchReply: sem keywords, 60% das palavras de conteúdo (fábrica)", () => {
  const replies = [r("I'd like two loaves of bread, please."), r("I want two breads.", undefined, true), r("Do you have any honey cake?")];

  it("conta só as palavras de conteúdo", () => {
    expect(contentWords("I'd like two loaves of bread, please.", "en")).toEqual(["like", "two", "loaves", "bread"]);
    expect(contentWords("Yes, please.", "en")).toEqual(["yes"]);
    expect(contentWords("Is it?", "en")).toEqual(["is", "it"]); // só palavra vazia: fica tudo
  });

  it.each([
    ["two loaves of bread", 0, "3 de 4 (75%)"],
    ["I want two breads", 1, "a com erro, exata"],
    ["honey cake please", 2, "2 de 3 (67%)"],
    ["cake", null, "1 de 3 (33%)"],
    ["two loaves", null, "2 de 4 (50%)"],
  ])("%j → %s (%s)", (said, idx, why) => expect(pick(replies, said), why).toBe(idx));

  it("tolerância a erro de digitação também vale aqui, só para as boas", () => {
    expect(pick(replies, "honey cak")).toBe(2);
  });
});

describe("matchReply: alternativas do reconhecedor de voz em ordem", () => {
  it("fica a primeira alternativa que casa", () => {
    const m = matchReply(howMany, ["won't", "one", "two"], "en");
    expect(m?.index).toBe(0);
    expect(m?.alternative).toBe(1);
  });

  it("a primeira que casar vence, mesmo que outra mais abaixo também case", () => {
    expect(pick(howMany, ["two please", "one please"])).toBe(1);
    expect(pick(howMany, ["one please", "two please"])).toBe(0);
  });

  it("alternativa ambígua não vale; segue para a próxima", () => {
    const m = matchReply(howMany, ["one or two", "just one"], "en");
    expect(m?.index).toBe(0);
    expect(m?.alternative).toBe(1);
  });

  it("nenhuma casa, ou lista vazia → null", () => {
    expect(pick(howMany, ["bread", "butter"])).toBeNull();
    expect(pick(howMany, [])).toBeNull();
  });

  it("olha só os primeiros MAX_UTTERANCE caracteres (texto colado enorme não trava)", () => {
    expect(pick(howMany, "one " + "x".repeat(MAX_UTTERANCE))).toBe(0);
    expect(pick(howMany, "x".repeat(MAX_UTTERANCE) + " one")).toBeNull();
    expect(pick(howMany, "chocolat ".repeat(200_000))).toBeNull();
  });

  it("devolve a própria resposta", () => {
    expect(matchReply(howMany, "two", "en")?.reply).toBe(howMany[1]);
  });
});

// ---------------------------------------------------------------- fecho

describe("checkClosingAnswer: pelo menos uma palavra-alvo, nada mais (D-43, garantia 2)", () => {
  const targets = ["honey", "cheese", "roll", "bread", "loaf", "pie", "hot chocolate"];
  const ok = (s: string | readonly string[]) => checkClosingAnswer(targets, s, "en").accepted;

  it.each([
    "I'd like two cheese rolls, please.",
    "CHEESE ROLLS!!",
    "cheese", // uma palavra basta: sem mínimo de palavras
    "bread want I", // sem gramática
    "A slice of pie.",
    "Some hot chocolate, please.",
    "chese", // erro de digitação
    "3 honey roles", // homófono do reconhecedor e dígito
    "id like to cheese rolls",
  ])("aceita %j", (s) => expect(ok(s)).toBe(true));

  it.each(["Coffee, please.", "Yes.", "Pão de queijo, por favor.", "I don't know.", "Thank you, bye!", "pi", ""])(
    "recusa %j",
    (s) => expect(ok(s)).toBe(false),
  );

  it("expressão-alvo tem de vir inteira: \"chocolate\" sozinho não é \"hot chocolate\"", () => {
    expect(ok("chocolate")).toBe(false);
    expect(ok("hot chocolate")).toBe(true);
  });

  it("diz qual palavra-alvo casou e em que passe", () => {
    expect(checkClosingAnswer(targets, "Two loaves of bread", "en")).toEqual({ accepted: true, matched: "bread", pass: "exact", alternative: 0 });
    expect(checkClosingAnswer(targets, "honney", "en")).toMatchObject({ accepted: true, matched: "honey", pass: "fuzzy" });
    expect(checkClosingAnswer(targets, "nothing", "en")).toEqual({ accepted: false, matched: null, pass: null, alternative: null });
  });

  it("alternativas do reconhecedor: o passe exato de qualquer uma vem antes do tolerante", () => {
    expect(checkClosingAnswer(targets, ["chese", "cheese"], "en")).toMatchObject({ matched: "cheese", pass: "exact", alternative: 1 });
    expect(ok(["coffee", "a pie"])).toBe(true);
  });
});

describe("closingTargets", () => {
  it("usa target_words quando há", () => {
    expect(closingTargets({ target: "en", closing: { target_words: ["roll"] }, vocabulary: [{ term: "a loaf of bread" }] })).toEqual(["roll"]);
  });

  it("sem target_words, usa as palavras de conteúdo do vocabulário", () => {
    const m = { target: "en" as const, closing: {}, vocabulary: [{ term: "a loaf of bread" }, { term: "the bread" }, { term: "hot chocolate" }] };
    expect(closingTargets(m)).toEqual(["loaf", "bread", "hot", "chocolate"]);
  });
});

// ---------------------------------------------------------------- resposta livre (D-51)

describe("matchReply: resposta livre para nome (D-51)", () => {
  const name = [
    { text: "I'm Alex.", keywords: [["i am"]], free: "name" as const },
    { text: "My name is Alex. Nice to meet you!", keywords: [["my name"], ["name is"], ["nice to meet"], ["call me"]] },
    { text: "I am call Alex.", keywords: [["i am call"]], flawed: true },
  ];
  const at = (said: string | readonly string[]) => matchReply(name, said, "en");

  it.each([
    ["Maria", 0, "free"],
    ["Ana Clara", 0, "free"],
    ["Maria da Silva", 0, "free"],
    ["Sou o João", 0, "free"], // 3 palavras: aceita (o jogo não confere idioma num nome)
    ["I'm Maria", 0, "exact"], // o casamento normal vem antes
    ["My name is Maria", 1, "exact"],
    ["Call me Bia", 1, "exact"],
    ["I am call Maria", 2, "exact"], // a com erro continua valendo
  ])("%j → %i (%s)", (said, idx, pass) => {
    expect(at(said)?.index).toBe(idx);
    expect(at(said)?.pass).toBe(pass);
  });

  it.each([
    ["Maria Clara da Silva", "4 palavras"],
    ["I would really like a cheese roll", "frase longa sem keyword"],
    ["", "vazio"],
    ["?!", "só pontuação"],
  ])("%j → null (%s)", (said) => expect(at(said)).toBeNull());

  it.each([
    ["Sorry?", "não entendeu"],
    ["What?", "não entendeu"],
    ["Pardon me", "não entendeu"],
    ["Repeat, please", "pede para repetir"],
    ["Sorry, what?", "não entendeu"],
    ["Yes", "não é nome"],
    ["No", "não é nome"],
    ["Hello", "cumprimento"],
    ["Thank you", "agradecimento"],
    ["Um, uh huh", "hesitação"],
    ["Don't know", "não sabe"],
  ])("%j não vira nome (%s)", (said) => expect(at(said)).toBeNull());

  it("nomes que parecem palavras comuns continuam aceitos", () => {
    for (const n of ["Will", "Grace", "Hope", "Joy", "May", "Rosa Maria"]) expect(at(n)?.pass, n).toBe("free");
  });

  it("voz: alternativa que não é nome é pulada na resposta livre", () => {
    expect(at(["the", "Maria"])).toMatchObject({ index: 0, pass: "free", alternative: 1 });
    expect(at(["sorry", "what"])).toBeNull();
  });

  it("conta palavras depois da normalização: contração expande, dígito vira palavra", () => {
    expect(at("Mary-Jo")?.pass).toBe("free"); // "mary jo": 2
    expect(at("Bob's cat")?.pass).toBe("free"); // "bobs cat": 2
    expect(at("Bob 21")?.pass).toBe("free"); // "bob twenty one": 3
    expect(at("Bob 22 Lee")).toBeNull(); // "bob twenty two lee": 4
  });

  it("empate no casamento normal não abre a resposta livre", () => {
    const tied = [
      { text: "I'm Alex.", keywords: [["alex"]], free: "name" as const },
      { text: "Alex here.", keywords: [["here"]] },
    ];
    expect(matchReply(tied, "Alex here", "en")).toBeNull(); // empate entre boas
  });

  it("voz: o casamento normal de qualquer alternativa vem antes da resposta livre", () => {
    expect(at(["Maria", "my name is Maria"])).toMatchObject({ index: 1, pass: "exact", alternative: 1 });
    expect(at(["Maria Clara da Silva", "Maria"])).toMatchObject({ index: 0, pass: "free", alternative: 1 });
  });

  it("sem resposta livre na fala, fala curta que não casa continua null", () => {
    expect(matchReply(name.slice(1), "Maria", "en")).toBeNull();
  });

  it("resposta livre marcada como flawed é ignorada (o schema recusa)", () => {
    const bad = [{ text: "X.", keywords: [["zzz"]], flawed: true, free: "name" as const }, { text: "Hi.", keywords: [["hi"]] }];
    expect(matchReply(bad, "Maria", "en")).toBeNull();
  });
});
