// Configuração do Supabase
var SUPABASE_URL = 'https://uztsmkhlvoemjbbyebcr.supabase.co';
var SUPABASE_ANON_KEY = 'sb_publishable_nmolEh_G5_hKcfdgy2Xpeg_s4T6ePAz';
var supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const loginSection = document.getElementById('loginSection');
const dashboardSection = document.getElementById('dashboardSection');

// Verifica sessão
async function checarSessao() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        loginSection.style.display = 'none';
        dashboardSection.style.display = 'block';
        carregarLeads(); // Carrega os leads automaticamente ao entrar
    } else {
        loginSection.style.display = 'block';
        dashboardSection.style.display = 'none';
    }
}

// Lógica de Login
async function fazerLogin() {
    const email = document.getElementById('loginEmail').value;
    const senha = document.getElementById('loginSenha').value;
    const msg = document.getElementById('loginMsg');
    
    msg.style.display = 'block';
    msg.style.color = 'var(--gold)';
    msg.innerText = 'A verificar credenciais...';

    const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: senha,
    });

    if (error) {
        msg.style.color = '#ff4444';
        msg.innerText = 'Acesso negado. Verifique o e-mail e a senha.';
    } else {
        msg.style.display = 'none';
        checarSessao();
    }
}

// Lógica de Logout
async function fazerLogout() {
    await supabase.auth.signOut();
    checarSessao();
}

// Lógica de Abas
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

// --- BUSCA DE CEP AUTOMÁTICA (ViaCEP) ---
const cepInput = document.getElementById('imoCep');
if (cepInput) {
    cepInput.addEventListener('blur', async function() {
        let cep = this.value.replace(/\D/g, ''); // Remove traços e pontos
        
        if (cep.length === 8) {
            try {
                const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
                const dados = await response.json();

                if (!dados.erro) {
                    document.getElementById('imoEndereco').value = dados.logradouro;
                    document.getElementById('imoBairro').value = dados.bairro;
                    document.getElementById('imoCidade').value = dados.localidade;
                    document.getElementById('imoEstado').value = dados.uf;
                    // Foca no número automaticamente para facilitar
                    document.getElementById('imoNumero').focus();
                }
            } catch (error) {
                console.error("Erro ao buscar CEP:", error);
            }
        }
    });
}

// Lógica de Fotos e Marca D'água
let fotosProcessadas = [];
const fileInput = document.getElementById('imoFotos');
if(fileInput) {
    fileInput.addEventListener('change', async function(e) {
        const previewContainer = document.getElementById('previewFotos');
        previewContainer.innerHTML = '<span style="color: var(--gold);">A processar imagens com marca de água...</span>';
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

// Lógica de Inserção de Imóveis
const formImovel = document.getElementById('formImovel');
if (formImovel) {
    formImovel.addEventListener('submit', async (e) => {
        e.preventDefault();
        const msg = document.getElementById('imovelMsg');
        msg.style.color = 'var(--gold)';
        msg.innerText = 'A enviar fotos e gravar imóvel (Isto pode demorar uns segundos)...';

        const fotosUrls = [];
        for(let file of fotosProcessadas) {
            const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '')}`;
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('imoveis_fotos')
                .upload(fileName, file);
            
            if(!uploadError) {
                const { data: publicUrlData } = supabase.storage
                    .from('imoveis_fotos')
                    .getPublicUrl(fileName);
                fotosUrls.push(publicUrlData.publicUrl);
            }
        }

        const payload = {
            titulo: document.getElementById('imoTitulo').value,
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
            cep: document.getElementById('imoCep').value,
            endereco: document.getElementById('imoEndereco').value,
            numero: document.getElementById('imoNumero').value,
            complemento: document.getElementById('imoComplemento').value,
            bairro: document.getElementById('imoBairro').value,
            cidade: document.getElementById('imoCidade').value,
            estado: document.getElementById('imoEstado').value,
            descricao: document.getElementById('imoDescricao').value,
            fotos: fotosUrls,
            status: 'Ativo'
        };

        const { error } = await supabase.from('imoveis').insert([payload]);

        if (error) {
            console.error(error);
            msg.style.color = '#ff4444';
            msg.innerText = 'Ocorreu um erro ao gravar o imóvel.';
        } else {
            msg.style.color = '#25D366'; 
            msg.innerText = 'Imóvel e fotos guardados com sucesso!';
            formImovel.reset();
            document.getElementById('previewFotos').innerHTML = '';
            fotosProcessadas = [];
            
            setTimeout(() => { msg.innerText = ''; }, 4000);
        }
    });
}

// Lógica para carregar e gerir Leads
async function carregarLeads() {
    const loading = document.getElementById('loadingLeads');
    const tabela = document.getElementById('tabelaLeads');
    const corpo = document.getElementById('corpoTabelaLeads');

    loading.style.display = 'block';
    tabela.style.display = 'none';

    // Puxa os leads ordenados do mais recente para o mais antigo
    const { data, error } = await supabase.from('leads').select('*').order('created_at', { ascending: false });

    loading.style.display = 'none';

    if (error) {
        corpo.innerHTML = '<tr><td colspan="5">Erro ao carregar leads.</td></tr>';
        tabela.style.display = 'table';
        return;
    }

    if (data.length === 0) {
        corpo.innerHTML = '<tr><td colspan="5">Nenhum contato recebido ainda.</td></tr>';
    } else {
        corpo.innerHTML = '';
        data.forEach(lead => {
            const dataFormatada = new Date(lead.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute:'2-digit' });
            
            // Define a classe CSS baseada no status atual
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

// Função para atualizar o status do lead direto no Supabase
async function atualizarStatusLead(id, novoStatus) {
    const { error } = await supabase.from('leads').update({ status: novoStatus }).eq('id', id);
    if(error) {
        alert('Erro ao atualizar o status do lead.');
    } else {
        // Atualiza a cor da badge visualmente
        const badge = document.getElementById(`badge-${id}`);
        badge.className = 'badge';
        if(novoStatus === 'Novo') badge.classList.add('novo');
        if(novoStatus === 'Em atendimento') badge.classList.add('atendimento');
        if(novoStatus === 'Concluído') badge.classList.add('concluido');
    }
}

checarSessao();
