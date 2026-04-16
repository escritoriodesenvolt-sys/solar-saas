const express = require("express");
const axios = require("axios");
const cors = require("cors");
const cron = require("node-cron");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(cors());
app.use(express.json());

// ================== SUPABASE ==================

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// ================== MEMÓRIA (APENAS CACHE) ==================

let geracoes = {};

// ================== GROWATT ==================

async function loginGrowatt(usuario, senha) {
  const response = await axios.post(
    "https://server.growatt.com/LoginAPI.do",
    new URLSearchParams({
      userName: usuario,
      password: senha
    })
  );

  return response.headers["set-cookie"];
}

async function getGrowattData(cookie) {
  const response = await axios.get(
    "https://server.growatt.com/PlantListAPI.do",
    {
      headers: { Cookie: cookie }
    }
  );

  return response.data;
}

// ================== PROCESSAMENTO ==================

async function atualizarUsinas() {
  console.log("🔄 Atualizando usinas...");

  const { data: usinas, error } = await supabase
    .from("usinas")
    .select("*");

  if (error) {
    console.log("❌ Erro ao buscar usinas");
    return;
  }

  for (let u of usinas) {
    if (u.portal === "growatt") {
      try {
        const cookie = await loginGrowatt(u.usuario, u.senha);
        const data = await getGrowattData(cookie);

        let geracao = data?.data?.[0]?.todayEnergy || 0;

        geracoes[u.nome] = geracao;

        let esperado = u.pot * 4.5;
        let performance = (geracao / esperado) * 100;

        if (performance < 80) {
          geracoes[u.nome + "_alerta"] = "⚠ Baixa geração";
        }

        console.log(`✅ ${u.nome}: ${geracao} kWh`);
      } catch (error) {
        console.log(`❌ Erro na usina ${u.nome}`);
      }
    }
  }
}

// roda a cada 15 min
cron.schedule("*/15 * * * *", atualizarUsinas);

// ================== ROTAS ==================

// 🔹 TESTE
app.get("/", (req, res) => {
  res.send("API OK 🚀");
});

// 🔹 CRIAR USINA
app.post("/usinas", async (req, res) => {
  const { data, error } = await supabase
    .from("usinas")
    .insert([req.body]);

  if (error) return res.status(500).json(error);

  res.json(data);
});

// 🔹 LISTAR USINAS
app.get("/usinas", async (req, res) => {
  const { data, error } = await supabase
    .from("usinas")
    .select("*");

  if (error) return res.status(500).json(error);

  res.json(data);
});

// 🔹 GERAÇÃO (CACHE)
app.get("/geracao", (req, res) => {
  res.json(geracoes);
});

// ================== START ==================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 Servidor rodando");
});
