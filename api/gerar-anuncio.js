export default async function handler(req, res) {
  // Garante que só aceitamos requisições POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    // 1. Extrair os dados recebidos do frontend
    const {
      tipo, finalidade, area_util, area_total, quartos, suites, banheiros,
      vagas, bairro, cidade, mobiliado, detalhes_mobilia, lazer, fotosUrls
    } = req.body;

    // 2. Montar o texto com as características do imóvel
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

    // 3. Prompt Base
    const promptText = `Atue como um corretor de imóveis de alto padrão e copywriter especialista.
    Analise as fotos enviadas e as características abaixo para criar um anúncio persuasivo.
    
    Características do Imóvel:
    ${caracteristicas}
    
    Retorne EXATAMENTE um objeto JSON válido com as chaves:
    "titulo": "Um título chamativo e profissional para o anúncio (máx 60 caracteres)"
    "descricao": "Uma descrição detalhada, engajadora e comercial valorizando os pontos fortes visíveis nas fotos e os dados fornecidos. Formate o texto em parágrafos agradáveis para leitura."`;

    // Limitar a 5 fotos para economizar processamento
    const fotosParaAnalisar = (fotosUrls && Array.isArray(fotosUrls)) ? fotosUrls.slice(0, 5) : [];

    // Array padrão de mensagens (usado pelo OpenRouter e Groq)
    const openAiContentArray = [{ type: "text", text: promptText }];
    fotosParaAnalisar.forEach(url => {
      openAiContentArray.push({ type: "image_url", image_url: { url: url } });
    });

    let anuncioGerado = null; // Variável que vai armazenar o resultado final

    // ====================================================================
    // TENTATIVA 1: OPENROUTER
    // ====================================================================
    try {
      console.log("Tentando gerar anúncio via OPENROUTER...");
      const orResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.PORTAL_OPEN_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://mic-imoveis.vercel.app", 
          "X-Title": "Portal MIC Imóveis"
        },
        body: JSON.stringify({
          model: "openai/gpt-4o-mini", 
          messages: [
            {
              role: "system",
              content: "Você é um assistente especialista em marketing imobiliário. Você responde apenas em formato JSON com as chaves 'titulo' e 'descricao', sem formatação markdown."
            },
            {
              role: "user",
              content: openAiContentArray
            }
          ],
          response_format: { type: "json_object" }
        })
      });

      if (orResponse.ok) {
        const orJson = await orResponse.json();
        let respostaIA = orJson.choices[0].message.content;
        
        // Limpar possíveis marcações de markdown do JSON
        respostaIA = respostaIA.replace(/```json/g, '').replace(/```/g, '').trim();
        anuncioGerado = JSON.parse(respostaIA);
        console.log("Sucesso via OpenRouter!");
      } else {
        const errText = await orResponse.text();
        console.warn("OpenRouter falhou (possível falta de créditos):", errText);
      }
    } catch (e) {
      console.warn("Erro de rede ao chamar OpenRouter:", e.message);
    }

    // ====================================================================
    // TENTATIVA 2: GROQ (FALLBACK 1 - Só roda se o OpenRouter falhar)
    // ====================================================================
    if (!anuncioGerado) {
      try {
        console.log("Tentando gerar anúncio via GROQ (Fallback 1)...");
        const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${process.env.PORTAL_GROQ_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "llama-3.2-90b-vision-preview",
            messages: [
              {
                role: "system",
                content: "Você é um assistente especialista em marketing imobiliário. Você responde apenas em formato JSON com as chaves 'titulo' e 'descricao', sem formatação markdown."
              },
              {
                role: "user",
                content: openAiContentArray
              }
            ],
            response_format: { type: "json_object" }
          })
        });

        if (groqResponse.ok) {
          const groqJson = await groqResponse.json();
          let respostaIA = groqJson.choices[0].message.content;
          
          respostaIA = respostaIA.replace(/```json/g, '').replace(/```/g, '').trim();
          anuncioGerado = JSON.parse(respostaIA);
          console.log("Sucesso via Groq!");
        } else {
          const errText = await groqResponse.text();
          console.warn("Groq falhou:", errText);
        }
      } catch (e) {
        console.warn("Erro de rede ao chamar Groq:", e.message);
      }
    }

    // ====================================================================
    // TENTATIVA 3: GEMINI (FALLBACK 2 - Só roda se OpenRouter e Groq falharem)
    // ====================================================================
    if (!anuncioGerado) {
      try {
        console.log("Tentando gerar anúncio via GEMINI (Fallback 2)...");
        const geminiParts = [{ text: promptText }];
        
        // Gemini exige que as imagens sejam convertidas para Base64
        if (fotosParaAnalisar.length > 0) {
          await Promise.all(fotosParaAnalisar.map(async (url) => {
            try {
              const imgRes = await fetch(url);
              const arrayBuffer = await imgRes.arrayBuffer();
              const base64 = Buffer.from(arrayBuffer).toString('base64');
              const mimeType = imgRes.headers.get('content-type') || 'image/jpeg';
              geminiParts.push({ inlineData: { data: base64, mimeType: mimeType } });
            } catch (e) {
              console.log(`Aviso: Falha ao baixar imagem (${url}) para o Gemini. Ignorando esta imagem.`);
            }
          }));
        }

        const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.PORTAL_GEMINI_API_KEY}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: geminiParts }],
            systemInstruction: {
              parts: [{ text: "Você é um especialista em marketing imobiliário. Você responde apenas em formato JSON com as chaves 'titulo' e 'descricao'." }]
            },
            generationConfig: {
              responseMimeType: "application/json"
            }
          })
        });

        if (geminiResponse.ok) {
          const geminiJson = await geminiResponse.json();
          const respostaIA = geminiJson.candidates[0].content.parts[0].text;
          anuncioGerado = JSON.parse(respostaIA);
          console.log("Sucesso via Gemini!");
        } else {
          const errText = await geminiResponse.text();
          console.error("Gemini falhou:", errText);
        }
      } catch (e) {
         console.warn("Erro de rede ao chamar Gemini:", e.message);
      }
    }

    // ====================================================================
    // RETORNO FINAL PARA O FRONTEND
    // ====================================================================
    if (anuncioGerado) {
      // Se qualquer uma das 3 IAs funcionou, retornamos os dados com sucesso!
      return res.status(200).json(anuncioGerado);
    } else {
      // Se o fluxo chegou aqui, é porque as 3 APIs falharam sequencialmente.
      throw new Error("Todas as 3 APIs de Inteligência Artificial (OpenRouter, Groq, Gemini) falharam na tentativa de gerar o anúncio.");
    }

  } catch (error) {
    console.error("Erro fatal ao gerar anúncio:", error);
    return res.status(500).json({ 
      erro: "Falha ao analisar imagens e gerar texto. Tentamos múltiplos provedores de IA sem sucesso.", 
      detalhes: error.message 
    });
  }
}
