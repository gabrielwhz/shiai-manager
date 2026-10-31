"use strict";
(async function () {
  const notifAtiva = () => location.hash === "#notificacoes";
  const { user, perfil } = await iniciarPagina(notifAtiva() ? "notif" : "comp");

  // Placar para Windows
  if (CFG.PLACAR_DOWNLOAD_URL) { $("#placarLink").hidden = false; $("#placarLink").href = CFG.PLACAR_DOWNLOAD_URL; }
  else $("#placarSem").hidden = false;

  function aba() {
    const n = notifAtiva();
    $("#abaComp").hidden = n; $("#abaNotif").hidden = !n;
    $$(".topo nav a").forEach(a => a.setAttribute("aria-current", (a.hash === "#notificacoes") === n ? "page" : "false"));
    document.title = (n ? "Notificações" : "Minhas competições") + " — Administrador de Campeonatos";
    if (n) carregarNotificacoes();
  }
  window.addEventListener("hashchange", aba);
  $("#btnCriar").onclick = abrirCriar;

  /* ---------- competições ---------- */
  async function carregarCompeticoes() {
    const { data, error } = await sb.from("competicoes").select("id,nome,local,datas,federacao,logo,owner_id,created_at")
      .order("created_at", { ascending: false });
    const box = $("#lista");
    if (error) { box.innerHTML = `<div class="aviso erro">${esc(erroTexto(error))}</div>`; return; }
    if (!data.length) {
      box.innerHTML = `<div class="vazio-box"><h3>Nenhuma competição por aqui</h3>
        <p>Crie a sua primeira competição. Se um organizador convidou você, o convite aparece em <a href="#notificacoes">Notificações</a>.</p></div>`;
      return;
    }
    box.innerHTML = `<div class="comp-grid">${data.map(c => `
      <a class="comp-card" href="competicao.html?id=${c.id}">
        ${logoHTML(c)}
        <div><h3>${esc(c.nome)}</h3>
          <div class="info"><span>${esc(fmtDatas(c.datas))}</span>${c.local ? `<span>${esc(c.local)}</span>` : ""}</div>
          <span class="papel ${c.owner_id === user.id ? "dono" : ""}">${c.owner_id === user.id ? "Organizador" : "Professor"}</span>
        </div>
      </a>`).join("")}</div>`;
  }

  function abrirCriar() {
    const d = modal({ titulo: "Criar competição", largo: true, corpo: formCompeticaoHTML({}, true), acoes: [
      { texto: "Cancelar", classe: "alt" },
      { texto: "Criar competição", onClick: async dd => {
        let lido;
        try { lido = ler(); } catch (e) { return toast(e.message, "erro"); }
        const btn = dd.querySelector(".modal-foot .btn:last-child");
        await comBotao(btn, async () => {
          const { data: comp, error } = await sb.from("competicoes").insert({ ...lido.dados, owner_id: user.id }).select("id").single();
          if (error) return toast(erroTexto(error), "erro");
          if (lido.categorias.length) {
            const linhas = lido.categorias.map((c, i) => { const { id, ...r } = c; return { ...r, competicao_id: comp.id, codigo: i + 1 }; });
            const { error: e2 } = await sb.from("categorias").insert(linhas);
            if (e2) toast("A competição foi criada, mas as categorias não foram salvas: " + erroTexto(e2), "erro");
          }
          location.href = `competicao.html?id=${comp.id}`;
        });
      } }
    ] });
    const ler = bindFormCompeticao(d, {}, true);
    setTimeout(() => d.querySelector("[name=nome]").focus(), 50);
  }

  /* ---------- notificações ---------- */
  async function carregarNotificacoes() {
    const box = $("#notifs");
    const { data, error } = await sb.from("convites").select("*").eq("convidado_id", user.id)
      .order("created_at", { ascending: false }).limit(50);
    if (error) { box.innerHTML = `<div class="aviso erro">${esc(erroTexto(error))}</div>`; return; }
    if (!data.length) { box.innerHTML = `<p class="mut">Nenhuma notificação. Quando um organizador convidar você para uma competição, o convite aparece aqui.</p>`; return; }
    box.innerHTML = data.map(c => {
      const pend = c.status === "pendente";
      const txt = pend
        ? `<b>${esc(c.convidado_por_nome || "Um organizador")}</b> convidou você para cadastrar atletas em <b>${esc(c.competicao_nome || "uma competição")}</b>.`
        : `Você ${c.status === "aceito" ? "aceitou" : "recusou"} o convite para <b>${esc(c.competicao_nome || "uma competição")}</b>.`;
      return `<div class="notif ${pend ? "nova" : "velha"}">
        <span class="ic" aria-hidden="true">${pend ? "✉" : c.status === "aceito" ? "✓" : "–"}</span>
        <div><p>${txt}</p><span class="quando">${esc(quando(pend ? c.created_at : (c.respondido_em || c.created_at)))}</span></div>
        <div class="row">${pend
          ? `<button class="btn alt sm" data-recusar="${c.id}">Recusar</button><button class="btn sm" data-aceitar="${c.id}">Aceitar</button>`
          : c.status === "aceito" ? `<a class="btn alt sm" href="competicao.html?id=${c.competicao_id}">Abrir</a>` : ""}</div>
      </div>`;
    }).join("");
  }
  $("#notifs").addEventListener("click", async e => {
    const b = e.target.closest("[data-aceitar],[data-recusar]"); if (!b) return;
    const aceitar = !!b.dataset.aceitar, id = b.dataset.aceitar || b.dataset.recusar;
    b.disabled = true;
    const { data, error } = await sb.rpc("responder_convite", { p_convite: id, p_aceitar: aceitar });
    if (error) { b.disabled = false; return toast(erroTexto(error), "erro"); }
    atualizarSino(user.id);
    if (aceitar) { toast("Convite aceito."); location.href = `competicao.html?id=${data}`; }
    else { toast("Convite recusado."); carregarNotificacoes(); }
  });

  await carregarCompeticoes();
  aba();
  const pend = await atualizarSino(user.id);
  if (pend) $("#lista").insertAdjacentHTML("afterbegin", `<div class="aviso" style="margin-bottom:16px">Você tem ${pend} convite(s) esperando resposta. <a href="#notificacoes">Ver em Notificações</a></div>`);
})();
