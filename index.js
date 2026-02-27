import express from "express";

const app = express();
app.use(express.json());

// ====== CONFIG ======
// Coloque aqui um pedaço do nome do grupo (ou o nome exato)
// Exemplo: ["Corridas Centro", "Gessi"] etc
const ALLOWED_GROUP_MATCH = ["NOME_DO_SEU_GRUPO_AQUI"];

// mensagem que vai enviar
const REPLY_TEXT = "Oi";

// anti-duplicação só pra matar bug de notificação duplicada
const DUP_MS = 1000; // 1 segundo

// ====== MEMÓRIA ======
// chatKey -> { dayKey, usedToday, manualCredits, lastTs }
const state = new Map();

// guarda a última conversa recebida (pra você descobrir o id/nome do grupo)
let lastSeen = null;

function dayKeyBR() {
  const now = new Date(Date.now() - 3 * 60 * 60 * 1000); // UTC-3
  return now.toISOString().slice(0, 10);
}

function normalize(s) {
  return (s || "").toString().toLowerCase();
}

// tenta pegar algum identificador do chat/grupo do payload do Auto Reply
function getChatKey(body) {
  return (
    body.chatId ||
    body.groupId ||
    body.conversationId ||
    body.threadId ||
    body.chat ||
    body.title ||        // às vezes vem título do grupo
    body.groupName ||    // às vezes vem nome do grupo
    "unknown"
  );
}

// tenta pegar um texto “humano” do grupo pra match
function getChatLabel(body) {
  return (
    body.title ||
    body.groupName ||
    body.chatName ||
    body.conversationName ||
    body.chatId ||
    body.groupId ||
    ""
  );
}

function isAllowedGroup(body) {
  const label = normalize(getChatLabel(body));
  const key = normalize(getChatKey(body));

  return ALLOWED_GROUP_MATCH.some((m) => {
    const mm = normalize(m);
    return mm && (label.includes(mm) || key.includes(mm));
  });
}

// endpoint que o Auto Reply chama
app.post("/reply", (req, res) => {
  const body = req.body || {};
  const chatKey = String(getChatKey(body));
  const chatLabel = String(getChatLabel(body));
  const now = Date.now();
  const today = dayKeyBR();

  lastSeen = { at: new Date().toISOString(), chatKey, chatLabel, body };

  // só responde no grupo permitido
  if (!isAllowedGroup(body)) {
    return res.json({ reply: "" });
  }

  const s = state.get(chatKey) || {
    dayKey: today,
    usedToday: 0,
    manualCredits: 0,
    lastTs: 0,
  };

  // virou o dia -> reseta
  if (s.dayKey !== today) {
    s.dayKey = today;
    s.usedToday = 0;
    s.manualCredits = 0;
    s.lastTs = 0;
  }

  // anti-duplicação (notificação duplicada)
  if (now - s.lastTs < DUP_MS) {
    return res.json({ reply: "" });
  }
  s.lastTs = now;

  // regra: 1 por dia + liberações manuais
  const allowed = (s.usedToday === 0) || (s.manualCredits > 0);

  if (!allowed) {
    state.set(chatKey, s);
    return res.json({ reply: "" });
  }

  // consome o “dia” ou o crédito
  if (s.usedToday === 0) s.usedToday = 1;
  else s.manualCredits -= 1;

  state.set(chatKey, s);
  return res.json({ reply: REPLY_TEXT });
});

// ✅ liberar manualmente +1 resposta extra HOJE (pro mesmo grupo)
app.get("/unlock", (req, res) => {
  const chatKey = req.query.chatKey;
  if (!chatKey) return res.status(400).send("Faltou chatKey");

  const today = dayKeyBR();
  const s = state.get(String(chatKey)) || {
    dayKey: today,
    usedToday: 0,
    manualCredits: 0,
    lastTs: 0,
  };

  if (s.dayKey !== today) {
    s.dayKey = today;
    s.usedToday = 0;
    s.manualCredits = 0;
    s.lastTs = 0;
  }

  s.manualCredits += 1;
  state.set(String(chatKey), s);

  res.send(`OK: liberado +1 para chatKey=${chatKey}. Créditos hoje: ${s.manualCredits}`);
});

// ✅ ver qual chat/grupo chegou por último (pra você descobrir o chatKey certo)
app.get("/last", (req, res) => {
  res.json(lastSeen || { msg: "Ainda não recebi nenhuma mensagem." });
});

const ALLOWED_GROUP_MATCH = ["Teste];
app.listen(PORT, () => console.log("Server running on", PORT));  const s = state.get(chatId) || {
    dayKey: today,
    usedToday: 0,
    manualCredits: 0,
    lastTs: 0,
  };

  // reset ao virar o dia
  if (s.dayKey !== today) {
    s.dayKey = today;
    s.usedToday = 0;
    s.manualCredits = 0;
    s.lastTs = 0;
  }

  // anti-duplicação (mata notificações duplicadas)
  if (now - s.lastTs < DUP_MS) {
    return res.json({ reply: "" });
  }
  s.lastTs = now;

  // regra: 1 por dia + créditos manuais
  const allowed = (s.usedToday === 0) || (s.manualCredits > 0);

  if (!allowed) {
    state.set(chatId, s);
    return res.json({ reply: "" });
  }

  // consome o “dia” ou o crédito manual
  if (s.usedToday === 0) {
    s.usedToday = 1;
  } else if (s.manualCredits > 0) {
    s.manualCredits -= 1;
  }

  state.set(chatId, s);
  return res.json({ reply: REPLY_TEXT });
});

// ✅ Link/manual: você chama isso pra liberar +1 resposta extra naquele grupo
// Exemplo: https://SEU-SERVIDOR.onrender.com/unlock?chatId=Teste
app.get("/unlock", (req, res) => {
  const chatId = req.query.chatId;
  if (!chatId) return res.status(400).send("Faltou chatId");

  const today = dayKeyBR();
  const s = state.get(chatId) || { dayKey: today, usedToday: 0, manualCredits: 0, lastTs: 0 };

  if (s.dayKey !== today) {
    s.dayKey = today;
    s.usedToday = 0;
    s.manualCredits = 0;
    s.lastTs = 0;
  }

  s.manualCredits += 1;
  state.set(chatId, s);
  return res.send(`OK: liberado +1 para chatId=${chatId}. Créditos hoje: ${s.manualCredits}`);
});

app.listen(3000, () => console.log("Server running on 3000"));
