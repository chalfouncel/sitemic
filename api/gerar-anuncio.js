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
Analise as fotos e as características abaixo para criar um anúncio persuasivo.
Características do Imóvel:
${caracteristicas}
Retorne EXATAMENTE um objeto JSON válido com as chaves:
"titulo": "Um título chamativo e profissional para o anúncio (máx 60 caracteres)"
"descricao": "Uma descrição detalhada, engajadora e comercial valorizando os pontos fortes visíveis nas fotos e os dados fornecidos. Formate o texto em parágrafos agradáveis para leitura."`;

    // CORREÇÃO GROQ: O novo modelo de visão aceita no máximo 3 imagens.
    const fotosParaAnalisar = (fotosUrls && Array.isArray(fotosUrls)) ? fotosUrls.slice(0, 3) : [];

    // Array para a API do Gemini (que exige imagens em base64)
    const geminiParts = [{ text: promptText }];
    await Promise.all(fotosParaAnalisar.map(async (url) => {
      try {
        const resImg = await fetch(url);
        if (!resImg.ok) throw new Error(`HTTP ${resImg.status}`);
        const arrayBuffer = await resImg.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        const mimeType = resImg.headers.get('content-type') || 'image/jpeg';
        geminiParts.push({ inlineData: { data: base64, mimeType } });
      } catch (e) {
        console.log(`Aviso: imagem não carregada (${url}):`, e.message);
      }
    }));

    // 1. TENTAR GEMINI
    try {
      console.log("Tentando GEMINI...");
      const respGemini = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${process.env.PORTAL_GEMINI_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: geminiParts }],
          // CORREÇÃO GEMINI: systemInstruction formatado como Objeto (Content Object) e não como Array
          systemInstruction: { parts: [{ text: "Responda APENAS com um objeto JSON com as chaves 'titulo' e 'descricao'" }] },
          generationConfig: { responseMimeType: "application/json" }
        })
      });
      if (respGemini.ok) {
        const json = await respGemini.json();
        let txt = json.candidates[0].content.parts[0].text;
        txt = txt.replace(/```json/gi, '').replace(/```/g, '').trim();
        const resultado = JSON.parse(txt);
        console.log("Sucesso via GEMINI");
        return res.status(200).json(resultado);
      } else {
        console.warn("GEMINI falhou", await respGemini.text());
      }
    } catch(e) { console.log("Erro GEMINI:", e.message); }

    // 2. TENTAR GROQ
    try {
      console.log("Tentando GROQ...");
      const respGroq = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.PORTAL_GROQ_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "qwen/qwen3.8-27b",
          messages: [
            { role: "system", content: "Responda APENAS em JSON com 'titulo' e 'descricao', sem markdown." },
            { role: "user", content: [{ type: "text", text: promptText }].concat(fotosParaAnalisar.map(url => ({ type: "image_url", image_url: { url } }))) }
          ],
          response_format: { type: "json_object" }
        })
      });
      if (respGroq.ok) {
        const json = await respGroq.json();
        let txt = json.choices[0].message.content;
        txt = txt.replace(/```json/gi, '').replace(/```/g, '').trim();
        const resultado = JSON.parse(txt);
        console.log("Sucesso via GROQ");
        return res.status(200).json(resultado);
      } else {
        console.warn("GROQ falhou", await respGroq.text());
      }
    } catch(e) { console.log("Erro GROQ:", e.message); }

    // 3. TENTAR OPENROUTER
    try {
      console.log("Tentando OPENROUTER...");
      const respOR = await fetch("https://openrouter.ai/api/v1/chat/completions", {
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
            { role: "system", content: "Responda APENAS com JSON com 'titulo' e 'descricao', sem markdown." },
            { role: "user", content: [{ type: "text", text: promptText }].concat(fotosParaAnalisar.map(url => ({ type: "image_url", image_url: { url } }))) }
          ],
          response_format: { type: "json_object" }
        })
      });
      if (respOR.ok) {
        const json = await respOR.json();
        let txt = json.choices[0].message.content;
        txt = txt.replace(/```json/gi, '').replace(/```/g, '').trim();
        const resultado = JSON.parse(txt);
        console.log("Sucesso via OPENROUTER");
        return res.status(200).json(resultado);
      } else {
        console.warn("OpenRouter falhou", await respOR.text());
      }
    } catch(e) { console.log("Erro OpenRouter:", e.message); }

    // Se caiu aqui, TODAS falharam
    return res.status(500).json({ erro: "Nenhuma IA conseguiu gerar o anúncio." });

  } catch (e) {
    console.error("Erro fatal:", e);
    return res.status(500).json({ erro: "Erro inesperado", detalhes: e.message });
  }
}
