"use strict";

(async function() {
  if (CFG.PLACAR_DOWNLOAD_URL) {
    $("#down").hidden = false;
    $("#downLink").href = CFG.PLACAR_DOWNLOAD_URL;
  }

  if (!sb) {
    telaSemConfig();
    return;
  }

  const h = new URLSearchParams(location.hash.slice(1));
  const erroLink = h.get("error_code") || h.get("error");

  if (erroLink) {
    history.replaceState(null, "", location.pathname + location.search);
  }

  const { data: { session } } = await sb.auth.getSession();

  if (session) {
    location.replace("painel.html");
    return;
  }

  const f = $("#form"), msg = $("#msg");
  const urlConfirmacao = new URL("painel.html?confirmado=1", location.href).href;
  let emailPendente = "";

  const mostrar = (t, tipo = "") => {
    msg.hidden = !t;
    msg.className = "msg " + tipo;
    msg.textContent = t || "";
  };

  const pedirConfirmacao = (email, texto) => {
    emailPendente = email;
    mostrar(texto, "ok");
    $("#reenvio").hidden = false;
  };

  function modo() {
    const criar = location.hash === "#criar";

    $("#tEntrar").setAttribute("aria-current", criar ? "false" : "page");
    $("#tCriar").setAttribute("aria-current", criar ? "page" : "false");
    $("#titulo").textContent = criar ? "Criar conta" : "Entrar";
    $("#sub").textContent = criar ? "Organizadores e professores usam o mesmo tipo de conta." : "Use o e-mail e a senha da sua conta.";
    $("#campoNome").hidden = !criar;
    $("#enviar").textContent = criar ? "Criar conta" : "Entrar";
    f.senha.autocomplete = criar ? "new-password" : "current-password";
    $("#esqueci").hidden = criar;
    $("#reenvio").hidden = true;
    mostrar("");
    return criar;
  }

  window.addEventListener("hashchange", modo);
  modo();

  if (new URLSearchParams(location.search).get("conta") === "excluida") {
    mostrar("Sua conta foi excluída.", "ok");
  }

  if (erroLink) {
    mostrar(/expired/i.test(h.get("error_code") + " " + h.get("error_description"))
      ? "Este link expirou ou já foi usado. Entre com seu e-mail e senha. Se a conta ainda não foi confirmada, peça um novo e-mail de confirmação."
      : "Não foi possível usar este link. Tente entrar com seu e-mail e senha.", "erro");
  }

  let espera = 0, timer = null;

  $("#btnReenviar").onclick = async () => {
    const email = emailPendente || f.email.value.trim().toLowerCase();

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return mostrar("Digite o seu e-mail no campo acima.", "erro");
    }

    const b = $("#btnReenviar");

    if (espera) {
      return;
    }

    b.disabled = true;

    const { error } = await sb.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: urlConfirmacao }
    });

    if (error) {
      b.disabled = false;
      return mostrar(erroTexto(error), "erro");
    }

    mostrar(`Enviamos um novo e-mail de confirmação para ${email}. Confira também a caixa de spam.`, "ok");
    espera = 60;
    b.textContent = `Reenviar de novo em ${espera} s`;

    timer = setInterval(() => {
      espera--;

      if (espera <= 0) {
        clearInterval(timer);
        b.disabled = false;
        b.textContent = "Reenviar e-mail de confirmação";
      } else {
        b.textContent = `Reenviar de novo em ${espera} s`;
      }
    }, 1000);
  };

  $("#esqueci").onclick = () => modal({
    titulo: "Esqueci minha senha",
    corpo: `<p class="mut">Digite o e-mail da sua conta. Vamos enviar um link para você criar uma nova senha.</p>
      <label class="field">E-mail<input type="email" id="emailRec" autocomplete="email" value="${esc(f.email.value.trim())}"></label>`,
    acoes: [{ texto: "Cancelar", classe: "alt" }, {
      texto: "Enviar link",
      onClick: async (dd) => {
        const email = $("#emailRec", dd).value.trim().toLowerCase();

        if (!/^\S+@\S+\.\S+$/.test(email)) {
          return toast("Digite um e-mail válido.", "erro");
        }

        await comBotao(dd.querySelector(".modal-foot .btn:last-child"), async () => {
          const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: new URL("nova-senha.html", location.href).href });

          if (error) {
            return toast(erroTexto(error), "erro");
          }

          dd.close();
          mostrar("Se existir uma conta com esse e-mail, o link para criar a nova senha chega em alguns minutos. Confira também a caixa de spam.", "ok");
        });
      }
    }]
  });

  f.addEventListener("submit", async (e) => {
    e.preventDefault();

    const criar = location.hash === "#criar";
    const nome = f.nome.value.trim(), email = f.email.value.trim().toLowerCase(), senha = f.senha.value;

    if (criar && !nome) {
      return mostrar("Escreva o seu nome.", "erro");
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return mostrar("Digite um e-mail válido.", "erro");
    }

    if (senha.length < 6) {
      return mostrar("A senha precisa ter pelo menos 6 caracteres.", "erro");
    }

    const btn = $("#enviar");

    btn.disabled = true;
    $("#reenvio").hidden = true;
    mostrar("Aguarde…");

    try {
      if (criar) {
        const { data, error } = await sb.auth.signUp({
          email,
          password: senha,
          options: { data: { nome }, emailRedirectTo: urlConfirmacao }
        });

        if (error) {
          throw error;
        }

        if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
          throw new Error("Já existe uma conta com esse e-mail. Use a opção Entrar.");
        }

        if (!data.session) {
          history.replaceState(null, "", "#entrar");
          modo();
          f.email.value = email;
          f.senha.value = "";
          pedirConfirmacao(email, `Conta criada! Enviamos um e-mail para ${email}. Abra a mensagem e clique em “Confirmar minha conta” para entrar. Confira também a caixa de spam.`);
          return;
        }
      } else {
        const { error } = await sb.auth.signInWithPassword({ email, password: senha });

        if (error) {
          if (/Email not confirmed/i.test(error.message)) {
            pedirConfirmacao(email, `Esta conta ainda não foi confirmada. Abra o e-mail que enviamos para ${email} e clique em “Confirmar minha conta”.`);
            return;
          }

          throw error;
        }
      }

      location.replace("painel.html");
    } catch (err) {
      mostrar(erroTexto(err), "erro");
    } finally {
      btn.disabled = false;
    }
  });
})();
