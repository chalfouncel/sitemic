export default async function handler(req, res) {
    // Credenciais do seu Supabase
    const SUPABASE_URL = 'https://uztsmkhlvoemjbbyebcr.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_nmolEh_G5_hKcfdgy2Xpeg_s4T6ePAz';

    try {
        // Busca os imóveis que estão ativos
        const response = await fetch(`${SUPABASE_URL}/rest/v1/imoveis?status=in.(Ativo,ativo)&select=*`, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });
        const imoveis = await response.json();

        // Cabeçalho OBRIGATÓRIO do padrão NOVO (VRSYNC)
        let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
        xml += `<ListingDataFeed xmlns="http://www.vivareal.com/schemas/1.0/VRSync" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.vivareal.com/schemas/1.0/VRSync  http://xml.vivareal.com/vrsync.xsd">\n`;
        xml += `  <Header>\n`;
        xml += `    <Provider>M&amp;IC Corretores</Provider>\n`;
        xml += `    <Email>contato@miccorretores.com.br</Email>\n`;
        xml += `  </Header>\n`;
        xml += `  <Listings>\n`;

        // Transforma cada imóvel no formato VRSYNC exigido
        imoveis.forEach(imovel => {
            xml += `    <Listing>\n`;
            
            // CÓDIGO DO IMÓVEL E TÍTULO
            xml += `      <ListingID>${imovel.referencia || imovel.id}</ListingID>\n`;
            if (imovel.titulo) {
                xml += `      <Title><![CDATA[${imovel.titulo}]]></Title>\n`;
            }

            // FINALIDADE (Venda ou Aluguel)
            let transactionType = 'For Sale'; // Padrão
            const finalidade = imovel.finalidade || '';
            if (finalidade.includes('Venda') && finalidade.includes('Aluguel')) {
                transactionType = 'Sale/Rent';
            } else if (finalidade.includes('Aluguel')) {
                transactionType = 'For Rent';
            }
            xml += `      <TransactionType>${transactionType}</TransactionType>\n`;

            // MÍDIAS (Fotos e Vídeos)
            xml += `      <Media>\n`;
            if (imovel.fotos && imovel.fotos.length > 0) {
                imovel.fotos.forEach((fotoUrl, idx) => {
                    const isPrimary = idx === 0 ? ' primary="true"' : '';
                    xml += `        <Item medium="image"${isPrimary}>${fotoUrl}</Item>\n`;
                });
            }
            if (imovel.video) {
                xml += `        <Item medium="video">${imovel.video}</Item>\n`;
            }
            xml += `      </Media>\n`;

            // DETALHES DO IMÓVEL
            xml += `      <Details>\n`;
            xml += `        <UsageType>Residential</UsageType>\n`;
            
            // Traduzindo o tipo do imóvel para o padrão ZAP
            let propertyType = 'Residential / Home'; // Casa como padrão
            const tipoLower = (imovel.tipo || '').toLowerCase();
            if (tipoLower.includes('apartamento') || tipoLower.includes('flat') || tipoLower.includes('cobertura') || tipoLower.includes('kitnet')) propertyType = 'Residential / Apartment';
            else if (tipoLower.includes('lote') || tipoLower.includes('terreno')) propertyType = 'Residential / Land Lot';
            else if (tipoLower.includes('comercial') || tipoLower.includes('loja')) propertyType = 'Commercial / Retail';
            else if (tipoLower.includes('sala')) propertyType = 'Commercial / Office';
            else if (tipoLower.includes('galpão')) propertyType = 'Commercial / Industrial';
            else if (tipoLower.includes('fazenda') || tipoLower.includes('sítio') || tipoLower.includes('chácara')) propertyType = 'Residential / Farm';
            
            xml += `        <PropertyType>${propertyType}</PropertyType>\n`;
            
            if (imovel.descricao) {
                xml += `        <Description><![CDATA[${imovel.descricao}]]></Description>\n`;
            }
            
            // Valores
            if (transactionType === 'For Sale' || transactionType === 'Sale/Rent') {
                if (imovel.valor_venda) xml += `        <ListPrice>${imovel.valor_venda}</ListPrice>\n`;
            }
            if (transactionType === 'For Rent' || transactionType === 'Sale/Rent') {
                if (imovel.valor_aluguel) xml += `        <RentalPrice>${imovel.valor_aluguel}</RentalPrice>\n`;
            }
            if (imovel.valor_condominio) xml += `        <PropertyAdministrationFee>${imovel.valor_condominio}</PropertyAdministrationFee>\n`;
            
            // REGRA DO IPTU: Se for 0, enviar "isento"
            if (imovel.valor_iptu !== undefined && imovel.valor_iptu !== null && imovel.valor_iptu !== '') {
                if (String(imovel.valor_iptu).trim() === '0') {
                    xml += `        <YearlyTax>isento</YearlyTax>\n`;
                } else {
                    xml += `        <YearlyTax>${imovel.valor_iptu}</YearlyTax>\n`;
                }
            }
            
            // Áreas e Cômodos
            if (imovel.area_util) xml += `        <LivingArea unit="square metres">${imovel.area_util}</LivingArea>\n`;
            if (imovel.area_total) xml += `        <LotArea unit="square metres">${imovel.area_total}</LotArea>\n`;
            if (imovel.quartos) xml += `        <Bedrooms>${imovel.quartos}</Bedrooms>\n`;
            if (imovel.banheiros) xml += `        <Bathrooms>${imovel.banheiros}</Bathrooms>\n`;
            if (imovel.suites) xml += `        <Suites>${imovel.suites}</Suites>\n`;
            if (imovel.vagas) xml += `        <Garage type="Parking Space">${imovel.vagas}</Garage>\n`;

            // Características e Lazer
            if ((imovel.itens_lazer && imovel.itens_lazer.length > 0) || imovel.mobiliado) {
                xml += `        <Features>\n`;
                if (imovel.itens_lazer) {
                    imovel.itens_lazer.forEach(item => {
                        xml += `          <Feature>${item}</Feature>\n`;
                    });
                }
                if (imovel.mobiliado) {
                    xml += `          <Feature>Mobiliado</Feature>\n`;
                }
                xml += `        </Features>\n`;
            }
            xml += `      </Details>\n`;

            // LOCALIZAÇÃO
            xml += `      <Location displayAddress="All">\n`;
            xml += `        <Country abbreviation="BR">Brasil</Country>\n`;
            if (imovel.estado) xml += `        <State abbreviation="${imovel.estado}">${imovel.estado}</State>\n`;
            if (imovel.cidade) xml += `        <City>${imovel.cidade}</City>\n`;
            if (imovel.bairro) xml += `        <Neighborhood>${imovel.bairro}</Neighborhood>\n`;
            if (imovel.endereco) xml += `        <Address>${imovel.endereco}</Address>\n`;
            if (imovel.numero) xml += `        <StreetNumber>${imovel.numero}</StreetNumber>\n`;
            
            // CORREÇÃO AQUI: Tag alterada para PostalCode (Formato VRSYNC)
            xml += `        <PostalCode>${imovel.cep || ''}</PostalCode>\n`;
            
            xml += `      </Location>\n`;

            xml += `    </Listing>\n`;
        });

        // FECHAMENTO DO ARQUIVO XML
        xml += `  </Listings>\n`;
        xml += `</ListingDataFeed>`;

        // Informa ao navegador e ao Zap que isto é um documento XML válido
        res.setHeader('Content-Type', 'application/xml; charset=utf-8');
        res.status(200).send(xml);

    } catch (error) {
        res.status(500).json({ error: 'Erro ao gerar o feed XML.' });
    }
}
