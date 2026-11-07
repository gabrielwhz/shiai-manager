"use strict";

(async function() {
  if (!sb) {
    telaSemConfig();
    return;
  }

  const st = $("#status"), f = $("#fSenha"), msg = $("#msg");
  let pronto = false;
  const mostrar = (t, tipo) => {
    msg.hidden = !t;
    msg.className = "msg " + (tipo || "");
    msg.textContent = t || "";
  };

  function abrirForm() {
    if (pronto) {
      return;
    }

    pronto = true;
    st.textContent = "Digite a nova senha duas vezes.";
    f.hidden = false;
    f.s1.focus();
  }

  function linkRuim(t) {
    if (pronto) {
      return;
    }

    st.textContent = t || "Este link é inválido ou expirou. Peça um novo link na tela de login, em “Esqueci minha senha”, ou na página Minha conta.";
    $("#voltar").hidden = false;
  }

  const h = new URLSearchParams(location.hash.slice(1));

  if (h.get("error")) {
    return linkRuim();
  }

  sb.auth.onAuthStateChange((ev, session) => {
    if (session && ["PASSWORD_RECOVERY", "SIGNED_IN", "INITIAL_SESSION"].includes(ev)) {
      abrirForm();
    }
  });
  setTimeout(async () => {
    const { data: { session } } = await sb.auth.getSession();

    if (session) {
      abrirForm();
    } else {
      linkRuim();
    }
  }, 1500);

  f.addEventListener("submit", async (e) => {
    e.preventDefault();

    const s1 = f.s1.value, s2 = f.s2.value;

    if (s1.length < 6) {
      return mostrar("A senha precisa ter pelo menos 6 caracteres.", "erro");
    }

    if (s1 !== s2) {
      return mostrar("As duas senhas não são iguais.", "erro");
    }

    await comBotao($("#salvar"), async () => {
      const { error } = await sb.auth.updateUser({ password: s1 });

      if (error) {
        return mostrar(erroTexto(error), "erro");
      }

      f.hidden = true;
      st.textContent = "";
      mostrar("Senha alterada. A partir de agora, entre com a nova senha.", "ok");
      $("#links").hidden = false;
    });
  });
})();
