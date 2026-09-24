var SUPABASE_URL = 'https://uztsmkhlvoemjbbyebcr.supabase.co';
var SUPABASE_ANON_KEY = 'sb_publishable_nmolEh_G5_hKcfdgy2Xpeg_s4T6ePAz';
var supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const loginSection = document.getElementById('loginSection');
const dashboardSection = document.getElementById('dashboardSection');

async function checarSessao() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        loginSection.style.display = 'none';
        dashboardSection.style.display = 'block';
    } else {
        loginSection.style.display = 'block';
        dashboardSection.style.display = 'none';
    }
}

async function fazerLogin() {
    const email = document.getElementById('loginEmail').value;
    const senha = document.getElementById('loginSenha').value;
    const msg = document.getElementById('loginMsg');
    msg.style.display = 'block'; msg.style.color = 'var(--gold)'; msg.innerText = 'A verificar...';

    const { error } = await supabase.auth.signInWithPassword({ email: email, password: senha });
    if (error) { msg.style.color = '#ff4444'; msg.innerText = 'Acesso negado.'; } 
    else { msg.style.display = 'none'; checarSessao(); }
}

async function fazerLogout() { await supabase.auth.signOut(); checarSessao(); }

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
        carregarLeadsApp();
    }
}

// Busca CEP Automática
const cepInput = document.getElementById('imoCep');
if (cepInput) {
    cepInput.addEventListener('blur', async function() {
        let cep = this.value.replace(/\D/g, '');
        if (cep.length === 8) {
            try {
                const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
                const dados = await res.json();
                if (!dados.erro) {
                    document.getElementById('imoEndereco').value = dados.logradouro;
                    document.getElementById('imoBairro').value = dados.bairro;
                    document.getElementById('imoCidade').value = dados.localidade;
                    document.getElementById('imoEstado').value = dados.uf;
                    document.getElementById('imoNumero').focus();
                }
            } catch (e) {}
        }
    });
}

// Lógica de Fotos (Marca d'água)
let fotosProcessadas = [];
document.getElementById('imoFotos').addEventListener('change', async function(e) {
    const preview = document.getElementById('previewFotos');
    preview.innerHTML = '<span style="color:var(--gold); font-size:12px;">Processando...</span>';
    fotosProcessadas = [];
    const files = e.target.files;
    if(files.length === 0) { preview.innerHTML = ''; return; }

    const marca = new Image(); marca.src = 'marca-dagua.png';
    await new Promise(r => { marca.onload = r; marca.onerror = r; });
    preview.innerHTML = '';

    for(let file of files) {
        const img = new Image(); img.src = URL.createObjectURL(file);
        await new Promise(r => img.onload = r);
        const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d');
        canvas.width = img.width; canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        if (marca.width > 0) {
            ctx.globalAlpha = 0.4; 
            const w = canvas.width * 0.4; const h = (marca.height / marca.width) * w;
            ctx.drawImage(marca, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
            ctx.globalAlpha = 1.0;
        }

        const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.8));
        fotosProcessadas.push(new File([blob], file.name, { type: 'image/jpeg' }));
        const pImg = document.createElement('img'); pImg.src = URL.createObjectURL(blob);
        preview.appendChild(pImg);
    }
});

// Salvar Imóvel
document.getElementById('formImovelApp').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('imovelMsg');
    msg.style.color = 'var(--gold)'; msg.innerText = 'Enviando...';

    const fotosUrls = [];
    for(let file of fotosProcessadas) {
        const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '')}`;
        const { error: upErr } = await supabase.storage.from('imoveis_fotos').upload(fileName, file);
        if(!upErr) fotosUrls.push(supabase.storage.from('imoveis_fotos').getPublicUrl(fileName).data.publicUrl);
    }

    const payload = {
        titulo: document.getElementById('imoTitulo').value, tipo: document.getElementById('imoTipo').value,
        finalidade: document.getElementById('imoFinalidade').value, valor_venda: document.getElementById('imoVenda').value || null,
        valor_aluguel: document.getElementById('imoAluguel').value || null, quartos: document.getElementById('imoQuartos').value || 0,
        vagas: document.getElementById('imoVagas').value || 0, cep: document.getElementById('imoCep').value,
        endereco: document.getElementById('imoEndereco').value, numero: document.getElementById('imoNumero').value,
        complemento: document.getElementById('imoComplemento').value, bairro: document.getElementById('imoBairro').value,
        cidade: document.getElementById('imoCidade').value, estado: document.getElementById('imoEstado').value,
        descricao: document.getElementById('imoDescricao').value, fotos: fotosUrls, status: 'Ativo'
    };

    const { error } = await supabase.from('imoveis').insert([payload]);
    if (error) { msg.style.color = '#ff4444'; msg.innerText = 'Erro ao salvar.'; } 
    else {
        msg.style.color = '#25D366'; msg.innerText = 'Salvo com sucesso!';
        document.getElementById('formImovelApp').reset(); document.getElementById('previewFotos').innerHTML = ''; fotosProcessadas = [];
        setTimeout(() => msg.innerText = '', 3000);
    }
});

// Carregar Leads no App
async function carregarLeadsApp() {
    const loading = document.getElementById('loadingLeads');
    const lista = document.getElementById('listaLeads');
    loading.style.display = 'block'; lista.innerHTML = '';

    const { data, error } = await supabase.from('leads').select('*').order('created_at', { ascending: false });
    loading.style.display = 'none';

    if (error) { lista.innerHTML = '<p>Erro ao carregar leads.</p>'; return; }
    if (data.length === 0) { lista.innerHTML = '<p>Nenhum lead.</p>'; return; }

    data.forEach(lead => {
        const dataFmt = new Date(lead.created_at).toLocaleDateString('pt-BR');
        let css = 'novo'; if(lead.status === 'Em atendimento') css = 'atendimento'; if(lead.status === 'Concluído') css = 'concluido';
        
        lista.innerHTML += `
            <div class="lead-item">
                <span class="badge ${css}" id="badgeApp-${lead.id}">${lead.interesse}</span>
                <div style="font-size:14px; margin-bottom:10px;">
                    <strong>${lead.nome}</strong><br>
                    <a href="https://wa.me/55${lead.telefone.replace(/\D/g,'')}" style="color:var(--gold)">${lead.telefone}</a><br>
                    <span style="font-size:12px; color:var(--gray)">${dataFmt}</span>
                </div>
                <div class="form-group" style="margin:0;">
                    <select onchange="updateStatusApp('${lead.id}', this.value)" style="padding:8px; font-size:12px;">
                        <option value="Novo" ${lead.status === 'Novo' ? 'selected' : ''}>Novo</option>
                        <option value="Em atendimento" ${lead.status === 'Em atendimento' ? 'selected' : ''}>Em atendimento</option>
                        <option value="Concluído" ${lead.status === 'Concluído' ? 'selected' : ''}>Concluído</option>
                    </select>
                </div>
            </div>
        `;
    });
}

async function updateStatusApp(id, status) {
    await supabase.from('leads').update({ status: status }).eq('id', id);
    const badge = document.getElementById(`badgeApp-${id}`);
    badge.className = 'badge';
    if(status === 'Novo') badge.classList.add('novo');
    if(status === 'Em atendimento') badge.classList.add('atendimento');
    if(status === 'Concluído') badge.classList.add('concluido');
}

checarSessao();
