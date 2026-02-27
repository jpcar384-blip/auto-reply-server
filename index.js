import express from "express";

const app = express();
app.use(express.json());

// ====== CONFIG ======
const REPLY_TEXT = "Oi";
const DUP_MS = 1000; // anti-duplicação ultra curta (1s) p/ bug de notificação

// ====== MEMÓRIA (simples) ======
// chatId -> { dayKey: "YYYY-MM-DD", usedToday: number, manualCredits: number, lastTs: number }
const state = new Map();

function dayKeyBR() {
  // usa UTC-3 aproximado (Brasil). Para produção, use lib de timezone.
  const now = new Date(Date.now() - 3 * 60 * 60 * 1000);
  return now.toISOString().slice(0, 10);
}

function getChatId(body) {
  return (
    body.chatId ||
    body.groupId ||
    body.conversationId ||
    body.chat ||
    body.threadId ||
    "unknown"
  );
}

// Endpoint que o Auto Reply vai chamar
app.post("/reply", (req, res) => {
  const chatId = getChatId(req.body);
  const now = Date.now();
  const today = dayKeyBR();

  const s = state.get(chatId) || {
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
