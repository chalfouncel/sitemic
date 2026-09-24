// --- CONFIGURAÇÃO DO SUPABASE ---
var SUPABASE_URL = 'https://uztsmkhlvoemjbbyebcr.supabase.co';
var SUPABASE_ANON_KEY = 'sb_publishable_nmolEh_G5_hKcfdgy2Xpeg_s4T6ePAz';

var supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Navbar scroll effect
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
});

// Mobile menu toggle
const menuToggle = document.getElementById('menuToggle');
const navLinks = document.getElementById('navLinks');

menuToggle.addEventListener('click', () => {
    navLinks.classList.toggle('active');
});

// Close mobile menu on link click
document.querySelectorAll('.nav-links a').forEach(link => {
    link.addEventListener('click', () => {
        navLinks.classList.remove('active');
    });
});

// Counter animation
const counters = document.querySelectorAll('.stat-number');
const counterSpeed = 50;

const animateCounters = () => {
    counters.forEach(counter => {
        const target = +counter.getAttribute('data-target');
        const count = +counter.innerText;
        const increment = target / counterSpeed;

        if (count < target) {
            counter.innerText = Math.ceil(count + increment);
            setTimeout(() => animateCounters(), 20);
        } else {
            counter.innerText = target;
        }
    });
};

// Intersection Observer for counters
const statsSection = document.querySelector('.hero-stats');
if (statsSection) {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                animateCounters();
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.5 });

    observer.observe(statsSection);
}

// --- FORMULÁRIO DE CONTATO (Envio para o Supabase) ---
const form = document.getElementById('contatoForm');
const formFeedback = document.getElementById('formFeedback');

if (form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Capturar os valores dos campos
        const nome = document.getElementById('nomeLead').value;
        const telefone = document.getElementById('telefoneLead').value;
        const email = document.getElementById('emailLead').value;
        const interesse = document.getElementById('interesseLead').value;
        const mensagem = document.getElementById('mensagemLead').value;

        // Mostrar mensagem de envio em curso
        formFeedback.style.display = 'block';
        formFeedback.style.color = 'var(--silver)';
        formFeedback.innerText = 'A enviar a sua mensagem...';

        // Inserir na tabela 'leads' no Supabase
        const { data, error } = await supabase
            .from('leads')
            .insert([
                { nome: nome, telefone: telefone, email: email, interesse: interesse, mensagem: mensagem }
            ]);

        if (error) {
            console.error('Erro ao guardar lead:', error);
            formFeedback.style.color = '#ff4444'; // Vermelho para erro
            formFeedback.innerText = 'Ocorreu um erro ao enviar. Tente novamente ou contacte por WhatsApp.';
        } else {
            formFeedback.style.color = 'var(--gold)'; // Dourado para sucesso
            formFeedback.innerText = 'Mensagem enviada com sucesso! Entraremos em contacto em breve.';
            form.reset(); // Limpa o formulário
            
            // Esconder a mensagem de sucesso após 5 segundos
            setTimeout(() => {
                formFeedback.style.display = 'none';
            }, 5000);
        }
    });
}

// --- CARREGAMENTO DINÂMICO DE IMÓVEIS ---
async function carregarImoveisSite() {
    const grid = document.getElementById('gridImoveis');
    if (!grid) return;

    grid.innerHTML = '<p style="color: var(--gold); text-align: center; width: 100%;">A buscar oportunidades exclusivas...</p>';

    // Puxa apenas os imóveis ativos
    const { data, error } = await supabase
        .from('imoveis')
        .select('*')
        .eq('status', 'Ativo')
        .order('created_at', { ascending: false });

    if (error) {
        grid.innerHTML = '<p style="color: #ff4444; text-align: center; width: 100%;">Não foi possível carregar o portfólio no momento.</p>';
        return;
    }

    if (data.length === 0) {
        grid.innerHTML = '<p style="color: var(--silver); text-align: center; width: 100%;">Nenhum imóvel disponível para o filtro selecionado.</p>';
        return;
    }

    grid.innerHTML = '';
    data.forEach(imovel => {
        // Define a foto de capa
        let imgCapa = '';
        if (imovel.fotos && imovel.fotos.length > 0) {
            imgCapa = `background-image: url('${imovel.fotos[0]}'); background-size: cover; background-position: center;`;
        } else {
            imgCapa = `background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);`;
        }

        // Formata o preço
        let precoFormatado = 'Sob Consulta';
        if (imovel.finalidade === 'Venda' && imovel.valor_venda) {
            precoFormatado = `R$ ${Number(imovel.valor_venda).toLocaleString('pt-BR')}`;
        } else if (imovel.finalidade === 'Aluguel' && imovel.valor_aluguel) {
            precoFormatado = `R$ ${Number(imovel.valor_aluguel).toLocaleString('pt-BR')}/mês`;
        } else if (imovel.finalidade === 'Venda e Aluguel') {
            precoFormatado = imovel.valor_venda ? `R$ ${Number(imovel.valor_venda).toLocaleString('pt-BR')}` : 'Sob Consulta';
        }

        // Define a tag de destaque
        const destaqueHtml = imovel.destaque ? `<span class="imovel-tag destaque" style="margin-left: 8px;">Destaque</span>` : '';

        // Monta os diferenciais (quartos, área, vagas)
        let featuresHtml = '';
        if (imovel.quartos > 0) featuresHtml += `<span>🛏 ${imovel.quartos} Quartos</span>`;
        if (imovel.area_util > 0) featuresHtml += `<span>📐 ${imovel.area_util}m²</span>`;
        if (imovel.vagas > 0) featuresHtml += `<span>🚗 ${imovel.vagas} Vagas</span>`;

        // Monta o card
        const card = `
            <div class="imovel-card">
                <div class="imovel-img" style="${imgCapa} height: 220px; position: relative; padding: 16px;">
                    <span class="imovel-tag">${imovel.finalidade}</span>
                    ${destaqueHtml}
                </div>
                <div class="imovel-info">
                    <h3>${imovel.titulo}</h3>
                    <p class="imovel-local">📍 ${imovel.bairro}, ${imovel.cidade}</p>
                    <div class="imovel-features" style="display: flex; gap: 16px; padding: 16px 0; border-top: 1px solid rgba(255, 255, 255, 0.05); border-bottom: 1px solid rgba(255, 255, 255, 0.05); margin-bottom: 16px; flex-wrap: wrap;">
                        ${featuresHtml}
                    </div>
                    <div class="imovel-footer">
                        <span class="imovel-price">${precoFormatado}</span>
                        <a href="https://wa.me/5521999999999?text=Olá, tenho interesse no imóvel: ${imovel.titulo}" target="_blank" class="btn-card">Detalhes →</a>
                    </div>
                </div>
            </div>
        `;
        
        grid.innerHTML += card;
    });
}

// Executa o carregamento dos imóveis ao abrir a página
carregarImoveisSite();

// Smooth reveal on scroll
const revealElements = document.querySelectorAll('.imovel-card, .servico-card, .feature');
const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, { threshold: 0.1 });

revealElements.forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(30px)';
    el.style.transition = 'all 0.6s ease';
    revealObserver.observe(el);
});
