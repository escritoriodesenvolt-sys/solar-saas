const express = require("express");
const axios = require("axios");
const cors = require("cors");
const cron = require("node-cron");

const app = express();
app.use(cors());
app.use(express.json());

// Banco em memória (MVP)
let usinas = [];
let geracoes = {};

// ================== GROWATT ==================

// Login no portal
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

// Buscar dados da usina
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

  for (let u of usinas) {
    if (u.portal === "growatt") {
      try {
        const cookie = await loginGrowatt(u.usuario, u.senha);
        const data = await getGrowattData(cookie);

        let geracao = data?.data?.[0]?.todayEnergy || 0;
        geracoes[u.nome] = geracao;

        // cálculo de performance
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

// roda automaticamente a cada 15 minutos
cron.schedule("*/15 * * * *", atualizarUsinas);

// ================== ROTAS ==================

// cadastrar usina
app.post("/usinas", (req, res) => {
  usinas.push(req.body);
  res.send("Usina cadastrada");
});

// buscar geração
app.get("/geracao", (req, res) => {
  res.json(geracoes);
});

// ================== START ==================

app.listen(process.env.PORT || 3000, () => {
  console.log("🚀 Servidor rodando");
});
