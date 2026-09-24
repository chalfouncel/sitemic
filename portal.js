// Configuração do Supabase (Mesmas credenciais do site)
var SUPABASE_URL = 'https://uztsmkhlvoemjbbyebcr.supabase.co';
var SUPABASE_ANON_KEY = 'sb_publishable_nmolEh_G5_hKcfdgy2Xpeg_s4T6ePAz';
var supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const loginSection = document.getElementById('loginSection');
const dashboardSection = document.getElementById('dashboardSection');

// Verifica se já existe uma sessão de utilizador ativa
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

// Lógica de Inserção de Imóveis
const formImovel = document.getElementById('formImovel');
if (formImovel) {
    formImovel.addEventListener('submit', async (e) => {
        e.preventDefault();
        const msg = document.getElementById('imovelMsg');
        msg.style.color = 'var(--gold)';
        msg.innerText = 'A gravar imóvel na base de dados...';

        // Prepara os dados para o Supabase
        const payload = {
            titulo: document.getElementById('imoTitulo').value,
            tipo: document.getElementById('imoTipo').value,
            finalidade: document.getElementById('imoFinalidade').value,
            valor_venda: document.getElementById('imoVenda').value || null,
            valor_aluguel: document.getElementById('imoAluguel').value || null,
            valor_condominio: document.getElementById('imoCondominio').value || null,
            valor_iptu: document.getElementById('imoIptu').value || null,
            area_util: document.getElementById('imoAreaUtil').value || null,
            quartos: document.getElementById('imoQuartos').value || 0,
            suites: document.getElementById('imoSuites').value || 0,
            vagas: document.getElementById('imoVagas').value || 0,
            endereco: document.getElementById('imoEndereco').value,
            descricao: document.getElementById('imoDescricao').value,
            status: 'Ativo'
        };

        const { error } = await supabase.from('imoveis').insert([payload]);

        if (error) {
            console.error(error);
            msg.style.color = '#ff4444';
            msg.innerText = 'Ocorreu um erro ao gravar o imóvel.';
        } else {
            msg.style.color = '#25D366'; // Verde
            msg.innerText = 'Imóvel cadastrado com sucesso!';
            formImovel.reset();
            
            // Limpa a mensagem após 4 segundos
            setTimeout(() => { msg.innerText = ''; }, 4000);
        }
    });
}

// Executa a verificação de sessão ao carregar a página
checarSessao();
