export const config = {
  maxDuration: 120,
  api: { bodyParser: { sizeLimit: '15mb' } }
};

// Função auxiliar para forçar a extração de JSON da resposta da IA
function extrairJSON(texto) {
  try {
    let limpo = texto.replace(/```json/gi, '').replace(/```/g, '').trim();
    const match = limpo.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }
    return JSON.parse(limpo);
  } catch (e) {
    throw new Error("A IA não retornou um formato JSON válido. Retorno bruto: " + texto.substring(0, 100));
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  // Mapeamento abrangente de chaves API
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
3. Foque em valorizar os dados reais de forma comercial e atraente.

RETORNE EXATAMENTE UM JSON. INICIE COM { E TERMINE COM }. NÃO ESCREVA MAIS NADA ALÉM DO JSON.
Exemplo de formato esperado:
{
  "titulo": "Título com no máximo 100 caracteres",
  "descricao": "Descrição detalhada com no máximo 3000 caracteres, separada por parágrafos agradáveis..."
}`;

    // Pega apenas a primeira URL para não estourar limites
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
      // 1. Gemini (Prioridade 1, pois lida melhor com visão)
      if (!resultado && geminiApiKey && fotoBase64) {
        try {
          console.log("Tentando Gemini (Com Foto)...");
          resultado = await chamarGemini(geminiApiKey, fotoBase64, fotoMimeType, promptText, false);
        } catch (err) { erros.push('Gemini (Foto): ' + err.message); }
      }

      // 2. OpenRouter
      if (!resultado && openApiKey) {
        try {
          console.log("Tentando OpenRouter (Com Foto)...");
          resultado = await chamarOpenRouter(openApiKey, primeiraFotoUrl, promptText, false);
        } catch (err) { erros.push('OpenRouter (Foto): ' + err.message); }
      }
      
      // 3. Groq
      if (!resultado && groqApiKey) {
        try {
          console.log("Tentando Groq (Com Foto)...");
          resultado = await chamarGroq(groqApiKey, primeiraFotoUrl, promptText, false);
        } catch (err) { erros.push('Groq (Foto): ' + err.message); }
      }
    }

    // ============================================================================
    // 2ª TENTATIVA: FALLBACK APENAS TEXTO
    // ============================================================================
    if (!resultado) {
      console.log("Iniciando Fallback (Somente Texto)...");
      
      // 1. Gemini (Texto)
      if (!resultado && geminiApiKey) {
        try { resultado = await chamarGemini(geminiApiKey, null, null, promptText, true); } 
        catch (err) { erros.push('Gemini (Texto): ' + err.message); }
      }

      // 2. OpenRouter (Texto)
      if (!resultado && openApiKey) {
        try { resultado = await chamarOpenRouter(openApiKey, null, promptText, true); } 
        catch (err) { erros.push('OpenRouter (Texto): ' + err.message); }
      }

      // 3. Groq (Texto)
      if (!resultado && groqApiKey) {
        try { resultado = await chamarGroq(groqApiKey, null, promptText, true); } 
        catch (err) { erros.push('Groq (Texto): ' + err.message); }
      }
    }

    if (!resultado) {
      console.error("=== FALHA TOTAL ===");
      console.error(JSON.stringify(erros, null, 2));
      return res.status(500).json({ erro: "Nenhuma IA conseguiu gerar o anúncio.", detalhes: erros });
    }

    return res.status(200).json(resultado);

  } catch (e) {
    console.error("Erro fatal não tratado:", e);
    return res.status(500).json({ erro: "Erro inesperado", detalhes: e.message });
  }
}

// ============================================================================
// FUNÇÕES DOS PROVEDORES ATUALIZADOS
// ============================================================================

async function chamarGemini(apiKey, base64, mimeType, prompt, isTextOnly) {
  const parts = [{ text: prompt }];
  if (!isTextOnly && base64) {
    parts.push({ inlineData: { mimeType: mimeType, data: base64 } });
  }

  const payload = JSON.stringify({
    contents: [{ parts }],
    generationConfig: {
      responseMimeType: "application/json"
    }
  });

  // Busca dinamicamente os modelos mais recentes do Google para evitar erros futuros
  let modelosAtivos = [];
  try {
    const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (listRes.ok) {
      const listData = await listRes.json();
      if (Array.isArray(listData.models)) {
        modelosAtivos = listData.models
          .filter(m => m.supportedGenerationMethods?.includes('generateContent') && m.name.includes('flash'))
          .map(m => m.name.replace(/^models\//, ''))
          .reverse(); // Coloca os mais novos na frente
      }
    }
  } catch (e) { console.log("Aviso: Falha ao listar modelos do Gemini. Usando modelos fixos."); }

  // Se a busca falhar, tenta os que o Google nos informou que funcionam hoje:
  if (modelosAtivos.length === 0) {
    modelosAtivos = [
      "gemini-3.8-flash",
      "gemini-3.5-flash",
      "gemini-3.0-flash",
      "gemini-pro"
    ];
  }

  for (const model of modelosAtivos) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(`Erro API: ${JSON.stringify(data)}`);
      }

      if (data.candidates && data.candidates[0].content.parts[0].text) {
        return extrairJSON(data.candidates[0].content.parts[0].text);
      }
    } catch (err) {
      console.log(`[Gemini] Falha no modelo ${model}: ${err.message}`);
      continue; // Tenta o próximo modelo
    }
  }
  throw new Error('Todos os modelos Gemini testados falharam.');
}


async function chamarOpenRouter(apiKey, imageUrl, prompt, isTextOnly) {
  const content = [{ type: "text", text: prompt }];
  
  if (!isTextOnly && imageUrl) {
    content.push({ type: "image_url", image_url: { url: imageUrl } });
  }

  // Usando modelos estáveis e gratuitos atuais
  const model = isTextOnly ? "openrouter/auto" : "meta-llama/llama-3.2-11b-vision-instruct:free";

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
      messages: [{ role: "user", content }]
    })
  });

  const text = await response.text();
  if (!response.ok) throw new Error(text);
  
  const data = JSON.parse(text);
  return extrairJSON(data.choices[0].message.content);
}


async function chamarGroq(apiKey, imageUrl, prompt, isTextOnly) {
  const content = [{ type: "text", text: prompt }];
  
  if (!isTextOnly && imageUrl) {
    content.push({ type: "image_url", image_url: { url: imageUrl } });
  }

  // Modelos definitivos da Groq (Sem as tags 'preview' ou versões antigas)
  const model = isTextOnly ? "llama-3.3-70b-versatile" : "llama-3.2-11b-vision-instruct";

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model,
      messages: [{ role: "user", content }],
      max_tokens: 1500
    })
  });

  const text = await response.text();
  if (!response.ok) throw new Error(text);

  const data = JSON.parse(text);
  return extrairJSON(data.choices[0].message.content);
}
