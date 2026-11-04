export default async function handler(req, res) {
    const { ref } = req.query;
    const SUPABASE_URL = 'https://uztsmkhlvoemjbbyebcr.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_nmolEh_G5_hKcfdgy2Xpeg_s4T6ePAz';

    let titulo = 'M&IC Corretores de Imóveis';
    let descricao = 'Confirmação de Visita e Intermediação Imobiliária';
    let foto = 'https://miccorretores.com.br/logo.png';

    if (ref) {
        try {
            const response = await fetch(`${SUPABASE_URL}/rest/v1/imoveis?referencia=ilike.*${encodeURIComponent(ref)}*&limit=1`, {
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
                }
            });
            const data = await response.json();
            if (data && data.length > 0) {
                const imo = data[0];
                titulo = `${imo.referencia} - ${imo.titulo || 'Imóvel M&IC'}`;
                descricao = `${imo.endereco || ''}, ${imo.numero || ''} - ${imo.bairro || ''}`;
                
                let listaFotos = [];
                if (Array.isArray(imo.fotos)) {
                    listaFotos = imo.fotos;
                } else if (typeof imo.fotos === 'string') {
                    let clean = imo.fotos.trim().replace(/^[{[\]}]|[{[\]}]$/g, '');
                    if (clean) listaFotos = clean.split(',').map(s => s.replace(/^"|"$/g, '').trim());
                }
                if (listaFotos.length > 0 && listaFotos[0]) {
                    foto = listaFotos[0];
                }
            }
        } catch (e) {}
    }

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>${titulo}</title>
    <meta property="og:type" content="website">
    <meta property="og:title" content="${titulo}">
    <meta property="og:description" content="📍 ${descricao}">
    <meta property="og:image" content="${foto}">
    <meta property="og:image:width" content="800">
    <meta property="og:image:height" content="600">
    <meta http-equiv="refresh" content="0;url=https://miccorretores.com.br">
</head>
<body style="background:#0A0A0A; color:#C9A84C; font-family:sans-serif; text-align:center; padding-top:50px;">
    Redirecionar para M&IC Corretores...
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(html);
}
