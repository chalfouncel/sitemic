export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
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
2. Não invente comodidades, móveis ou áreas de lazer que não estejam explicitamente nas características.
3. Foque em valorizar os dados reais de forma comercial e atraente.

Retorne EXATAMENTE um objeto JSON válido com as chaves:
"titulo": "Um título chamativo e profissional para o anúncio (máx 60 caracteres)"
"descricao": "Uma descrição detalhada, engajadora e comercial valorizando os pontos fortes e os dados fornecidos. Formate o texto em parágrafos agradáveis para leitura."`;

    // Vamos usar apenas a primeira foto para evitar timeout e limite de tokens
    const fotosParaAnalisar = (fotosUrls && Array.isArray(fotosUrls) && fotosUrls.length > 0) ? [fotosUrls[0]] : [];
    
    // Preparando Imagem para Gemini (Base64)
    const geminiParts = [{ text: promptText }];
    let temImagemGemini = false;
    
    if (fotosParaAnalisar.length > 0) {
      try {
        const url = fotosParaAnalisar[0];
        const resImg = await fetch(url);
        if (resImg.ok) {
          const arrayBuffer = await resImg.arrayBuffer();
          const base64 = Buffer.from(arrayBuffer).toString('base64');
          const mimeType = resImg.headers.get('content-type') || 'image/jpeg';
          geminiParts.push({ inlineData: { data: base64, mimeType } });
          temImagemGemini = true;
        }
      } catch (e) {
        console.log(`Aviso: imagem não carregada para o Gemini:`, e.message);
      }
    }

    // Função auxiliar para tentar o Gemini
    async function callGemini(comImagem) {
        const parts = comImagem ? geminiParts : [{ text: promptText }];
        const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${process.env.PORTAL_GEMINI_API_KEY}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: parts }],
            systemInstruction: { parts: [{ text: "Você é um sistema estrito que retorna apenas JSON com 'titulo' e 'descricao'. Não use blocos de código (```), envie apenas a string json limpa." }] },
            generationConfig: { responseMimeType: "application/json" }
          })
        });
        if (!resp.ok) throw new Error(await resp.text());
        const json = await resp.json();
        let txt = json.candidates[0].content.parts[0].text;
        txt = txt.replace(/```json/gi, '').replace(/```/g, '').trim();
        return JSON.parse(txt);
    }

    // ==========================================
    // 1. TENTAR GEMINI
    // ==========================================
    try {
      console.log("Tentando GEMINI (Com Imagem)...");
      const resultado = await callGemini(temImagemGemini);
      console.log("Sucesso via GEMINI");
      return res.status(200).json(resultado);
    } catch(e) { 
      console.log("Erro GEMINI com imagem:", e.message); 
      // Fallback: Tenta de novo sem a imagem se o erro for por tamanho/formato
      try {
          console.log("Tentando GEMINI (Sem Imagem)...");
          const resultado = await callGemini(false);
          console.log("Sucesso via GEMINI (Fallback)");
          return res.status(200).json(resultado);
      } catch (e2) {
          console.log("Erro GEMINI sem imagem:", e2.message); 
      }
    }

    // Preparando payload Groq/OpenRouter
    const visionContent = [{ type: "text", text: promptText }];
    if (fotosParaAnalisar.length > 0) {
      visionContent.push({ type: "image_url", image_url: { url: fotosParaAnalisar[0] } });
    }
    const textOnlyContent = [{ type: "text", text: promptText }];

    // Função auxiliar para tentar Groq
    async function callGroq(comImagem) {
        const content = comImagem ? visionContent : textOnlyContent;
        // Se for só texto, usamos o Llama 3 8B que tem limites maiores e é muito rápido
        const model = comImagem ? "llama-3.2-11b-vision-preview" : "llama3-8b-8192"; 
        
        const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${process.env.PORTAL_GROQ_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: model,
            messages: [
              { role: "system", content: "Responda apenas em JSON com chaves 'titulo' e 'descricao'." },
              { role: "user", content: content }
            ],
            response_format: { type: "json_object" },
            max_tokens: 800
          })
        });
        if (!resp.ok) throw new Error(await resp.text());
        const json = await resp.json();
        let txt = json.choices[0].message.content;
        txt = txt.replace(/```json/gi, '').replace(/```/g, '').trim();
        return JSON.parse(txt);
    }

    // ==========================================
    // 2. TENTAR GROQ
    // ==========================================
    try {
      console.log("Tentando GROQ (Com Imagem)...");
      const resultado = await callGroq(true);
      console.log("Sucesso via GROQ");
      return res.status(200).json(resultado);
    } catch(e) { 
      console.log("Erro GROQ com imagem:", e.message); 
      try {
          console.log("Tentando GROQ (Sem Imagem)...");
          const resultado = await callGroq(false);
          console.log("Sucesso via GROQ (Fallback)");
          return res.status(200).json(resultado);
      } catch (e2) {
          console.log("Erro GROQ sem imagem:", e2.message); 
      }
    }

    // Função auxiliar para tentar OpenRouter
    async function callOpenRouter(comImagem) {
        const content = comImagem ? visionContent : textOnlyContent;
        const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${process.env.PORTAL_OPEN_API_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://mic-imoveis.vercel.app",
            "X-Title": "Portal MIC Imóveis"
          },
          body: JSON.stringify({
            // Usando Gemini Flash free no OR para visão, e auto para texto
            model: comImagem ? "google/gemini-flash-1.5-8b" : "openrouter/auto", 
            messages: [
              { role: "system", content: "Responda apenas em JSON com chaves 'titulo' e 'descricao'." },
              { role: "user", content: content }
            ]
          })
        });
        if (!resp.ok) throw new Error(await resp.text());
        const json = await resp.json();
        let txt = json.choices[0].message.content;
        txt = txt.replace(/```json/gi, '').replace(/```/g, '').trim();
        return JSON.parse(txt);
    }

    // ==========================================
    // 3. TENTAR OPENROUTER
    // ==========================================
    try {
      console.log("Tentando OPENROUTER (Com Imagem)...");
      const resultado = await callOpenRouter(true);
      console.log("Sucesso via OPENROUTER");
      return res.status(200).json(resultado);
    } catch(e) { 
      console.log("Erro OpenRouter com imagem:", e.message); 
      try {
          console.log("Tentando OPENROUTER (Sem Imagem)...");
          const resultado = await callOpenRouter(false);
          console.log("Sucesso via OPENROUTER (Fallback)");
          return res.status(200).json(resultado);
      } catch (e2) {
          console.log("Erro OpenRouter sem imagem:", e2.message); 
      }
    }

    // Se caiu aqui, TODAS falharam com E sem imagem
    return res.status(500).json({ erro: "Nenhuma IA conseguiu gerar o anúncio." });

  } catch (e) {
    console.error("Erro fatal:", e);
    return res.status(500).json({ erro: "Erro inesperado", detalhes: e.message });
  }
}
