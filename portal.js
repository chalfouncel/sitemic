// Configuração do Supabase
var SUPABASE_URL = 'https://uztsmkhlvoemjbbyebcr.supabase.co';
var SUPABASE_ANON_KEY = 'sb_publishable_nmolEh_G5_hKcfdgy2Xpeg_s4T6ePAz';
var supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const loginSection = document.getElementById('loginSection');
const dashboardSection = document.getElementById('dashboardSection');

// Variável de controle para falhas da IA
let tentativasIA = 0;

// Verifica sessão
async function checarSessao() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        loginSection.style.display = 'none';
        dashboardSection.style.display = 'block';
        carregarLeads();
    } else {
        loginSection.style.display = 'block';
        dashboardSection.style.display = 'none';
    }
}

// Lógica de Login e Logout
async function fazerLogin() {
    const email = document.getElementById('loginEmail').value;
    const senha = document.getElementById('loginSenha').value;
    const msg = document.getElementById('loginMsg');
    
    msg.style.display = 'block';
    msg.style.color = 'var(--gold)';
    msg.innerText = 'A verificar credenciais...';

    const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });

    if (error) {
        msg.style.color = '#ff4444';
        msg.innerText = 'Acesso negado. Verifique o e-mail e a senha.';
    } else {
        msg.style.display = 'none';
        checarSessao();
    }
}

async function fazerLogout() {
    await supabase.auth.signOut();
    checarSessao();
}

function mudarAba(aba) {
    document.getElementById('btnAbaImovel').classList.remove('active');
    document.getElementById('btnAbaLeads').classList.remove('active');
    document.getElementById('abaImovel').style.display = 'none';
    document.getElementById('abaLeads').style.display = 'none';

    if(aba === 'imovel') {
        document.getElementById('btnAbaImovel').classList.add('active');
        document.getElementById('abaImovel').style.display = 'block';
    } else {
        document.getElementById('btnAbaLeads').classList.add('active');
        document.getElementById('abaLeads').style.display = 'block';
        carregarLeads();
    }
}

// Interações do Formulário (Mobília e Lazer)
function toggleMobiliaDetalhes() {
    const radioSim = document.getElementById('mobSim');
    const divDetalhes = document.getElementById('div-detalhes-mobilia');
    const textareaDetalhes = document.getElementById('detalhes_mobilia');

    if (radioSim && radioSim.checked) {
        divDetalhes.style.display = 'block';
    } else {
        divDetalhes.style.display = 'none';
        if (textareaDetalhes) textareaDetalhes.value = ''; 
    }
}

let todosLazerMarcados = false;
function toggleTodosLazer() {
    todosLazerMarcados = !todosLazerMarcados;
    const checkboxes = document.querySelectorAll('input[name="lazer"]');
    checkboxes.forEach(cb => cb.checked = todosLazerMarcados);
    
    const btn = document.getElementById('btnToggleLazer');
    btn.innerText = todosLazerMarcados ? 'Desmarcar Todos' : 'Marcar Todos';
}

// Busca CEP
const cepInput = document.getElementById('imoCep');
if (cepInput) {
    cepInput.addEventListener('blur', async function() {
        let cep = this.value.replace(/\D/g, ''); 
        if (cep.length === 8) {
            try {
                const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
                const dados = await response.json();
                if (!dados.erro) {
                    document.getElementById('imoEndereco').value = dados.logradouro;
                    document.getElementById('imoBairro').value = dados.bairro;
                    document.getElementById('imoCidade').value = dados.localidade;
                    document.getElementById('imoEstado').value = dados.uf;
                    document.getElementById('imoNumero').focus();
                }
            } catch (error) {
                console.error("Erro ao buscar CEP:", error);
            }
        }
    });
}

// Processamento de Fotos (Marca D'água)
let fotosProcessadas = [];
let urlsDasFotosEnviadas = []; // Salva as URLs após o upload pela IA para não duplicar no Publish

const fileInput = document.getElementById('imoFotos');
if(fileInput) {
    fileInput.addEventListener('change', async function(e) {
        // Se trocar as fotos, obriga a gerar a IA de novo (ou zera a contingência)
        urlsDasFotosEnviadas = [];
        tentativasIA = 0; // Zera as tentativas ao trocar de foto
        document.getElementById('btnSubmit').disabled = true;
        document.getElementById('btnGerarIA').innerText = '✨ Analisar e Gerar Anúncio com IA';
        document.getElementById('btnGerarIA').disabled = false;
        
        // Limpa os campos para o placeholder aparecer
        document.getElementById('imoTitulo').value = '';
        document.getElementById('imoDescricao').value = '';

        const previewContainer = document.getElementById('previewFotos');
        previewContainer.innerHTML = '<span style="color: var(--gold);">Processando imagens com marca d\'água...</span>';
        fotosProcessadas = [];
        
        const files = e.target.files;
        if(files.length === 0) {
            previewContainer.innerHTML = '';
            return;
        }

        const marcaDagua = new Image();
        marcaDagua.src = 'marca-dagua.png'; 
        
        await new Promise(r => { marcaDagua.onload = r; marcaDagua.onerror = r; });
        previewContainer.innerHTML = '';

        for(let file of files) {
            const img = new Image();
            const url = URL.createObjectURL(file);
            img.src = url;
            await new Promise(r => img.onload = r);

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);

            if (marcaDagua.width > 0) {
                ctx.globalAlpha = 0.4; 
                const wmWidth = canvas.width * 0.4; 
                const wmHeight = (marcaDagua.height / marcaDagua.width) * wmWidth;
                const dx = (canvas.width - wmWidth) / 2;
                const dy = (canvas.height - wmHeight) / 2;
                ctx.drawImage(marcaDagua, dx, dy, wmWidth, wmHeight);
                ctx.globalAlpha = 1.0;
            }

            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.8));
            const processedFile = new File([blob], file.name, { type: 'image/jpeg' });
            fotosProcessadas.push(processedFile);

            const previewImg = document.createElement('img');
            previewImg.src = URL.createObjectURL(blob);
            previewContainer.appendChild(previewImg);
        }
    });
}

// GERAR TEXTO COM INTELIGÊNCIA ARTIFICIAL
async function gerarTextoIA() {
    if(fotosProcessadas.length === 0) {
        alert('Por favor, adicione as fotos do imóvel. A IA precisa delas para criar o anúncio.');
        return;
    }

    const btnIA = document.getElementById('btnGerarIA');
    const msg = document.getElementById('imovelMsg');
    const btnSubmit = document.getElementById('btnSubmit');
    
    btnIA.disabled = true;
    btnIA.innerText = '⏳ Fazendo upload e analisando... (Isso pode demorar alguns segundos)';
    msg.innerText = '';

    try {
        // Passo 1: Fazer upload das fotos para o Supabase (se ainda não foram feitas)
        if (urlsDasFotosEnviadas.length === 0) {
            for(let file of fotosProcessadas) {
                const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '')}`;
                const { data: uploadData, error: uploadError } = await supabase.storage.from('imoveis_fotos').upload(fileName, file);
                
                if(!uploadError) {
                    const { data: publicUrlData } = supabase.storage.from('imoveis_fotos').getPublicUrl(fileName);
                    urlsDasFotosEnviadas.push(publicUrlData.publicUrl);
                }
            }
        }

        // Capturar características para mandar para a IA
        const itensLazer = [];
        document.querySelectorAll('input[name="lazer"]:checked').forEach(cb => itensLazer.push(cb.value));
        const isMobiliado = document.getElementById('mobSim').checked;
        const detalhesMobilia = document.getElementById('detalhes_mobilia').value;

        const payloadParaIA = {
            tipo: document.getElementById('imoTipo').value,
            finalidade: document.getElementById('imoFinalidade').value,
            area_util: document.getElementById('imoAreaUtil').value,
            area_total: document.getElementById('imoAreaTotal').value,
            quartos: document.getElementById('imoQuartos').value,
            suites: document.getElementById('imoSuites').value,
            banheiros: document.getElementById('imoBanheiros').value,
            vagas: document.getElementById('imoVagas').value,
            bairro: document.getElementById('imoBairro').value,
            cidade: document.getElementById('imoCidade').value,
            mobiliado: isMobiliado,
            detalhes_mobilia: detalhesMobilia,
            lazer: itensLazer,
            fotosUrls: urlsDasFotosEnviadas // Mandamos os links para a IA olhar
        };

        // Passo 2: Mandar para a rota na Vercel
        const response = await fetch('/api/gerar-anuncio', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payloadParaIA)
        });

        if (!response.ok) throw new Error("Erro na rota da IA");

        const dadosIA = await response.json();

        // Passo 3: Preencher os campos editáveis
        document.getElementById('imoTitulo').value = dadosIA.titulo || "Título gerado indisponível";
        document.getElementById('imoDescricao').value = dadosIA.descricao || "Descrição gerada indisponível";

        // Sucesso: Zera as tentativas e habilita a publicação
        tentativasIA = 0;
        btnSubmit.disabled = false;
        btnIA.innerText = '✅ Anúncio Gerado com Sucesso! Sinta-se livre para editar os textos acima.';
        btnIA.style.background = '#0F9D58'; // Verde mais escuro

    } catch (error) {
        console.error(error);
        tentativasIA++; // Incrementa o contador de falhas
        
        btnIA.disabled = false;
        
        if (tentativasIA >= 2) {
            // Se falhou 2 vezes, ativa o plano de contingência (libera botão manual)
            btnIA.innerText = '⚠️ IA Indisponível. Publicação Manual Liberada.';
            btnIA.style.background = '#e6a100'; // Laranja de aviso
            btnIA.disabled = true; // Desabilita o botão da IA para evitar frustração contínua
            
            msg.style.color = '#e6a100';
            msg.innerHTML = 'Houve instabilidade nos servidores de IA. <br><b>O botão de publicar foi desbloqueado!</b> Você pode preencher o Título e a Descrição manualmente e publicar o imóvel.';
            
            // Foca no título para induzir o usuário a preencher
            document.getElementById('imoTitulo').focus();
            
            // LIBERA O BOTÃO DE SUBMIT!
            btnSubmit.disabled = false;
        } else {
            // Primeira falha: Pede para tentar de novo
            btnIA.innerText = '❌ Falha ao gerar. Tentar novamente (' + tentativasIA + '/2)';
            msg.style.color = '#ff4444';
            msg.innerText = 'Erro de comunicação com a IA. Os servidores podem estar sobrecarregados. Tente novamente.';
        }
    }
}

// INSERIR IMÓVEL NO BANCO (Publicar)
const formImovel = document.getElementById('formImovel');
if (formImovel) {
    formImovel.addEventListener('submit', async (e) => {
        e.preventDefault();
        const msg = document.getElementById('imovelMsg');
        msg.style.color = 'var(--gold)';
        msg.innerText = 'Gravando imóvel no banco de dados...';

        // Validação extra caso seja publicação manual via contingência
        const titulo = document.getElementById('imoTitulo').value.trim();
        const descricao = document.getElementById('imoDescricao').value.trim();
        
        if (tentativasIA >= 2 && (!titulo || !descricao)) {
            msg.style.color = '#ff4444';
            msg.innerText = 'Por favor, preencha manualmente o Título e a Descrição antes de publicar.';
            if(!titulo) document.getElementById('imoTitulo').focus();
            else document.getElementById('imoDescricao').focus();
            return;
        }

        const itensLazer = [];
        document.querySelectorAll('input[name="lazer"]:checked').forEach(cb => itensLazer.push(cb.value));

        const payload = {
            titulo: titulo,
            descricao: descricao,
            tipo: document.getElementById('imoTipo').value,
            finalidade: document.getElementById('imoFinalidade').value,
            valor_venda: document.getElementById('imoVenda').value || null,
            valor_aluguel: document.getElementById('imoAluguel').value || null,
            valor_condominio: document.getElementById('imoCondominio').value || null,
            valor_iptu: document.getElementById('imoIptu').value || null,
            area_util: document.getElementById('imoAreaUtil').value || null,
            area_total: document.getElementById('imoAreaTotal').value || null,
            quartos: document.getElementById('imoQuartos').value || 0,
            suites: document.getElementById('imoSuites').value || 0,
            banheiros: document.getElementById('imoBanheiros').value || 0,
            vagas: document.getElementById('imoVagas').value || 0,
            
            mobiliado: document.getElementById('mobSim').checked,
            detalhes_mobilia: document.getElementById('detalhes_mobilia').value,
            itens_lazer: itensLazer,
            
            cep: document.getElementById('imoCep').value,
            endereco: document.getElementById('imoEndereco').value,
            numero: document.getElementById('imoNumero').value,
            complemento: document.getElementById('imoComplemento').value,
            bairro: document.getElementById('imoBairro').value,
            cidade: document.getElementById('imoCidade').value,
            estado: document.getElementById('imoEstado').value,
            
            // As fotos já foram upadas pela IA! Economiza tempo e processamento.
            fotos: urlsDasFotosEnviadas, 
            status: 'Ativo'
        };

        const { error } = await supabase.from('imoveis').insert([payload]);

        if (error) {
            console.error(error);
            msg.style.color = '#ff4444';
            msg.innerText = 'Ocorreu um erro ao gravar o imóvel.';
        } else {
            msg.style.color = '#25D366'; 
            msg.innerText = 'Imóvel publicado com sucesso!';
            formImovel.reset();
            
            // Reseta a interface e a contingência
            tentativasIA = 0;
            document.getElementById('div-detalhes-mobilia').style.display = 'none'; 
            document.getElementById('previewFotos').innerHTML = '';
            fotosProcessadas = [];
            urlsDasFotosEnviadas = [];
            
            document.getElementById('btnSubmit').disabled = true;
            document.getElementById('btnGerarIA').innerText = '✨ Analisar e Gerar Anúncio com IA';
            document.getElementById('btnGerarIA').style.background = '#25D366';
            document.getElementById('btnGerarIA').disabled = false;
            
            setTimeout(() => { msg.innerText = ''; }, 4000);
        }
    });
}

// Lógica de Leads (Inalterada)
async function carregarLeads() {
    const loading = document.getElementById('loadingLeads');
    const tabela = document.getElementById('tabelaLeads');
    const corpo = document.getElementById('corpoTabelaLeads');
    loading.style.display = 'block';
    tabela.style.display = 'none';

    const { data, error } = await supabase.from('leads').select('*').order('created_at', { ascending: false });
    loading.style.display = 'none';

    if (error) {
        corpo.innerHTML = '<tr><td colspan="5">Erro ao carregar contatos.</td></tr>';
        tabela.style.display = 'table';
        return;
    }

    if (data.length === 0) {
        corpo.innerHTML = '<tr><td colspan="5">Nenhum contato recebido ainda.</td></tr>';
    } else {
        corpo.innerHTML = '';
        data.forEach(lead => {
            const dataFormatada = new Date(lead.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute:'2-digit' });
            let badgeClass = 'novo';
            if(lead.status === 'Em atendimento') badgeClass = 'atendimento';
            if(lead.status === 'Concluído') badgeClass = 'concluido';

            corpo.innerHTML += `
                <tr>
                    <td>${dataFormatada}</td>
                    <td><strong>${lead.nome}</strong><br>${lead.telefone}<br>${lead.email}</td>
                    <td><span class="badge ${badgeClass}" id="badge-${lead.id}">${lead.interesse}</span></td>
                    <td><small>${lead.mensagem || 'Sem mensagem'}</small></td>
                    <td>
                        <select onchange="atualizarStatusLead('${lead.id}', this.value)">
                            <option value="Novo" ${lead.status === 'Novo' ? 'selected' : ''}>Novo</option>
                            <option value="Em atendimento" ${lead.status === 'Em atendimento' ? 'selected' : ''}>Em atendimento</option>
                            <option value="Concluído" ${lead.status === 'Concluído' ? 'selected' : ''}>Concluído</option>
                        </select>
                    </td>
                </tr>
            `;
        });
    }
    tabela.style.display = 'table';
}

async function atualizarStatusLead(id, novoStatus) {
    const { error } = await supabase.from('leads').update({ status: novoStatus }).eq('id', id);
    if(error) alert('Erro ao atualizar o status.');
    else {
        const badge = document.getElementById(`badge-${id}`);
        badge.className = 'badge';
        if(novoStatus === 'Novo') badge.classList.add('novo');
        if(novoStatus === 'Em atendimento') badge.classList.add('atendimento');
        if(novoStatus === 'Concluído') badge.classList.add('concluido');
    }
}

checarSessao();
