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
