"use strict";
(async function () {
  let { user, perfil } = await iniciarPagina("conta");
  let avatar = perfil.avatar || null;

  $("#nome").value = perfil.nome || "";
  $("#email").value = user.email;
  $("#emailSenha").textContent = user.email;

  function pintarFoto() {
    $("#fotoPrev").innerHTML = avatarHTML({ avatar, nome: $("#nome").value || user.email }, "av grande");
    $("#fotoTirar").hidden = !avatar;
  }
  pintarFoto();
  $("#nome").addEventListener("input", () => { if (!avatar) pintarFoto(); });
  $("#fotoFile").onchange = async e => {
    try { avatar = await lerImagem(e.target.files[0], 256); pintarFoto(); toast("Foto escolhida. Clique em Salvar perfil."); }
    catch (err) { toast(err.message, "erro"); }
    e.target.value = "";
  };
  $("#fotoTirar").onclick = () => { avatar = null; pintarFoto(); };

  /* ---------- perfil ---------- */
  $("#salvarPerfil").onclick = e => comBotao(e.currentTarget, async () => {
    const nome = $("#nome").value.trim().replace(/\s+/g, " ");
    if (!nome) { $("#nome").focus(); return toast("Escreva o seu nome.", "erro"); }
    const { data, error } = await sb.from("profiles").update({ nome, avatar }).eq("id", user.id).select().single();
    if (error) return toast(erroTexto(error), "erro");
    perfil = data;
    montarTopo(perfil, "conta"); atualizarSino(user.id);
    toast("Perfil salvo.");
  });

  /* ---------- senha (link por e-mail) ---------- */
  $("#enviarLink").onclick = e => comBotao(e.currentTarget, async () => {
    const { error } = await sb.auth.resetPasswordForEmail(user.email, { redirectTo: new URL("nova-senha.html", location.href).href });
    if (error) return toast(erroTexto(error), "erro");
    const m = $("#msgSenha");
    m.hidden = false;
    m.textContent = `Link enviado para ${user.email}. Ele chega em alguns minutos; confira também a caixa de spam.`;
  });

  /* ---------- excluir conta ---------- */
  const { count } = await sb.from("competicoes").select("id", { count: "exact", head: true }).eq("owner_id", user.id);
  const n = count || 0;
  $("#txtExcluir").innerHTML = (n
    ? `Você organiza <b>${n} competição(ões)</b>. Elas serão apagadas com as categorias, os atletas, as chaves e os convites. `
    : "") + "Os atletas que você cadastrou em competições de outros organizadores continuam inscritos. Não dá para desfazer.";

  $("#excluirConta").onclick = async e => {
    const senha = $("#senhaExcluir").value;
    if (!senha) { $("#senhaExcluir").focus(); return toast("Digite a sua senha.", "erro"); }
    const ok = await confirmar(`Excluir a conta <b>${esc(user.email)}</b> para sempre?${n ? ` As ${n} competição(ões) que você organiza também serão apagadas.` : ""}`,
      { titulo: "Excluir conta", ok: "Excluir minha conta", perigo: true });
    if (!ok) return;
    await comBotao(e.target, async () => {
      const { error } = await sb.rpc("excluir_minha_conta", { p_senha: senha });
      if (error) { $("#senhaExcluir").select(); return toast(erroTexto(error), "erro"); }
      window.__semRedirect = true;
      try { await sb.auth.signOut({ scope: "local" }); } catch (err) { /* a conta já não existe */ }
      location.replace("login.html?conta=excluida");
    });
  };
})();
