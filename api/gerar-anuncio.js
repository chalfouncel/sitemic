export const config = {
  maxDuration: 120, // Aumenta o tempo limite da Vercel para evitar timeout
  api: { bodyParser: { sizeLimit: '15mb' } }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  // Captura as chaves de API tentando várias possibilidades de nomes
  const openApiKey = process.env.OPENROUTE2_API_KEY || process.env.OPENROUTE_APY_KEY || process.env.PORTAL_OPEN_API_KEY || process.env.VISTORIA_OPEN_API_KEY;
  const geminiApiKey = process.env.GEMINI_API_KEY || process.env.PORTAL_GEMINI_API_KEY;
  const groqApiKey = process.env.GROQ2_API_KEY || process.env.PORTAL_GROQ_API_KEY;

  if (!openApiKey && !geminiApiKey && !groqApiKey) {
    return res.status(500).json({ error: 'Nenhuma chave de API configurada na Vercel.' });
  }

  try {
    const {
      tipo, finalidade, area_util, area_total, quartos, suites, banheiros,
      vagas, bairro, cidade, mobiliado, detalhes_mobilia, lazer, fotosUrls
    } = req.body;

    const caracteristicas = `
      Tipo: ${tipo}
      Finalidade: ${finalidade}
      Área Útil: ${area_util || 'Não informada'}
      Área Total: ${area_total || 'Não informada'}
      Quartos: ${quartos} (${suites} suítes)
      Banheiros: ${banheiros}
      Vagas: ${vagas}
      Localização: ${bairro}, ${cidade}
      Mobiliado: ${mobiliado ? 'Sim - ' + detalhes_mobilia : 'Não'}
      Lazer/Comodidades: ${lazer && lazer.length > 0 ? lazer.join(', ') : 'Nenhum informado'}
    `;

    const promptText = `Atue como um corretor de imóveis de alto padrão e copywriter especialista.
Analise os dados reais do imóvel abaixo (e a foto, se fornecida) para criar um anúncio persuasivo.

DADOS REAIS DO IMÓVEL:
${caracteristicas}

REGRAS ESTRITAS E OBRIGATÓRIAS:
1. Seja 100% fiel à localização fornecida (${bairro}, ${cidade}). NÃO invente regiões. Fale APENAS o nome do bairro e da cidade reais que foram fornecidos.
2. Não invente comodidades, móveis ou áreas de lazer que não estejam explicitamente nas características ou evidentes nas imagens.
3. Foque em valorizar os dados reais de forma comercial e atraente.`;

    const schema = {
      type: "object",
      properties: {
        titulo: { type: "string", description: "Um título chamativo e profissional para o anúncio (máx 60 caracteres)" },
        descricao: { type: "string", description: "Uma descrição detalhada, engajadora e comercial em parágrafos agradáveis para leitura." }
      },
      required: ["titulo", "descricao"]
    };

    // Pega apenas a primeira URL para não estourar o Rate Limit
    const primeiraFotoUrl = (fotosUrls && Array.isArray(fotosUrls) && fotosUrls.length > 0) ? fotosUrls[0] : null;
    let fotoBase64 = null;
    let fotoMimeType = 'image/jpeg';

    if (primeiraFotoUrl) {
      try {
        const resImg = await fetch(primeiraFotoUrl);
        if (resImg.ok) {
          const arrayBuffer = await resImg.arrayBuffer();
          fotoBase64 = Buffer.from(arrayBuffer).toString('base64');
          fotoMimeType = resImg.headers.get('content-type') || 'image/jpeg';
        }
      } catch (e) {
        console.log(`Aviso: falha ao baixar a imagem para processamento:`, e.message);
      }
    }

    let resultado = null;
    const erros = [];

    // ============================================================================
    // 1ª TENTATIVA: COM FOTO
    // ============================================================================
    if (primeiraFotoUrl) {
      // 1. OpenRouter
      if (!resultado && openApiKey) {
        try {
          console.log("Tentando OpenRouter (Com Foto)...");
          resultado = await chamarOpenRouter(openApiKey, primeiraFotoUrl, promptText, schema, false);
        } catch (err) { erros.push('OpenRouter (Foto): ' + err.message); }
      }
      
      // 2. Gemini
      if (!resultado && geminiApiKey && fotoBase64) {
        try {
          console.log("Tentando Gemini (Com Foto)...");
          resultado = await chamarGemini(geminiApiKey, fotoBase64, fotoMimeType, promptText, schema, false);
        } catch (err) { erros.push('Gemini (Foto): ' + err.message); }
      }

      // 3. Groq
      if (!resultado && groqApiKey) {
        try {
          console.log("Tentando Groq (Com Foto)...");
          resultado = await chamarGroq(groqApiKey, primeiraFotoUrl, promptText, schema, false);
        } catch (err) { erros.push('Groq (Foto): ' + err.message); }
      }
    }

    // ============================================================================
    // 2ª TENTATIVA: FALLBACK APENAS TEXTO (Caso as IAs bloqueiem imagem por créditos/limites)
    // ============================================================================
    if (!resultado) {
      console.log("Iniciando Fallback (Somente Texto)...");
      
      // 1. OpenRouter (Texto)
      if (!resultado && openApiKey) {
        try { resultado = await chamarOpenRouter(openApiKey, null, promptText, schema, true); } 
        catch (err) { erros.push('OpenRouter (Texto): ' + err.message); }
      }
      
      // 2. Gemini (Texto)
      if (!resultado && geminiApiKey) {
        try { resultado = await chamarGemini(geminiApiKey, null, null, promptText, schema, true); } 
        catch (err) { erros.push('Gemini (Texto): ' + err.message); }
      }

      // 3. Groq (Texto)
      if (!resultado && groqApiKey) {
        try { resultado = await chamarGroq(groqApiKey, null, promptText, schema, true); } 
        catch (err) { erros.push('Groq (Texto): ' + err.message); }
      }
    }

    if (!resultado) {
      return res.status(500).json({ erro: "Nenhuma IA conseguiu gerar o anúncio.", detalhes: erros });
    }

    return res.status(200).json(resultado);

  } catch (e) {
    console.error("Erro fatal:", e);
    return res.status(500).json({ erro: "Erro inesperado", detalhes: e.message });
  }
}

// ============================================================================
// FUNÇÕES DOS PROVEDORES (Integrando Lógica da Vistoria)
// ============================================================================

async function chamarOpenRouter(apiKey, imageUrl, prompt, schema, isTextOnly) {
  const content = [{ type: "text", text: prompt + '\n\nResponda APENAS com um JSON válido, seguindo este schema: ' + JSON.stringify(schema) }];
  
  if (!isTextOnly && imageUrl) {
    content.push({ type: "image_url", image_url: { url: imageUrl } });
  }

  // GPT-4o-mini é super barato e funciona bem com fotos
  const model = isTextOnly ? "openrouter/auto" : "openai/gpt-4o-mini";

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://mic-imoveis.vercel.app',
      'X-Title': 'Portal MIC Imóveis'
    },
    body: JSON.stringify({
      model: model,
      messages: [{ role: "user", content }],
      response_format: { type: "json_object" }
    })
  });

  if (!response.ok) throw new Error(await response.text());
  
  const data = await response.json();
  const jsonLimpo = data.choices[0].message.content.replace(/```json\s?|```/g, '').trim();
  return JSON.parse(jsonLimpo);
}


async function chamarGemini(apiKey, base64, mimeType, prompt, schema, isTextOnly) {
  const parts = [{ text: prompt }];
  if (!isTextOnly && base64) {
    parts.push({ inlineData: { mimeType: mimeType, data: base64 } });
  }

  const payload = JSON.stringify({
    contents: [{ parts }],
    generationConfig: {
      responseMimeType: "application/json",
      responseJsonSchema: schema,
    }
  });

  // Lista dinâmica de modelos (Tenta do mais novo ao mais antigo)
  const targetModels = [
    "gemini-2.0-flash",
    "gemini-2.5-flash",
    "gemini-1.5-flash-latest",
    "gemini-1.5-flash",
    "gemini-1.5-pro"
  ];

  for (const model of targetModels) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload
      });

      const data = await response.json();
      if (response.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
        return JSON.parse(data.candidates[0].content.parts[0].text);
      }
    } catch (err) {
      continue; // Falhou neste modelo? Tenta o próximo!
    }
  }
  throw new Error('Todos os modelos Gemini testados falharam.');
}


async function chamarGroq(apiKey, imageUrl, prompt, schema, isTextOnly) {
  const content = [{ type: "text", text: prompt + '\n\nResponda APENAS com um JSON válido.' }];
  
  if (!isTextOnly && imageUrl) {
    content.push({ type: "image_url", image_url: { url: imageUrl } });
  }

  // Llama Vision para foto (menos consumo de tokens que o Qwen), Llama-8b para texto
  const model = isTextOnly ? "llama3-8b-8192" : "llama-3.2-11b-vision-preview";

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model,
      messages: [{ role: "user", content }],
      response_format: { type: "json_object" },
      max_tokens: 800
    })
  });

  if (!response.ok) throw new Error(await response.text());

  const data = await response.json();
  const jsonLimpo = data.choices[0].message.content.replace(/```json\s?|```/g, '').trim();
  return JSON.parse(jsonLimpo);
}
