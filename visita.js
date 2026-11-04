document.addEventListener('DOMContentLoaded', () => {
    const tipoContato = document.getElementById('tipoContato');
    const dadosParceiro = document.getElementById('dadosParceiro');
    const btnAgendamento = document.getElementById('btnAgendamento');
    const btnRelatorio = document.getElementById('btnRelatorio');

    // Mostra/oculta CRECI baseado no tipo de contato
    tipoContato.addEventListener('change', (e) => {
        if (e.target.value === 'parceiro') {
            dadosParceiro.classList.remove('hidden');
            document.getElementById('creciParceiro').required = true;
        } else {
            dadosParceiro.classList.add('hidden');
            document.getElementById('creciParceiro').required = false;
        }
    });

    const getFormData = () => {
        return {
            imovel: document.getElementById('identificacaoImovel').value,
            tipoContato: document.getElementById('tipoContato').value,
            nome: document.getElementById('nomeCliente').value,
            telefone: document.getElementById('telefoneCliente').value.replace(/\D/g, ''),
            creci: document.getElementById('creciParceiro').value,
            lgpd: document.getElementById('aceiteLgpd').checked
        };
    };

    // Mensagem de Agendamento
    btnAgendamento.addEventListener('click', () => {
        const d = getFormData();
        if(!d.nome || !d.telefone || !d.imovel) return alert('Preencha Imóvel, Nome e Telefone para agendar.');
        
        let msg = `Olá ${d.nome},\n\nConfirmo nosso agendamento para visita ao imóvel: *${d.imovel}*.\n\nAguardo você no local. Qualquer dúvida, estou à disposição!\n\nMario Chalfoun Junior | CRECI 101338`;
        
        window.open(`https://wa.me/55${d.telefone}?text=${encodeURIComponent(msg)}`, '_blank');
    });

    // Relatório de Intermediação para registro
    btnRelatorio.addEventListener('click', () => {
        const d = getFormData();
        if(!d.lgpd) return alert('O aceite da LGPD é obrigatório para gerar o relatório.');
        
        const dataAtual = new Date().toLocaleString('pt-BR');
        let msg = `*RELATÓRIO DE VISITA E INTERMEDIAÇÃO*\nData/Hora: ${dataAtual}\n\n`;
        msg += `*Imóvel:* ${d.imovel}\n`;
        
        if(d.tipoContato === 'parceiro') {
            msg += `*Corretor Parceiro:* ${d.nome}\n*CRECI:* ${d.creci}\n`;
        } else {
            msg += `*Cliente Visitante:* ${d.nome}\n`;
        }
        
        msg += `\n_As fotos comprobatórias (Imóvel e Selfie) foram coletadas no local e estão arquivadas junto a este registro, com consentimento (LGPD)._\n\nAtenciosamente,\nMario Chalfoun Junior | CRECI 101338`;

        // Envia para o zap do cliente/parceiro como termo de ciência
        window.open(`https://wa.me/55${d.telefone}?text=${encodeURIComponent(msg)}`, '_blank');
    });
});
