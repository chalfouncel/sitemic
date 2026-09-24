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

    const promptText = `Atue como um corretor de imóveis de alto padrão e copywriter especialista.
      Analise as fotos enviadas e as características abaixo para criar um anúncio persuasivo.
      
      Características do Imóvel:
      ${caracteristicas}
      
      Retorne EXATAMENTE um objeto JSON válido com as chaves:
      "titulo": "Um título chamativo e profissional para o anúncio (máx 60 caracteres)"
      "descricao": "Uma descrição detalhada, engajadora e comercial valorizando os pontos fortes visíveis nas fotos e os dados fornecidos. Formate o texto em parágrafos agradáveis para leitura."`;

    // Limitar a 5 fotos para economizar processamento
    const fotosParaAnalisar = (fotosUrls && Array.isArray(fotosUrls)) ? fotosUrls.slice(0, 5) : [];

    // ====================================================================
    // TENTATIVA 1: GROQ (Rápido e aceita URLs nativamente)
    // ====================================================================
    try {
      console.log("Tentando gerar anúncio via GROQ...");
      
      const groqContentArray = [{ type: "text", text: promptText }];
      fotosParaAnalisar.forEach(url => {
        groqContentArray.push({ type: "image_url", image_url: { url: url } });
      });

      const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama-3.2-90b-vision-preview", // Modelo de visão do Groq
          messages: [
            {
              role: "system",
              content: "Você é um assistente especialista em marketing imobiliário. Você responde apenas em formato JSON com as chaves 'titulo' e 'descricao', sem formatação markdown."
            },
            {
              role: "user",
              content: groqContentArray
            }
          ],
          response_format: { type: "json_object" }
        })
      });

      if (groqResponse.ok) {
        const jsonResponse = await groqResponse.json();
        let respostaIA = jsonResponse.choices[0].message.content;
        
        // Limpar possíveis formatações markdown do JSON
        respostaIA = respostaIA.replace(/```json/g, '').replace(/```/g, '').trim();
        const resultado = JSON.parse(respostaIA);
        
        console.log("Sucesso via Groq!");
        return res.status(200).json(resultado);
      } else {
        const errorData = await groqResponse.text();
        console.warn("Groq falhou, iniciando fallback para Gemini. Detalhes:", errorData);
        throw new Error("Falha no Groq");
      }

    } catch (groqError) {
      // ====================================================================
      // TENTATIVA 2: GEMINI (Fallback seguro da Google)
      // ====================================================================
      console.log("Tentando gerar anúncio via GEMINI (Fallback)...");
      
      // A API REST do Gemini precisa das imagens em Base64, então vamos baixar rapidamente
      const geminiParts = [{ text: promptText }];
      
      if (fotosParaAnalisar.length > 0) {
        await Promise.all(fotosParaAnalisar.map(async (url) => {
          try {
            const imgRes = await fetch(url);
            const arrayBuffer = await imgRes.arrayBuffer();
            const base64 = Buffer.from(arrayBuffer).toString('base64');
            const mimeType = imgRes.headers.get('content-type') || 'image/jpeg';
            geminiParts.push({ inlineData: { data: base64, mimeType: mimeType } });
          } catch (e) {
            console.log("Aviso: Falha ao baixar uma imagem para o Gemini, pulando esta imagem.");
          }
        }));
      }

      const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
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
        const jsonResponse = await geminiResponse.json();
        const respostaIA = jsonResponse.candidates[0].content.parts[0].text;
        
        const resultado = JSON.parse(respostaIA);
        console.log("Sucesso via Gemini!");
        return res.status(200).json(resultado);
      } else {
        const errorData = await geminiResponse.text();
        console.error("Gemini também falhou:", errorData);
        throw new Error("Ambas as IAs falharam.");
      }
    }

  } catch (error) {
    console.error("Erro fatal ao gerar anúncio:", error);
    return res.status(500).json({ 
      erro: "Falha ao analisar imagens e gerar texto após tentar múltiplos provedores.", 
      detalhes: error.message 
    });
  }
}
