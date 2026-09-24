import { v2 as cloudinary } from 'cloudinary';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';

// 1. Configurando as chaves de segurança (Ficam escondidas na Vercel)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function POST(request) {
  try {
    // 2. Recebendo os dados do seu formulário
    const body = await request.json();
    const { fotoBase64, bairro, temMobilia, listaMobilia, vistaSol, lazerPredio } = body;

    // ==========================================
    // ETAPA A: UPLOAD DA FOTO PARA O CLOUDINARY
    // ==========================================
    // O Cloudinary já faz uma otimização automática de qualidade e tamanho
    const uploadResult = await cloudinary.uploader.upload(fotoBase64, {
      folder: 'imoveis_rj',
      // Aqui podemos adicionar efeitos futuros, como brilho automático
    });
    
    const urlDaFotoTratada = uploadResult.secure_url;

    // ==========================================
    // ETAPA B: MONTANDO O PROMPT INTELIGENTE 
    // ==========================================
    // Aqui é onde a mágica acontece. Vamos ditar as regras para a IA.
    
    let instrucaoMobilia = "";
    if (temMobilia === "sim" && listaMobilia) {
      instrucaoMobilia = `⚠️ ATENÇÃO: O imóvel possui móveis nas fotos, mas APENAS os seguintes itens ficarão no imóvel: "${listaMobilia}". Foque nesses itens e na estrutura do imóvel. Ignore TVs, sofás ou qualquer outro item que não esteja nessa lista.`;
    } else {
      instrucaoMobilia = `⚠️ ATENÇÃO: As fotos podem conter móveis da atual moradora, mas este imóvel será alugado/vendido VAZIO. Ignore qualquer mobília, eletrodoméstico ou decoração. Descreva APENAS a estrutura, iluminação, pisos, janelas, tamanho dos cômodos e a vista.`;
    }

    const promptIA = `
      Você é um corretor de imóveis de alto padrão no Rio de Janeiro.
      Crie um texto de anúncio persuasivo e elegante para um imóvel no bairro: ${bairro}.
      
      Características informadas:
      - Posição/Vista: ${vistaSol || "Não informado"}
      - Lazer/Infraestrutura do prédio: ${lazerPredio ? lazerPredio.join(", ") : "Não informado"}
      
      Regras de ouro:
      1. ${instrucaoMobilia}
      2. ⛔ REGRA ESTRITA: Em hipótese alguma mencione valores financeiros (preço de venda, aluguel, condomínio, IPTU ou taxas).
      3. O texto deve ter um título atrativo, um parágrafo emocional e uma lista de destaques em bullet points.
    `;

    // ==========================================
    // ETAPA C: CHAMANDO O GEMINI
    // ==========================================
    // Usamos o modelo que aceita texto e imagem
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" }); 
    
    // Convertendo a imagem para o formato que o Gemini entende
    const base64Data = fotoBase64.replace(/^data:image\/\w+;base64,/, "");
    const imageParts = [
      {
        inlineData: {
          data: base64Data,
          mimeType: "image/jpeg"
        }
      }
    ];

    const result = await model.generateContent([promptIA, ...imageParts]);
    const response = await result.response;
    const textoDoAnuncio = response.text();

    // ==========================================
    // ETAPA D: DEVOLVENDO TUDO PRONTO
    // ==========================================
    return NextResponse.json({
      sucesso: true,
      urlFoto: urlDaFotoTratada,
      textoAnuncio: textoDoAnuncio
    });

  } catch (error) {
    console.error("Erro no processamento:", error);
    return NextResponse.json({ sucesso: false, erro: error.message }, { status: 500 });
  }
}
