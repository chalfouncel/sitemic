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

    // 3. Montar o array de conteúdo (Texto + Imagens) para o OpenRouter
    const contentArray = [
      {
        type: "text",
        text: `Atue como um corretor de imóveis de alto padrão e copywriter especialista.
        Analise as fotos enviadas e as características abaixo para criar um anúncio persuasivo.
        
        Características do Imóvel:
        ${caracteristicas}
        
        Retorne EXATAMENTE um objeto JSON válido com as chaves:
        "titulo": "Um título chamativo e profissional para o anúncio (máx 60 caracteres)"
        "descricao": "Uma descrição detalhada, engajadora e comercial valorizando os pontos fortes visíveis nas fotos e os dados fornecidos. Formate o texto em parágrafos agradáveis para leitura."`
      }
    ];

    // 4. Inserir as URLs das fotos (Máximo de 5 fotos para ser rápido e econômico)
    if (fotosUrls && Array.isArray(fotosUrls)) {
      const fotosParaAnalisar = fotosUrls.slice(0, 5);
      fotosParaAnalisar.forEach(url => {
        contentArray.push({
          type: "image_url",
          image_url: { url: url }
        });
      });
    }

    // 5. Fazer a requisição DIRETA para o OpenRouter
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
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
            content: contentArray
          }
        ],
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Erro OpenRouter:", errorData);
      throw new Error("Falha na comunicação com o OpenRouter.");
    }

    const jsonResponse = await response.json();

    // 6. Converter a resposta da IA (string JSON) para Objeto JavaScript
    const respostaIA = JSON.parse(jsonResponse.choices[0].message.content);
    
    // 7. Retornar com sucesso (Status 200) para o seu frontend
    return res.status(200).json({
      titulo: respostaIA.titulo,
      descricao: respostaIA.descricao
    });

  } catch (error) {
    console.error("Erro ao gerar anúncio:", error);
    return res.status(500).json({ erro: "Falha ao analisar imagens e gerar texto", detalhes: error.message });
  }
}
