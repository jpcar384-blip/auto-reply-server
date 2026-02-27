import express from "express";

const app = express();
app.use(express.json());

const lastReply = new Map();

app.post("/reply", (req, res) => {
  const chatId = req.body.chatId || "default";
  const now = Date.now();
  const last = lastReply.get(chatId) || 0;

  // bloqueio anti-duplicação 5 segundos
  if (now - last < 5000) {
    return res.json({ reply: "" });
  }

  lastReply.set(chatId, now);

  return res.json({ reply: "Oi" });
});

app.listen(3000, () => console.log("Server running"));
