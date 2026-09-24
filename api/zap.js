export default async function handler(req, res) {
    // Credenciais do seu Supabase
    const SUPABASE_URL = 'https://uztsmkhlvoemjbbyebcr.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_nmolEh_G5_hKcfdgy2Xpeg_s4T6ePAz';

    try {
        // Vai buscar todos os imóveis Ativos diretamente à sua base de dados
        const response = await fetch(`${SUPABASE_URL}/rest/v1/imoveis?status=eq.Ativo&select=*`, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });
        const imoveis = await response.json();

        // Cabeçalho obrigatório do padrão Zap
        let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<Carga xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">\n<Imoveis>\n`;

        // Transforma cada imóvel no formato XML exigido pelo portal
        imoveis.forEach(imovel => {
            xml += `  <Imovel>\n`;
            xml += `    <CodigoImovel>${imovel.id}</CodigoImovel>\n`;
            xml += `    <TipoImovel>${imovel.tipo}</TipoImovel>\n`;
            xml += `    <SubTipoImovel>${imovel.tipo}</SubTipoImovel>\n`;
            xml += `    <CategoriaImovel>Padrão</CategoriaImovel>\n`;
            
            if (imovel.finalidade.includes('Venda') && imovel.valor_venda) {
                xml += `    <PrecoVenda>${imovel.valor_venda}</PrecoVenda>\n`;
            }
            if (imovel.finalidade.includes('Aluguel') && imovel.valor_aluguel) {
                xml += `    <PrecoLocacao>${imovel.valor_aluguel}</PrecoLocacao>\n`;
            }
            if (imovel.valor_condominio) xml += `    <ValorCondominio>${imovel.valor_condominio}</ValorCondominio>\n`;
            if (imovel.valor_iptu) xml += `    <ValorIPTU>${imovel.valor_iptu}</ValorIPTU>\n`;

            xml += `    <QtdQuartos>${imovel.quartos || 0}</QtdQuartos>\n`;
            xml += `    <QtdSuites>${imovel.suites || 0}</QtdSuites>\n`;
            xml += `    <QtdBanheiros>${imovel.banheiros || 0}</QtdBanheiros>\n`;
            xml += `    <QtdVagas>${imovel.vagas || 0}</QtdVagas>\n`;
            if (imovel.area_util) xml += `    <AreaUtil>${imovel.area_util}</AreaUtil>\n`;
            if (imovel.area_total) xml += `    <AreaTotal>${imovel.area_total}</AreaTotal>\n`;

            // O Zap exige a localização desmembrada
            xml += `    <Localizacao>\n`;
            xml += `      <CEP>${imovel.cep || ''}</CEP>\n`;
            xml += `      <Estado>${imovel.estado || ''}</Estado>\n`;
            xml += `      <Cidade>${imovel.cidade || ''}</Cidade>\n`;
            xml += `      <Bairro>${imovel.bairro || ''}</Bairro>\n`;
            xml += `      <Logradouro>${imovel.endereco || ''}</Logradouro>\n`;
            xml += `      <Numero>${imovel.numero || ''}</Numero>\n`;
            // O complemento é interno, geralmente não se envia para o Zap por segurança, mas se quiser enviar, basta descomentar a linha abaixo:
            // xml += `      <Complemento>${imovel.complemento || ''}</Complemento>\n`;
            xml += `    </Localizacao>\n`;

            // Descrição e Fotos
            xml += `    <Observacao><![CDATA[${imovel.descricao || ''}]]></Observacao>\n`;

            if (imovel.fotos && imovel.fotos.length > 0) {
                xml += `    <Fotos>\n`;
                imovel.fotos.forEach((fotoUrl, idx) => {
                    xml += `      <Foto>\n`;
                    xml += `        <URLArquivo>${fotoUrl}</URLArquivo>\n`;
                    xml += `        <NomeArquivo>Foto_${idx + 1}</NomeArquivo>\n`;
                    xml += `        <Principal>${idx === 0 ? '1' : '0'}</Principal>\n`;
                    xml += `      </Foto>\n`;
                });
                xml += `    </Fotos>\n`;
            }

            xml += `  </Imovel>\n`;
        });

        xml += `</Imoveis>\n</Carga>`;

        // Informa ao navegador e ao Zap que isto é um documento XML válido
        res.setHeader('Content-Type', 'application/xml; charset=utf-8');
        res.status(200).send(xml);

    } catch (error) {
        res.status(500).json({ error: 'Erro ao gerar o feed XML.' });
    }
}
