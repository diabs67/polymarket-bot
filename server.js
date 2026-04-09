import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());
app.use(express.static("public"));

let balance = 1000;
let positions = [];
let logs = [];

function log(msg) {
  const line = `[${new Date().toLocaleTimeString()}] ${msg}`;
  logs.unshift(line);
  logs = logs.slice(0, 50);
}

async function fetchMarkets() {
  try {
    const res = await fetch("https://gamma-api.polymarket.com/markets");
    const data = await res.json();
    return data.slice(0, 20);
  } catch {
    return [];
  }
}

function openPosition(m) {
  const size = 50;

  const pos = {
    id: Date.now(),
    question: m.question,
    entry: m.prices?.[0] || 0.5,
    size,
    pnl: 0
  };

  positions.push(pos);
  balance -= size;

  log("OPEN | " + m.question);
}

function updatePositions(markets) {
  positions.forEach(p => {
    const m = markets.find(x => x.question === p.question);
    if (!m) return;

    const price = m.prices?.[0] || 0.5;
    p.pnl = (price - p.entry) * p.size;

    if (Math.abs(p.pnl) > 10) {
      balance += p.size + p.pnl;
      log("CLOSE | " + p.question + " PnL: " + p.pnl.toFixed(2));
      positions = positions.filter(x => x.id !== p.id);
    }
  });
}

let running = false;

async function loop() {
  if (!running) return;

  const markets = await fetchMarkets();

  for (let m of markets) {
    if (Math.random() > 0.8) openPosition(m);
  }

  updatePositions(markets);

  setTimeout(loop, 5000);
}

app.get("/status", (req, res) => {
  res.json({
    balance,
    positions,
    logs
  });
});

app.post("/start", (req, res) => {
  running = true;
  loop();
  res.send("started");
});

app.post("/stop", (req, res) => {
  running = false;
  res.send("stopped");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Running on " + PORT));
