document.addEventListener("DOMContentLoaded", () => {
    let isRegistering = false;

    const modalMainTitle = document.getElementById("modal-main-title");
    const modalMainSubtitle = document.getElementById("modal-main-subtitle");
    const viewOptions = document.getElementById("view-options");
    const formAuth = document.getElementById("form-auth");
    
    const groupName = document.getElementById("group-name");
    const groupConfirm = document.getElementById("group-confirm-password");
    const inputName = document.getElementById("input-name");
    const inputEmail = document.getElementById("input-email");
    const inputPassword = document.getElementById("input-password");
    const inputConfirm = document.getElementById("input-confirm-password");
    const btnSubmit = document.getElementById("btn-submit-auth");
    const linkToggle = document.getElementById("link-toggle-auth");
    const textPrompt = document.getElementById("text-toggle-prompt");
    const btnEmailMode = document.getElementById("btn-email-mode");
    const btnBackOptions = document.getElementById("btn-back-options");
    
    const alertError = document.getElementById("auth-error");
    const alertSuccess = document.getElementById("auth-success");

    const divLoggedOut = document.getElementById("user-logged-out");
    const divLoggedIn = document.getElementById("user-logged-in");
    const spanUsername = document.getElementById("nav-username");
    const spanUseremail = document.getElementById("nav-useremail");
    const btnLogout = document.getElementById("btn-logout");
    
    const btnGoogle = document.getElementById("btn-google-login");

    checkSession();

    // Clicar em "Entrar com o e-mail" exibe o formulário
    btnEmailMode.addEventListener("click", () => {
        viewOptions.classList.add("d-none");
        formAuth.classList.remove("d-none");
        modalMainTitle.textContent = "Entrar com E-mail";
        modalMainSubtitle.textContent = "Digite seus dados de acesso.";
        isRegistering = false;
        atualizarModoFormulario();
    });

    // Botão Voltar
    btnBackOptions.addEventListener("click", () => {
        formAuth.classList.add("d-none");
        viewOptions.classList.remove("d-none");
        modalMainTitle.textContent = "Acesse sua conta";
        modalMainSubtitle.textContent = "Escolha uma das opções abaixo para entrar.";
        alertError.classList.add("d-none");
        alertSuccess.classList.add("d-none");
    });

    // Alternar entre Entrar e Cadastrar
    linkToggle.addEventListener("click", (e) => {
        e.preventDefault();
        isRegistering = !isRegistering;
        alertError.classList.add("d-none");
        alertSuccess.classList.add("d-none");
        atualizarModoFormulario();
    });

    function atualizarModoFormulario() {
        if (isRegistering) {
            modalMainTitle.textContent = "Criar Nova Conta";
            modalMainSubtitle.textContent = "Preencha os campos para se cadastrar.";
            groupName.classList.remove("d-none");
            groupConfirm.classList.remove("d-none");
            inputName.setAttribute("required", "true");
            inputConfirm.setAttribute("required", "true");
            btnSubmit.textContent = "Cadastrar";
            textPrompt.textContent = "Já tem uma conta?";
            linkToggle.textContent = "Entrar";
        } else {
            modalMainTitle.textContent = "Entrar com E-mail";
            modalMainSubtitle.textContent = "Digite seus dados de acesso.";
            groupName.classList.add("d-none");
            groupConfirm.classList.add("d-none");
            inputName.removeAttribute("required");
            inputConfirm.removeAttribute("required");
            btnSubmit.textContent = "Entrar";
            textPrompt.textContent = "Não tem uma conta?";
            linkToggle.textContent = "Criar conta agora";
        }
    }

    // Submissão do Formulário por E-mail
    formAuth.addEventListener("submit", async (e) => {
        e.preventDefault();
        alertError.classList.add("d-none");
        alertSuccess.classList.add("d-none");

        const email = inputEmail.value.trim();
        const senha = inputPassword.value;
        let endpoint = "/api/login";
        let payload = { email, senha };

        if (isRegistering) {
            const nome = inputName.value.trim();
            const confirmaSenha = inputConfirm.value;

            if (senha !== confirmaSenha) {
                alertError.textContent = "As senhas não coincidem. Digite novamente.";
                alertError.classList.remove("d-none");
                return;
            }

            endpoint = "/api/cadastro";
            payload = { nome, email, senha, confirma_senha: confirmaSenha };
        }

        try {
            const response = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const resultado = await response.json();

            if (!response.ok) {
                throw new Error(resultado.erro || "Ocorreu um erro na requisição.");
            }

            alertSuccess.textContent = isRegistering ? "Conta criada com sucesso!" : "Login realizado com sucesso!";
            alertSuccess.classList.remove("d-none");

            setTimeout(() => {
                atualizarInterfaceLogado(resultado);
                fecharModal();
                formAuth.reset();
            }, 800);

        } catch (err) {
            alertError.textContent = err.message;
            alertError.classList.remove("d-none");
        }
    });

    // Funções de login social (Google)
    btnGoogle.addEventListener("click", () => realizarLoginSocial("Google", "google.user@gmail.com"));

    async function realizarLoginSocial(provedor, emailPadraoExemplo) {
        alertError.classList.add("d-none");
        try {
            const emailReal = prompt(`Confirme seu e-mail do ${provedor} para entrar:`, emailPadraoExemplo);
            if (!emailReal || !emailReal.includes("@")) return;

            const nomeReal = emailReal.split("@")[0];

            const response = await fetch("/api/social-login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: emailReal, nome: nomeReal, provedor: provedor })
            });

            const resultado = await response.json();
            if (!response.ok) throw new Error(resultado.erro);

            alertSuccess.textContent = `Login com ${provedor} realizado com sucesso!`;
            alertSuccess.classList.remove("d-none");

            setTimeout(() => {
                atualizarInterfaceLogado(resultado);
                fecharModal();
            }, 800);

        } catch (err) {
            alertError.textContent = err.message || `Erro ao autenticar com ${provedor}.`;
            alertError.classList.remove("d-none");
        }
    }

    btnLogout.addEventListener("click", async (e) => {
        e.preventDefault();
        await fetch("/api/logout", { method: "POST" });
        checkSession();
    });

    async function checkSession() {
        try {
            const res = await fetch("/api/usuario/atual");
            const data = await res.json();
            if (data.logado) {
                atualizarInterfaceLogado(data);
            } else {
                divLoggedOut.classList.remove("d-none");
                divLoggedIn.classList.add("d-none");
            }
        } catch (e) {
            divLoggedOut.classList.remove("d-none");
            divLoggedIn.classList.add("d-none");
        }
    }

    function atualizarInterfaceLogado(user) {
        divLoggedOut.classList.add("d-none");
        divLoggedIn.classList.remove("d-none");
        spanUsername.textContent = user.nome;
        spanUseremail.textContent = user.email;
    }

    function fecharModal() {
        const modalEl = document.getElementById("loginModal");
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
    }
});
