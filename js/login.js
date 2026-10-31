"use strict";
(async function () {
  if (CFG.PLACAR_DOWNLOAD_URL) { $("#down").hidden = false; $("#downLink").href = CFG.PLACAR_DOWNLOAD_URL; }
  if (!sb) { telaSemConfig(); return; }
  const { data: { session } } = await sb.auth.getSession();
  if (session) { location.replace("painel.html"); return; }

  const f = $("#form"), msg = $("#msg");
  const mostrar = (t, tipo = "") => { msg.hidden = !t; msg.className = "msg " + tipo; msg.textContent = t || ""; };
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
    mostrar("");
    return criar;
  }
  window.addEventListener("hashchange", modo);
  modo();
  if (new URLSearchParams(location.search).get("conta") === "excluida") mostrar("Sua conta foi excluída.", "ok");

  $("#esqueci").onclick = () => modal({
    titulo: "Esqueci minha senha",
    corpo: `<p class="mut">Digite o e-mail da sua conta. Vamos enviar um link para você criar uma nova senha.</p>
      <label class="field">E-mail<input type="email" id="emailRec" autocomplete="email" value="${esc(f.email.value.trim())}"></label>`,
    acoes: [{ texto: "Cancelar", classe: "alt" }, { texto: "Enviar link", onClick: async dd => {
      const email = $("#emailRec", dd).value.trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(email)) return toast("Digite um e-mail válido.", "erro");
      await comBotao(dd.querySelector(".modal-foot .btn:last-child"), async () => {
        const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: new URL("nova-senha.html", location.href).href });
        if (error) return toast(erroTexto(error), "erro");
        dd.close();
        mostrar("Se existir uma conta com esse e-mail, o link para criar a nova senha chega em alguns minutos. Confira também a caixa de spam.", "ok");
      });
    } }]
  });

  f.addEventListener("submit", async e => {
    e.preventDefault();
    const criar = location.hash === "#criar";
    const nome = f.nome.value.trim(), email = f.email.value.trim().toLowerCase(), senha = f.senha.value;
    if (criar && !nome) return mostrar("Escreva o seu nome.", "erro");
    if (!/^\S+@\S+\.\S+$/.test(email)) return mostrar("Digite um e-mail válido.", "erro");
    if (senha.length < 6) return mostrar("A senha precisa ter pelo menos 6 caracteres.", "erro");
    const btn = $("#enviar"); btn.disabled = true; mostrar("Aguarde…");
    try {
      if (criar) {
        const { data, error } = await sb.auth.signUp({ email, password: senha, options: { data: { nome } } });
        if (error) throw error;
        if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0)
          throw new Error("Já existe uma conta com esse e-mail. Use a opção Entrar.");
        if (!data.session) { history.replaceState(null, "", "#entrar"); modo(); mostrar("Conta criada. Abra o e-mail que enviamos para confirmar e depois entre aqui.", "ok"); return; }
      } else {
        const { error } = await sb.auth.signInWithPassword({ email, password: senha });
        if (error) throw error;
      }
      location.replace("painel.html");
    } catch (err) { mostrar(erroTexto(err), "erro"); }
    finally { btn.disabled = false; }
  });
})();
