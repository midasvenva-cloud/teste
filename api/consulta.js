// ===== Config =====

// Headers padrão (como no PHP, com CORS liberado)
const defaultHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "X-Requested-With, Content-Type, X-API-Key, Authorization",
  "Content-Type": "application/json; charset=UTF-8",
};

// MESMO API_KEY do PHP
const API_KEY =
  "15962e353834cb3b85f4c24ba06715b54017d27888c976e3562c067760d6e042";

// ===== Funções equivalentes do PHP =====

// Ajuste este endpoint para o seu provedor real:
function provedor_url(cpf, tokenInQuery = false) {
  let base = "https://api.bluenext2.online/api/v1/cpf/" + cpf;
  if (tokenInQuery) {
    base += (base.includes("?") ? "&" : "?") + "token=" + encodeURIComponent(API_KEY);
  }
  return base;
}

// No lugar de arquivo, logs vão para console (logs da Vercel)
function log_line(msg) {
  console.log("[LOG]", msg);
}

function only_digits(s) {
  if (!s) return "";
  return String(s).replace(/\D+/g, "");
}

function normalize_payload(json) {
  let p;

  if (json && typeof json === "object") {
    if (Array.isArray(json.data)) {
      p = json.data;
    } else if (json.dados) {
      p = json.dados;
    } else {
      p = json;
    }
  } else {
    p = {};
  }

  // se vier array [ {...} ]
  if (Array.isArray(p)) {
    p = p[0] ?? {};
  }

  if (!p || typeof p !== "object") p = {};

  // MESMOS CAMPOS que seu PHP mandava:
  return {
    CPF: p.CPF ?? null,
    NOME: p.NOME ?? null,
    SEXO: p.SEXO ?? null,
    NASC: p.NASC ?? null,
    NOME_MAE: p.NOME_MAE ?? null,
    NOME_PAI: p.NOME_PAI ?? null,
  };
}

// ===== HANDLER DA API (equivale ao PHP final) =====

export default async function handler(req, res) {
  // Aplica headers padrão
  Object.keys(defaultHeaders).forEach((h) =>
    res.setHeader(h, defaultHeaders[h])
  );

  // Pré-flight CORS
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // pegar cpf (igual ao $_GET['cpf'] no PHP)
  const cpf_raw = req.query?.cpf || "";
  const cpf = only_digits(cpf_raw);

  if (cpf.length !== 11) {
    return res.status(400).json({
      statusCode: 400,
      error: "CPF inválido",
      data: null,
    });
  }

  log_line(`REQ cpf=${cpf}`);

  // Mesma lista de tentativas do PHP
  const attempts = [
    {
      name: "X-API-Key",
      headers: { Accept: "application/json", "X-API-Key": API_KEY },
      tokenInQuery: false,
    },
    {
      name: "Bearer",
      headers: {
        Accept: "application/json",
        Authorization: "Bearer " + API_KEY,
      },
      tokenInQuery: false,
    },
    {
      name: "AuthorizationToken",
      headers: {
        Accept: "application/json",
        Authorization: "Token " + API_KEY,
      },
      tokenInQuery: false,
    },
    {
      name: "QueryToken",
      headers: { Accept: "application/json" },
      tokenInQuery: true,
    },
  ];

  let lastHttp = 0;
  let lastBody = null;

  for (const auth of attempts) {
    const url = provedor_url(cpf, auth.tokenInQuery);

    try {
      const resp = await fetch(url, {
        method: "GET",
        headers: auth.headers,
        redirect: "follow",
      });

      const code = resp.status;
      const body = await resp.text();

      log_line(`TRY ${auth.name} -> URL=${url} CODE=${code}`);
      log_line(`RESP ${auth.name} -> ${body?.substring(0, 500)}`);

      lastHttp = code || 0;
      lastBody = body;

      if (body) {
        let dec = null;
        try {
          dec = JSON.parse(body);
        } catch {
          const clean = body.replace(/^\uFEFF/, "");
          try {
            dec = JSON.parse(clean);
          } catch {
            dec = null;
          }
        }

        if (dec && typeof dec === "object") {
          const payload = normalize_payload(dec);
          const hasData =
            payload.CPF || payload.NOME || payload.SEXO || payload.NASC;

          // MESMA REGRA: sucesso com 200–299 OU quando já tem dados
          if ((code >= 200 && code < 300) || hasData) {
            return res.status(200).json({
              statusCode: code || 200,
              data: payload, // <-- IGUAL ao PHP
            });
          }
        }
      }

      // se 401/403, tenta próxima estratégia
      if (code === 401 || code === 403) continue;
    } catch (err) {
      log_line(`ERROR ${auth.name} -> ${err.message}`);
      continue;
    }
  }

  // Se chegou aqui, falhou todas as tentativas
  const status = lastHttp || 401;

  return res.status(status).json({
    statusCode: status,
    data: {
      CPF: null,
      NOME: null,
      SEXO: null,
      NASC: null,
      NOME_MAE: null,
      NOME_PAI: null,
    },
  });
}
