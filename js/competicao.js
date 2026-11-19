"use strict";

(async function() {
  const { user, perfil } = await iniciarPagina("comp");
  const app = $("#app");
  const id = new URLSearchParams(location.search).get("id");

  $("#listaFaixas").innerHTML = FAIXAS.map(f => `<option value="${f}">`).join("");

  const S = {
    comp: null,
    dono: false,
    cats: [],
    atletas: [],
    chaves: {},
    membros: [],
    convites: [],
    catSel: null,
    editId: null,
    busca: "",
    papel: "professor",
    mesas: {},
    lutas: {}
  };

  const fase = () => S.comp.status || "inscricoes";
  const travado = () => fase() !== "inscricoes";

  const PAPEL = {
    dono: "Organizador",
    professor: "Professor",
    mesario: "Mesário"
  };

  const catById = cid => S.cats.find(c => c.id === cid);

  const modTxt = a => {
    const m = new Set((a.categorias || []).map(catById).filter(Boolean).map(c => c.modalidade));

    return m.has("kata") && m.has("kumite") ? "Kata e Kumitê" : m.has("kata") ? "Kata" : m.has("kumite") ? "Kumitê" : "nenhuma modalidade";
  };

  const atletasDaCat = cid => S.atletas.filter(a => (a.categorias || []).includes(cid)).sort((a, b) => cmpNome(a.nome, b.nome));
  const equipeKey = "equipe:" + user.id;

  function naoEncontrada(err) {
    app.innerHTML = `<div class="vazio-box"><h3>Competição não encontrada</h3>
      <p>${err ? esc(erroTexto(err)) : "Ela pode ter sido excluída, ou você não tem acesso a ela."}</p>
      <p style="margin-top:14px"><a class="btn" href="painel.html">Voltar para minhas competições</a></p></div>`;
  }

  if (!id) {
    return naoEncontrada();
  }

  const { data: comp, error } = await sb.from("competicoes").select("*").eq("id", id).maybeSingle();

  if (error || !comp) {
    return naoEncontrada(error);
  }

  S.comp = comp;
  S.dono = comp.owner_id === user.id;
  document.title = comp.nome + " — Shiai Manager";

  if (S.dono) {
    S.papel = "dono";
  } else {
    const { data: eu } = await sb.from("competicao_membros")
      .select("papel")
      .eq("competicao_id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    S.papel = (eu && eu.papel) || "professor";
  }

  const ABAS = S.papel === "dono"
    ? [["atletas", "Atletas"], ["categorias", "Categorias"], ["chaves", "Súmulas"], ["equipe", "Equipe"], ["dados", "Dados da competição"]]
    : S.papel === "professor" ? [["atletas", "Meus atletas"]] : [];

  app.innerHTML = `<section class="comp-hero" id="hero"></section>
    <div id="faixaFase"></div>
    ${ABAS.length ? `<nav class="tabs" id="abas" aria-label="Seções da competição">${ABAS.map(([k, t]) => `<a href="#${k}" data-aba="${k}">${t}</a>`).join("")}</nav>` : ""}
    ${ABAS.map(([k]) => `<section id="sec-${k}" hidden></section>`).join("")}
    ${S.papel === "mesario" ? `<section id="sec-mesario"></section>` : ""}`;

  async function carregarCats() {
    const { data, error } = await sb.from("categorias")
      .select("*")
      .eq("competicao_id", id)
      .order("codigo", { ascending: true });

    if (error) {
      throw error;
    }

    S.cats = data;
  }

  async function carregarAtletas() {
    const { data, error } = await sb.from("atletas").select("*").eq("competicao_id", id);

    if (error) {
      throw error;
    }

    S.atletas = data.sort((a, b) => cmpNome(a.nome, b.nome));
  }

  async function carregarChaves() {
    const { data, error } = await sb.from("chaves")
      .select("categoria_id,dados,updated_at")
      .eq("competicao_id", id);

    if (error) {
      throw error;
    }

    S.chaves = Object.fromEntries(data.map(c => [c.categoria_id, c]));
  }

  async function carregarResultados() {
    if (fase() === "inscricoes") {
      S.mesas = {};
      S.lutas = {};
      return;
    }

    const [m, l] = await Promise.all([
      sb.from("mesas").select("*").eq("competicao_id", id),
      sb.from("lutas").select("*").eq("competicao_id", id)
    ]);

    if (m.error) {
      throw m.error;
    }

    if (l.error) {
      throw l.error;
    }

    S.mesas = Object.fromEntries(m.data.map(x => [x.categoria_id, x]));
    S.lutas = {};

    for (const x of l.data) {
      (S.lutas[x.categoria_id] = S.lutas[x.categoria_id] || {})[x.chave] = x;
    }
  }

  async function carregarEquipe() {
    const [m, c] = await Promise.all([
      sb.from("competicao_membros")
        .select("*")
        .eq("competicao_id", id)
        .order("created_at"),
      sb.from("convites")
        .select("*")
        .eq("competicao_id", id)
        .neq("status", "aceito")
        .order("created_at", { ascending: false })
    ]);

    if (m.error) {
      throw m.error;
    }

    if (c.error) {
      throw c.error;
    }

    S.membros = m.data;
    S.convites = c.data;
  }

  try {
    await Promise.all([
      S.papel !== "mesario" && carregarCats(),
      S.papel !== "mesario" && carregarAtletas(),
      S.dono && carregarChaves(),
      S.dono && carregarEquipe(),
      S.dono && carregarResultados()
    ]);
  } catch (e) {
    app.insertAdjacentHTML("afterbegin", `<div class="aviso erro" style="margin-bottom:16px">${esc(erroTexto(e))}</div>`);
  }

  const urlMesa = () => `mesa.html?id=${id}`;

  function hero() {
    const c = S.comp, f = fase();
    const meuPapel = S.papel === "dono" ? "Você é o organizador" : S.papel === "mesario" ? "Você é mesário" : "Você é professor convidado";
    const botoes = [];

    if (S.dono && f === "inscricoes") {
      botoes.push(`<button class="btn" id="iniciarComp" type="button">${ICONE.play} Iniciar competição</button>`);
    }

    if (f === "andamento") {
      botoes.push(`<a class="btn" href="${urlMesa()}">${ICONE.mesa} Abrir mesa da competição</a>`);
    }

    if (S.dono && f === "andamento") {
      botoes.push(`<button class="btn alt" id="finalizarComp" type="button">Finalizar competição</button>`);
    }

    if (S.dono && f === "finalizada") {
      botoes.push(`<button class="btn alt" id="reabrirComp" type="button">Reabrir competição</button>`);
    }

    if (!S.dono) {
      botoes.push(`<button class="btn ghost sm" id="sairComp" type="button">Sair da competição</button>`);
    }

    $("#hero").innerHTML = `${logoHTML(c)}
      <div><h1>${esc(c.nome)}</h1>
        <div class="info"><span>${esc(fmtDatas(c.datas))}</span>${c.local ? `<span>${esc(c.local)}</span>` : ""}${c.federacao ? `<span>${esc(c.federacao)}</span>` : ""}</div>
        <div class="row" style="gap:6px;margin-top:8px"><span class="papel ${S.dono ? "dono" : ""}" style="margin:0">${meuPapel}</span>${chipFase(f)}</div></div>
      <div class="acoes-hero">${botoes.join("")}</div>`;

    const faixa = $("#faixaFase");

    if (f === "andamento") {
      faixa.innerHTML = `<div class="faixa-fase andamento" role="status">${ICONE.cadeado}<div><b>Competição em andamento.</b> Inscrições, categorias e súmulas estão trancadas enquanto a competição estiver em andamento. Os resultados são registrados pela mesa da competição.</div></div>`;
    } else if (f === "finalizada") {
      faixa.innerHTML = `<div class="faixa-fase finalizada" role="status">${ICONE.cadeado}<div><b>Competição finalizada.</b> As súmulas e os resultados ficam disponíveis para consulta e download.${S.dono ? " Para corrigir um resultado, reabra a competição." : ""}</div></div>`;
    } else {
      faixa.innerHTML = "";
    }
  }

  function abaAtual() {
    const h = location.hash.slice(1);

    return ABAS.some(a => a[0] === h) ? h : "atletas";
  }

  function mostrarAba() {
    if (!ABAS.length) {
      return renderMesario();
    }

    const a = abaAtual();

    ABAS.forEach(([k]) => {
      $("#sec-" + k).hidden = k !== a;
    });

    $$("#abas a").forEach(x => x.setAttribute("aria-current", x.dataset.aba === a ? "page" : "false"));

    ({
      atletas: renderAtletas,
      categorias: renderCategorias,
      chaves: renderChaves,
      equipe: renderEquipe,
      dados: renderDados
    })[a]();
  }

  window.addEventListener("hashchange", mostrarAba);

  function renderAtletas() {
    const semCats = !S.cats.length;
    const trava = travado();

    $("#sec-atletas").innerHTML = `<div class="atl-layout">
      <form class="card atl-form stack" id="fAtl" novalidate>
        <h2 id="fAtlTit">Cadastrar atleta</h2>
        ${trava ? `<div class="aviso alerta">${ICONE.cadeado} As inscrições estão trancadas porque a competição já foi iniciada.</div>` : ""}
        ${semCats && !trava ? `<div class="aviso alerta">${S.dono
        ? `Esta competição ainda não tem categorias. <a href="#categorias">Crie as categorias</a> antes de cadastrar atletas.`
        : "O organizador ainda não criou as categorias desta competição. Volte mais tarde."}</div>` : ""}
        <label class="field">Nome completo<input name="nome" required maxlength="120" autocomplete="off"></label>
        <div class="grid-idade">
          <label class="field">Idade<input name="idade" type="number" min="1" max="120" inputmode="numeric" required></label>
          <div class="field"><span>Sexo</span>
            <div class="seg" role="radiogroup" aria-label="Sexo">
              <label><input type="radio" name="sexo" value="M" checked><span>Masculino</span></label>
              <label><input type="radio" name="sexo" value="F"><span>Feminino</span></label></div></div>
        </div>
        <label class="field">Graduação (faixa)<input name="graduacao" list="listaFaixas" maxlength="40" placeholder="Ex.: Verde"></label>
        <label class="field">Equipe ou academia<input name="equipe" maxlength="80" placeholder="Ex.: Academia Central"></label>
        <div class="field"><span>Atleta PCD</span>
          <label class="interruptor"><input type="checkbox" name="pcd"><span class="trilho" aria-hidden="true"></span><b data-pcdtxt>Não</b></label></div>
        <label class="field" data-pcdbox hidden>Qual a deficiência ou condição?<input name="pcd_descricao" maxlength="120" placeholder="Ex.: deficiência visual"></label>
        <fieldset class="stack" style="gap:10px"><legend>Modalidades e categorias</legend>
          ${["kata", "kumite"].map(m => `<div class="mod-box">
            <label class="check-chip" style="justify-self:start"><input type="checkbox" name="m_${m}"> ${MOD[m]}</label>
            <label class="field" hidden data-catbox="${m}">Categoria de ${MOD[m]}<select name="cat_${m}"></select><span class="hint" data-cathint="${m}"></span></label>
          </div>`).join("")}
        </fieldset>
        <div class="row"><button class="btn" type="submit" id="fAtlBtn" ${semCats || trava ? "disabled" : ""}>Cadastrar atleta</button>
          <button class="btn ghost" type="button" id="fAtlCancel" hidden>Cancelar edição</button></div>
      </form>
      <div class="stack">
        <div class="row"><h2>${S.dono ? "Atletas inscritos" : "Atletas que você cadastrou"} <span class="mut" id="atlCount"></span></h2><span class="spacer"></span>
          ${S.dono ? `<button class="btn alt sm" id="btnLista" type="button">${ICONE.pdf} Tabela de atletas (PDF)</button>` : ""}</div>
        <input type="search" id="busca" placeholder="Buscar por nome, equipe ou categoria" aria-label="Buscar atletas" value="${esc(S.busca)}">
        <div id="atlLista"></div>
      </div></div>`;

    bindFormAtleta();

    if (trava) {
      $$("#fAtl input, #fAtl select, #fAtl button").forEach(x => {
        x.disabled = true;
      });
    }

    listaAtletas();
  }

  function opcoesCat(m, idade, sexo, atual, pcd) {
    const cats = S.cats.filter(c => c.modalidade === m && !!c.pcd === pcd);
    const ok = cats.filter(c => catCompativel(c, idade, sexo)), outras = cats.filter(c => !ok.includes(c));
    const o = c => `<option value="${c.id}" ${c.id === atual ? "selected" : ""}>${c.codigo}. ${esc(nomeCategoria(c))} — ${SEXO[c.sexo]}, ${esc(faixaIdade(c))}${c.faixas ? ", " + esc(c.faixas) : ""}</option>`;
    let h = `<option value="">Escolha a categoria…</option>`;

    if (ok.length) {
      h += `<optgroup label="Combinam com a idade e o sexo">${ok.map(o).join("")}</optgroup>`;
    }

    if (outras.length) {
      h += `<optgroup label="Outras categorias de ${MOD[m]}">${outras.map(o).join("")}</optgroup>`;
    }

    return { h, ok, total: cats.length };
  }

  function atualizarCats(f, manter) {
    const idade = num(f.idade.value), sexo = f.sexo.value, pcd = f.pcd.checked;

    $("[data-pcdbox]", f).hidden = !pcd;
    $("[data-pcdtxt]", f).textContent = pcd ? "Sim" : "Não";

    for (const m of ["kata", "kumite"]) {
      const on = f["m_" + m].checked, box = $(`[data-catbox=${m}]`, f), sel = f["cat_" + m];

      box.hidden = !on;

      if (!on) {
        continue;
      }

      let atual = sel.value || (manter && manter[m]) || "";
      const { h, ok, total } = opcoesCat(m, idade, sexo, atual, pcd);

      if (!manter && !ok.some(c => c.id === atual)) {
        atual = ok.length ? ok[0].id : "";
      }

      sel.innerHTML = h;
      sel.value = atual;

      $(`[data-cathint=${m}]`, f).textContent = !total ? (pcd ? `Não há categorias PCD de ${MOD[m]}. Fale com o organizador.` : `Ainda não há categorias de ${MOD[m]}.`)
        : ok.length > 1 ? `${ok.length} categorias combinam com este atleta. Confira a faixa.`
          : ok.length ? "" : "Nenhuma categoria combina com a idade e o sexo. Escolha em “Outras” ou fale com o organizador.";
    }
  }

  function bindFormAtleta() {
    const f = $("#fAtl");

    try {
      f.equipe.value = localStorage.getItem(equipeKey) || "";
    } catch (e) { }

    f.addEventListener("change", e => {
      if (["idade", "sexo", "pcd", "m_kata", "m_kumite"].includes(e.target.name)) {
        atualizarCats(f);
      }
    });

    f.idade.addEventListener("input", () => atualizarCats(f));
    $("#fAtlCancel").onclick = () => limparForm(f);

    f.addEventListener("submit", async (e) => {
      e.preventDefault();

      const nome = f.nome.value.trim().replace(/\s+/g, " "), idade = num(f.idade.value), sexo = f.sexo.value;
      const graduacao = f.graduacao.value.trim() || null, equipe = f.equipe.value.trim() || null;
      const pcd = f.pcd.checked, pcdDescricao = f.pcd_descricao.value.trim();

      if (!nome) {
        f.nome.focus();
        return toast("Escreva o nome do atleta.", "erro");
      }

      if (idade == null || idade < 1 || idade > 120) {
        f.idade.focus();
        return toast("Informe a idade do atleta.", "erro");
      }

      if (pcd && !pcdDescricao) {
        f.pcd_descricao.focus();
        return toast("Descreva a deficiência ou condição do atleta PCD.", "erro");
      }

      const categorias = [];

      for (const m of ["kata", "kumite"]) {
        if (f["m_" + m].checked) {
          const v = f["cat_" + m].value;

          if (!v) {
            f["cat_" + m].focus();
            return toast(`Escolha a categoria de ${MOD[m]}.`, "erro");
          }

          categorias.push(v);
        }
      }

      if (!categorias.length) {
        return toast("Marque Kata, Kumitê ou os dois.", "erro");
      }

      try {
        localStorage.setItem(equipeKey, equipe || "");
      } catch (err) { }

      const editando = S.editId;

      if (!editando) {
        const ex = S.atletas.find(x => norm(x.nome) === norm(nome) && x.sexo === sexo && x.idade === idade && norm(x.graduacao) === norm(graduacao));

        if (ex && !!ex.pcd !== pcd) {
          return toast(`${ex.nome} já está cadastrado(a) ${ex.pcd ? "como PCD" : "sem a opção PCD"}. Use o botão de editar no cadastro existente.`, "erro");
        }

        if (ex) {
          const temMod = new Set((ex.categorias || []).map(catById).filter(Boolean).map(c => c.modalidade));

          const novas = categorias.filter(cid => {
            const c = catById(cid);

            return c && !temMod.has(c.modalidade);
          });

          if (!novas.length) {
            return toast(`${ex.nome} já está cadastrado(a) em ${modTxt(ex)}.`, "erro");
          }

          const nomesMod = novas.map(cid => MOD[catById(cid).modalidade]).join(" e ");

          if (!await confirmar(`<b>${esc(ex.nome)}</b> já está cadastrado(a) em ${modTxt(ex)}. Adicionar ${nomesMod} a esse mesmo cadastro?`, { titulo: "Atleta já cadastrado", ok: `Adicionar ${nomesMod}` })) {
            return;
          }

          const r = await sb.from("atletas")
            .update({ categorias: [...(ex.categorias || []), ...novas] })
            .eq("id", ex.id)
            .select()
            .single();

          if (r.error) {
            return toast(erroTexto(r.error), "erro");
          }

          Object.assign(ex, r.data);
          toast(`${nomesMod} adicionado ao cadastro de ${ex.nome}.`);
          limparForm(f);
          listaAtletas();
          f.nome.focus();
          return;
        }
      }

      const row = {
        nome,
        idade,
        sexo,
        graduacao,
        equipe,
        categorias,
        pcd,
        pcd_descricao: pcd ? pcdDescricao : null
      };

      await comBotao($("#fAtlBtn"), async () => {
        const r = editando
          ? await sb.from("atletas").update(row).eq("id", editando).select().single()
          : await sb.from("atletas").insert({
            ...row,
            competicao_id: id,
            created_by: user.id,
            cadastrado_por_nome: perfil.nome || perfil.email
          }).select().single();

        if (r.error) {
          return toast(erroTexto(r.error), "erro");
        }

        const i = S.atletas.findIndex(a => a.id === r.data.id);

        if (i >= 0) {
          S.atletas[i] = r.data;
        } else {
          S.atletas.push(r.data);
        }

        S.atletas.sort((a, b) => cmpNome(a.nome, b.nome));
        toast(editando ? "Alterações salvas." : `${nome} cadastrado(a).`);
        limparForm(f);
        listaAtletas();
        f.nome.focus();
      });
    });

    atualizarCats(f);
  }

  function limparForm(f) {
    S.editId = null;

    const eq = f.equipe.value, sx = f.sexo.value, mk = ["kata", "kumite"].map(m => f["m_" + m].checked);

    f.reset();
    f.equipe.value = eq;

    [...f.sexo].forEach(r => {
      r.checked = r.value === sx;
    });

    ["kata", "kumite"].forEach((m, i) => {
      f["m_" + m].checked = mk[i];
      f["cat_" + m].innerHTML = "";
    });

    $("#fAtlTit").textContent = "Cadastrar atleta";
    $("#fAtlBtn").textContent = "Cadastrar atleta";
    $("#fAtlCancel").hidden = true;
    atualizarCats(f);
  }

  function editar(a) {
    const f = $("#fAtl");

    if (!a || !f) {
      return;
    }

    S.editId = a.id;
    f.nome.value = a.nome;
    f.idade.value = a.idade ?? "";

    [...f.sexo].forEach(r => {
      r.checked = r.value === a.sexo;
    });

    f.graduacao.value = a.graduacao || "";
    f.equipe.value = a.equipe || "";
    f.pcd.checked = !!a.pcd;
    f.pcd_descricao.value = a.pcd_descricao || "";

    const manter = {};

    for (const m of ["kata", "kumite"]) {
      const c = (a.categorias || []).map(catById).find(x => x && x.modalidade === m);

      f["m_" + m].checked = !!c;
      f["cat_" + m].innerHTML = "";
      manter[m] = c ? c.id : "";
    }

    atualizarCats(f, manter);
    $("#fAtlTit").textContent = "Editar atleta";
    $("#fAtlBtn").textContent = "Salvar alterações";
    $("#fAtlCancel").hidden = false;
    f.scrollIntoView({ behavior: "smooth", block: "start" });
    f.nome.focus({ preventScroll: true });
  }

  function listaAtletas() {
    const q = norm(S.busca);
    const cs = a => (a.categorias || []).map(catById).filter(Boolean);
    const l = S.atletas.filter(a => !q || norm([a.nome, a.equipe, a.graduacao, a.pcd ? "pcd " + (a.pcd_descricao || "") : "", ...cs(a).map(c => nomeCategoria(c))].join(" ")).includes(q));

    $("#atlCount").textContent = `(${S.atletas.length})`;

    const box = $("#atlLista");

    if (!S.atletas.length) {
      box.innerHTML = `<div class="vazio-box"><p>${S.dono
        ? "Nenhum atleta inscrito ainda. Cadastre pelo formulário ou convide professores na aba Equipe."
        : "Você ainda não cadastrou atletas. Use o formulário para inscrever o primeiro."}</p></div>`;

      return;
    }

    if (!l.length) {
      box.innerHTML = `<p class="mut">Nenhum atleta encontrado para “${esc(S.busca)}”.</p>`;
      return;
    }

    box.innerHTML = `<div class="tab-wrap"><table class="tab cards"><thead><tr><th>Nome</th><th>Idade</th><th>Faixa</th><th>Equipe</th><th>Categorias</th>${S.dono ? "<th>Cadastrado por</th>" : ""}<th></th></tr></thead><tbody>
      ${l.map(a => `<tr>
        <td data-l="Nome"><b>${esc(a.nome)}</b>${chipPcd(a.pcd)}${a.pcd && a.pcd_descricao ? `<div class="mut small">${esc(a.pcd_descricao)}</div>` : ""}</td><td data-l="Idade" class="nowrap">${a.idade ?? ""} <span class="mut">${a.sexo === "F" ? "Fem." : "Masc."}</span></td>
        <td data-l="Faixa">${esc(a.graduacao || "")}</td><td data-l="Equipe">${esc(a.equipe || "")}</td>
        <td data-l="Categorias"><div>${cs(a).map(c => `<span class="chip ${c.modalidade}" title="${MOD[c.modalidade]} ${SEXO[c.sexo]}">${MOD[c.modalidade]}: ${c.codigo}. ${esc(nomeCategoria(c))}</span>`).join("") || '<span class="mut">Nenhuma</span>'}</div></td>
        ${S.dono ? `<td data-l="Cadastrado por">${esc(a.created_by === user.id ? "Você" : (a.cadastrado_por_nome || ""))}</td>` : ""}
        <td class="acoes">${travado() ? "" : `<button class="btn-ic so-ic" type="button" data-edit="${a.id}" title="Editar atleta" aria-label="Editar ${esc(a.nome)}">${ICONE.editar}</button> <button class="btn-ic so-ic danger" type="button" data-del="${a.id}" title="Remover atleta" aria-label="Remover ${esc(a.nome)}">${ICONE.excluir}</button>`}</td></tr>`).join("")}
      </tbody></table></div>`;
  }

  async function removerAtleta(aid) {
    const a = S.atletas.find(x => x.id === aid);

    if (!a) {
      return;
    }

    if (!await confirmar(`Remover <b>${esc(a.nome)}</b> da competição?`, { titulo: "Remover atleta", ok: "Remover", perigo: true })) {
      return;
    }

    const { error } = await sb.from("atletas").delete().eq("id", aid);

    if (error) {
      return toast(erroTexto(error), "erro");
    }

    S.atletas = S.atletas.filter(x => x.id !== aid);

    if (S.editId === aid) {
      limparForm($("#fAtl"));
    }

    listaAtletas();
    toast("Atleta removido.");
  }

  function renderCategorias() {
    const sec = $("#sec-categorias");
    const abertas = new Set($$("details.cat-item[open]", sec).map(x => x.dataset.id));

    sec.innerHTML = `<div class="page-head"><div><h2>Categorias</h2>
        <p>${S.cats.length} categoria(s). Clique em uma categoria para ver os atletas inscritos nela.</p></div>
        <span class="spacer"></span>
        ${S.cats.length ? `<button class="btn alt" id="abrirCats" type="button">Mostrar atletas de todas</button>` : ""}
        ${travado() ? "" : `<button class="btn" id="novaCat" type="button">+ Adicionar categorias</button>`}</div>
      ${S.cats.length ? `<div class="cat-list">${S.cats.map(c => {
      const l = atletasDaCat(c.id);

      return `<details class="cat-item" data-id="${c.id}" ${abertas.has(c.id) ? "open" : ""}>
          <summary>
            <span class="cod-box" title="Código">${c.codigo ?? ""}</span>
            <span class="n"><b>${esc(c.nome)}</b><small><span class="chip ${c.modalidade}">${MOD[c.modalidade]}</span>${chipPcd(c.pcd)} ${SEXO[c.sexo]} — ${esc(faixaIdade(c))}${c.faixas ? " — " + esc(c.faixas) : ""}</small></span>
            <span class="qtd">${ICONE.seta} ${l.length} atleta(s)</span>
            ${travado() ? "" : `<span class="acoes-cat">
              <button class="btn-ic" type="button" data-ecat="${c.id}" title="Editar categoria">${ICONE.editar} Editar</button>
              <button class="btn-ic danger" type="button" data-dcat="${c.id}" title="Excluir categoria">${ICONE.excluir} Excluir</button>
            </span>`}
          </summary>
          <div class="cat-atl">${l.length ? `<table class="tab cards"><thead><tr><th>Nome</th><th>Idade</th><th>Faixa</th><th>Equipe</th><th>Cadastrado por</th></tr></thead><tbody>
            ${l.map(a => `<tr><td data-l="Nome"><b>${esc(a.nome)}</b>${chipPcd(a.pcd)}${a.pcd && a.pcd_descricao ? `<div class="mut small">${esc(a.pcd_descricao)}</div>` : ""}</td><td data-l="Idade">${a.idade ?? ""}</td><td data-l="Faixa">${esc(a.graduacao || "")}</td>
              <td data-l="Equipe">${esc(a.equipe || "")}</td><td data-l="Cadastrado por">${esc(a.created_by === user.id ? "Você" : (a.cadastrado_por_nome || ""))}</td></tr>`).join("")}
            </tbody></table>` : `<p class="mut">Nenhum atleta inscrito nesta categoria.</p>`}</div>
        </details>`;
    }).join("")}</div>`
        : `<div class="vazio-box"><h3>Nenhuma categoria ainda</h3><p>Adicione as categorias para os professores poderem inscrever os atletas.</p></div>`}`;
  }

  function modalCategorias(cat) {
    const editando = !!cat;

    const d = modal({
      titulo: editando ? "Editar categoria" : "Adicionar categorias",
      largo: true,
      corpo: `<div class="cat-rows" id="mCatRows"></div>${editando ? "" : `<div><button type="button" class="btn alt sm" id="mAddCat">+ Adicionar outra categoria</button></div>`}`,
      acoes: [{ texto: "Cancelar", classe: "alt" }, {
        texto: editando ? "Salvar alterações" : "Salvar categorias",
        onClick: async (dd) => {
          let lista;

          try {
            lista = lerLinhasCategoria($("#mCatRows", dd));
          } catch (e) {
            return toast(e.message, "erro");
          }

          if (!lista.length) {
            return toast("Preencha pelo menos uma categoria.", "erro");
          }

          await comBotao(dd.querySelector(".modal-foot .btn:last-child"), async () => {
            if (editando) {
              const { id: _x, ...row } = lista[0];

              if (row.codigo == null) {
                row.codigo = cat.codigo;
              }

              const igual = S.cats.find(c => c.id !== cat.id && c.codigo === row.codigo);

              if (igual) {
                return toast(`O código ${row.codigo} já é da categoria "${igual.nome}".`, "erro");
              }

              const r = await sb.from("categorias").update(row).eq("id", cat.id).select().single();

              if (r.error) {
                return toast(erroTexto(r.error), "erro");
              }

              Object.assign(cat, r.data);
              toast("Categoria atualizada.");
            } else {
              const igual = lista.map(n => S.cats.find(c => n.codigo != null && c.codigo === n.codigo)).find(Boolean);

              if (igual) {
                return toast(`O código ${igual.codigo} já é da categoria "${igual.nome}".`, "erro");
              }

              const rows = atribuirCodigos(lista, S.cats.map(c => c.codigo || 0)).map(c => {
                const { id: _x, ...r } = c;

                return { ...r, competicao_id: id };
              });

              const r = await sb.from("categorias").insert(rows).select();

              if (r.error) {
                return toast(erroTexto(r.error), "erro");
              }

              S.cats.push(...r.data);
              toast(`${r.data.length} categoria(s) adicionada(s).`);
            }

            S.cats.sort((a, b) => (a.codigo || 0) - (b.codigo || 0));
            dd.close();
            renderCategorias();
          });
        }
      }]
    });

    const add = bindLinhasCategoria($("#mCatRows", d), $("#mAddCat", d), { minimo: 1 });

    add(cat || { modalidade: "kata", sexo: "M" });
    setTimeout(() => d.querySelector("[name=nome]").focus(), 50);
  }

  async function excluirCategoria(cid) {
    const c = catById(cid);

    if (!c) {
      return;
    }

    const n = atletasDaCat(cid).length;
    const ok = await confirmar(`Excluir a categoria <b>${esc(c.nome)}</b>?${n ? ` Os ${n} atleta(s) inscritos nela continuam cadastrados, mas ficam sem essa categoria.` : ""}${S.chaves[cid] ? " A chave sorteada também será apagada." : ""}`, { titulo: "Excluir categoria", ok: "Excluir", perigo: true });

    if (!ok) {
      return;
    }

    const { error } = await sb.from("categorias").delete().eq("id", cid);

    if (error) {
      return toast(erroTexto(error), "erro");
    }

    S.cats = S.cats.filter(x => x.id !== cid);

    S.atletas.forEach(a => {
      a.categorias = (a.categorias || []).filter(x => x !== cid);
    });

    delete S.chaves[cid];
    renderCategorias();
    toast("Categoria excluída.");
  }

  const resultadosDe = cid => Object.fromEntries(Object.entries(S.lutas[cid] || {}).map(([k, l]) => [k, { vencedor: l.vencedor, vencedor_id: l.vencedor_id }]));

  function estadoChave(c) {
    const ch = S.chaves[c.id];

    if (!ch) {
      return { cls: "", txt: "Súmula ainda não gerada" };
    }

    if (travado()) {
      const m = S.mesas[c.id];

      if (m && m.status === "concluida") {
        return { cls: "ok", txt: "Categoria concluída" };
      }

      if (m && m.status === "andamento") {
        return { cls: "vivo", txt: m.reservado_por ? `Em andamento${m.koto ? " — " + m.koto : ""}` : "Em andamento (sem mesa aberta)" };
      }

      return { cls: "", txt: "Aguardando a mesa" };
    }

    const d = Chave.diferencas(ch.dados, atletasDaCat(c.id));

    return (d.novos || d.saiu) ? { cls: "mudou", txt: "Atletas mudaram depois do sorteio", d } : { cls: "ok", txt: "Súmula gerada", d };
  }

  const catsComAtletas = () => S.cats.filter(c => atletasDaCat(c.id).length);
  const catsSorteadas = () => S.cats.filter(c => S.chaves[c.id]);

  function renderChaves() {
    const sec = $("#sec-chaves");

    if (!S.cats.length) {
      sec.innerHTML = `<div class="vazio-box"><h3>Sem categorias</h3><p>Crie as categorias na aba <a href="#categorias">Categorias</a>.</p></div>`;
      return;
    }

    if (!S.catSel || !catById(S.catSel)) {
      S.catSel = (S.cats.find(c => atletasDaCat(c.id).length) || S.cats[0]).id;
    }

    const comAtl = catsComAtletas(), sorteadas = catsSorteadas().length;
    const trava = travado();
    const concluidas = S.cats.filter(c => S.mesas[c.id] && S.mesas[c.id].status === "concluida").length;

    const resumo = trava
      ? `${concluidas} de ${sorteadas} categoria(s) concluída(s). Atualiza sozinho a cada 15 segundos.`
      : `${sorteadas} súmula(s) gerada(s). ${comAtl.length} categoria(s) com atletas.`;

    sec.innerHTML = `<div class="page-head"><div><h2>Súmulas</h2>
        <p>${resumo}</p></div><span class="spacer"></span>
        ${trava ? "" : `<button class="btn" id="sortTodas" type="button" ${comAtl.length ? "" : "disabled"}>Sortear todas</button>`}</div>
      <div class="card row" style="margin-bottom:18px">
        <span class="mut small" style="margin-right:4px">Todas as súmulas:</span>
        <button class="btn alt sm" id="pdfTodas" type="button" ${sorteadas ? "" : "disabled"}>${ICONE.pdf} Todas em um único PDF</button>
        <button class="btn alt sm" id="zipTodas" type="button" ${sorteadas ? "" : "disabled"}>${ICONE.zip} Todas em ZIP (uma por arquivo)</button>
        <button class="btn alt sm" id="sumBranco" type="button">${ICONE.pdf} Súmula em branco</button>
        <button class="btn alt sm" id="kumiteBranco" type="button">${ICONE.pdf} Súmula de kumitê</button>
        <span class="spacer"></span>
        ${trava ? "" : `<button class="btn ghost sm perigo-txt" id="apagarTodas" type="button" ${sorteadas ? "" : "disabled"}>${ICONE.excluir} Apagar todas</button>`}
      </div>
      <div class="chv-layout">
        <div class="chv-lista" id="chvLista">${S.cats.map(c => {
      const st = estadoChave(c);

      return `
          <button type="button" class="chv-item" data-cat="${c.id}" aria-current="${c.id === S.catSel}">
            <span class="dot ${st.cls}" title="${st.txt}"></span>
            <span class="n">${c.codigo}. ${esc(nomeCategoria(c))}<small>${MOD[c.modalidade]} ${SEXO[c.sexo]}${c.pcd ? " PCD" : ""} — ${atletasDaCat(c.id).length} atleta(s)</small></span>
          </button>`;
    }).join("")}</div>
        <div class="card stack" id="chvDet"></div>
      </div>`;

    detalheChave();
  }

  function detalheChave() {
    const c = catById(S.catSel), box = $("#chvDet");

    if (!c || !box) {
      return;
    }

    const l = atletasDaCat(c.id), ch = S.chaves[c.id], st = estadoChave(c);
    const mudou = st.cls === "mudou" ? [st.d.novos ? `${st.d.novos} atleta(s) entrou(aram)` : "", st.d.saiu ? `${st.d.saiu} atleta(s) saiu(saíram)` : ""].filter(Boolean).join(" e ") : "";

    if (travado()) {
      return detalheAoVivo(c, l, ch);
    }

    box.innerHTML = `<div class="row"><div><h3>${c.codigo}. ${esc(nomeCategoria(c))}</h3>
        <p class="mut small">${MOD[c.modalidade]} ${SEXO[c.sexo]}${c.pcd ? " PCD" : ""} — ${esc(faixaIdade(c))}${c.faixas ? " — " + esc(c.faixas) : ""} — ${l.length} atleta(s)</p></div>
        <span class="spacer"></span>
        <button class="btn ${ch ? "alt" : ""} sm" id="sortear" type="button" ${l.length ? "" : "disabled"}>${ch ? "Sortear de novo" : "Sortear chave"}</button>
        ${ch ? `<button class="btn sm" id="pdfUma" type="button">${ICONE.pdf} Baixar PDF</button>
        <button class="btn-ic danger" id="apagarUma" type="button" title="Apagar esta súmula">${ICONE.excluir} Apagar</button>` : ""}</div>
      ${mudou ? `<div class="aviso alerta">Depois do sorteio, ${mudou} nesta categoria. Sorteie de novo para atualizar a súmula.</div>` : ""}
      ${ch && ch.dados.conflitos ? `<div class="aviso alerta">Não deu para separar todos os atletas da mesma equipe na primeira luta (${ch.dados.conflitos} luta(s) entre colegas de equipe).</div>` : ""}
      ${ch ? `<div class="chv-svg">${Chave.svg(ch.dados)}</div><p class="mut small">Gerada em ${new Date(ch.dados.em || ch.updated_at).toLocaleString("pt-BR")}. Os números nos círculos são a ordem das lutas.</p>`
        : l.length ? `<p class="mut">Esta categoria tem ${l.length} atleta(s). Clique em <b>Sortear chave</b> para gerar a súmula.</p>`
          : `<p class="mut">Nenhum atleta inscrito nesta categoria.</p>`}`;
  }

  async function salvarChaves(lista) {
    const rows = lista.map(c => ({
      categoria_id: c.id,
      competicao_id: id,
      dados: Chave.sortear(atletasDaCat(c.id)),
      updated_at: new Date().toISOString()
    }));

    const { data, error } = await sb.from("chaves")
      .upsert(rows, { onConflict: "categoria_id" })
      .select("categoria_id,dados,updated_at");

    if (error) {
      toast(erroTexto(error), "erro");
      return false;
    }

    data.forEach(r => {
      S.chaves[r.categoria_id] = r;
    });

    return true;
  }

  async function sortearUma() {
    const c = catById(S.catSel);

    if (!c) {
      return;
    }

    if (S.chaves[c.id] && !await confirmar("Sortear esta categoria de novo? A súmula atual será substituída.", { titulo: "Sortear de novo", ok: "Sortear de novo" })) {
      return;
    }

    if (await salvarChaves([c])) {
      renderChaves();
      toast("Súmula gerada.");
    }
  }

  function sortearTodas() {
    const todas = catsComAtletas(), faltam = todas.filter(c => !S.chaves[c.id]);

    if (!todas.length) {
      return;
    }

    const executar = async (lista, dd) => {
      if (dd) {
        dd.close();
      }

      if (!lista.length) {
        return toast("Todas as categorias já têm súmula.");
      }

      if (await salvarChaves(lista)) {
        renderChaves();
        toast(`${lista.length} súmula(s) gerada(s).`);
      }
    };

    if (faltam.length === todas.length) {
      return executar(todas);
    }

    modal({
      titulo: "Sortear todas",
      corpo: `<p>${todas.length - faltam.length} de ${todas.length} categoria(s) com atletas já têm súmula. O que você quer fazer?</p>`,
      acoes: [{ texto: "Cancelar", classe: "alt" },
      ...(faltam.length ? [{
        texto: `Sortear só as que faltam (${faltam.length})`,
        classe: "alt",
        onClick: dd => executar(faltam, dd)
      }] : []), {
        texto: `Sortear todas de novo (${todas.length})`,
        onClick: dd => executar(todas, dd)
      }]
    });
  }

  async function apagarUma() {
    const c = catById(S.catSel);

    if (!c || !S.chaves[c.id]) {
      return;
    }

    if (!await confirmar(`Apagar a súmula de <b>${esc(c.nome)}</b>? Os atletas continuam inscritos; só o sorteio é apagado.`, { titulo: "Apagar súmula", ok: "Apagar", perigo: true })) {
      return;
    }

    const { error } = await sb.from("chaves").delete().eq("categoria_id", c.id);

    if (error) {
      return toast(erroTexto(error), "erro");
    }

    delete S.chaves[c.id];
    renderChaves();
    toast("Súmula apagada.");
  }

  async function apagarTodas() {
    const n = catsSorteadas().length;

    if (!n) {
      return;
    }

    if (!await confirmar(`Apagar as ${n} súmula(s) geradas? Os atletas continuam inscritos; só os sorteios são apagados.`, {
      titulo: "Apagar todas as súmulas",
      ok: "Apagar todas",
      perigo: true
    })) {
      return;
    }

    const { error } = await sb.from("chaves").delete().eq("competicao_id", id);

    if (error) {
      return toast(erroTexto(error), "erro");
    }

    S.chaves = {};
    renderChaves();
    toast("Súmulas apagadas.");
  }

  let gerando = false;

  async function comProgresso(btn, fn) {
    if (gerando) {
      return;
    }

    gerando = true;

    const t = btn.innerHTML;

    btn.disabled = true;

    try {
      await fn(txt => {
        btn.textContent = txt;
      });
    } catch (e) {
      console.error(e);
      toast("Não foi possível gerar o arquivo neste navegador. Tente pelo Google Chrome.", "erro");
    } finally {
      btn.innerHTML = t;
      btn.disabled = false;
      gerando = false;
    }
  }

  async function paginasDe(cats, aviso) {
    const out = [];

    for (let i = 0; i < cats.length; i++) {
      aviso(`Gerando ${i + 1} de ${cats.length}…`);
      await esperar(10);

      out.push({
        cat: cats[i],
        pagina: await paginaSumula(S.comp, cats[i], S.chaves[cats[i].id].dados)
      });
    }

    return out;
  }

  const nomeComp = () => nomeSeguro(S.comp.nome);

  function pdfUma(btn) {
    const c = catById(S.catSel);

    if (!c || !S.chaves[c.id]) {
      return;
    }

    comProgresso(btn, async (aviso) => {
      aviso("Gerando…");

      const pg = await paginaSumula(S.comp, c, S.chaves[c.id].dados);

      baixarBlob(criarPDF([pg]), nomeArquivoSumula(c) + ".pdf");
    });
  }

  function pdfTodas(btn) {
    const cs = catsSorteadas();

    if (!cs.length) {
      return;
    }

    comProgresso(btn, async (aviso) => {
      const pgs = await paginasDe(cs, aviso);

      baixarBlob(criarPDF(pgs.map(p => p.pagina)), `Súmulas - ${nomeComp()}.pdf`);
      toast(`${pgs.length} súmula(s) em um único PDF.`);
    });
  }

  function zipTodas(btn) {
    const cs = catsSorteadas();

    if (!cs.length) {
      return;
    }

    comProgresso(btn, async (aviso) => {
      const pgs = await paginasDe(cs, aviso);

      aviso("Montando o ZIP…");
      await esperar(10);

      const pasta = `Súmulas - ${nomeComp()}`, usados = new Set();

      const arquivos = pgs.map(({ cat, pagina }) => {
        let nome = nomeArquivoSumula(cat), k = 2;

        while (usados.has(nome.toLowerCase())) {
          nome = `${nomeArquivoSumula(cat)} (${k++})`;
        }

        usados.add(nome.toLowerCase());
        return { nome: `${pasta}/${nome}.pdf`, dados: criarPDFBytes([pagina]) };
      });

      baixarBlob(criarZIP(arquivos), `${pasta}.zip`);
      toast(`${arquivos.length} súmula(s) no ZIP.`);
    });
  }

  function sumulaBranco() {
    modal({
      titulo: "Súmula em branco",
      corpo: `<p class="mut">Para preencher à mão no dia da competição.</p>
      <label class="field">Quantidade de atletas<select id="tamBranco"><option value="2">2 atletas</option><option value="4">4 atletas</option><option value="8" selected>8 atletas</option><option value="16">16 atletas</option><option value="32">32 atletas</option></select></label>`,
      acoes: [{ texto: "Cancelar", classe: "alt" }, {
        texto: "Baixar PDF",
        onClick: async (dd) => {
          const n = +$("#tamBranco", dd).value;

          dd.close();

          try {
            const pg = await paginaSumula(S.comp, null, Chave.vazia(n));

            baixarBlob(criarPDF([pg]), `Súmula em branco - ${n} atletas.pdf`);
          } catch (e) {
            console.error(e);
            toast("Não foi possível gerar o PDF neste navegador. Tente pelo Google Chrome.", "erro");
          }
        }
      }]
    });
  }

  function renderEquipe() {
    const pend = S.convites.filter(c => c.status === "pendente"), rec = S.convites.filter(c => c.status === "recusado");
    const nAtl = uid => S.atletas.filter(a => a.created_by === uid).length;

    const cargoSel = m => `<select class="cargo-sel" data-cargo="${m.user_id}" aria-label="Cargo de ${esc(m.nome || m.email)}">
      <option value="professor" ${m.papel !== "mesario" ? "selected" : ""}>Professor</option>
      <option value="mesario" ${m.papel === "mesario" ? "selected" : ""}>Mesário</option></select>`;

    $("#sec-equipe").innerHTML = `<div class="grid2" style="align-items:start">
      <div class="card stack"><h2>Convidar para a equipe</h2>
        <p class="mut">Digite o e-mail da conta da pessoa e escolha o cargo. Ela precisa já ter uma conta neste site, com o e-mail confirmado. O convite aparece em Notificações, na conta dela.</p>
        <form id="fConv" class="stack" novalidate>
          <input type="email" name="email" placeholder="email@exemplo.com" aria-label="E-mail de quem será convidado" required>
          <div class="seg" role="radiogroup" aria-label="Cargo">
            <label><input type="radio" name="papel" value="professor" checked><span>Professor</span></label>
            <label><input type="radio" name="papel" value="mesario"><span>Mesário</span></label></div>
          <div><button class="btn" id="convBtn" type="submit">Enviar convite</button></div>
        </form>
        <div class="cargos">
          <p><b>Professor:</b> cadastra e vê só os próprios atletas. Depois do início, também pode abrir a mesa da competição.</p>
          <p><b>Mesário:</b> não vê atletas nem categorias. Só abre a mesa da competição, que é liberada quando você iniciar a competição.</p>
        </div></div>
      <div class="card"><h2 style="margin-bottom:6px">Equipe (${S.membros.length})</h2>
        ${S.membros.length ? S.membros.map(m => `<div class="membro"><span class="avatar">${esc(iniciais(m.nome || m.email))}</span>
            <div><b>${esc(m.nome || "Sem nome")}</b><div class="mut small">${esc(m.email || "")}${m.papel === "mesario" ? "" : ` — ${nAtl(m.user_id)} atleta(s)`}</div></div>
            <div class="row" style="gap:8px">${cargoSel(m)}<button class="linkbtn danger" type="button" data-rmem="${m.user_id}">Remover</button></div></div>`).join("")
        : `<p class="mut">Ninguém na equipe ainda. Os convites aceitos aparecem aqui.</p>`}
        ${pend.length ? `<h3 style="margin:18px 0 2px">Aguardando resposta</h3>${pend.map(c => `<div class="membro"><span class="avatar" aria-hidden="true">✉</span>
            <div><b>${esc(c.convidado_nome || c.email)}</b><div class="mut small">${esc(c.email)} — ${PAPEL[c.papel || "professor"]} — enviado ${esc(quando(c.created_at))}</div></div>
            <button class="linkbtn danger" type="button" data-cconv="${c.id}">Cancelar convite</button></div>`).join("")}` : ""}
        ${rec.length ? `<h3 style="margin:18px 0 2px">Recusaram</h3>${rec.map(c => `<div class="membro"><span class="avatar" aria-hidden="true">–</span>
            <div><b>${esc(c.convidado_nome || c.email)}</b><div class="mut small">${esc(c.email)}</div></div>
            <button class="linkbtn" type="button" data-cconv="${c.id}">Apagar</button></div>`).join("")}` : ""}
      </div></div>`;
  }

  async function convidar(f) {
    const email = f.email.value.trim().toLowerCase();
    const papel = f.papel.value;

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      f.email.focus();
      return toast("Digite um e-mail válido.", "erro");
    }

    await comBotao($("#convBtn"), async () => {
      const { data, error } = await sb.rpc("convidar_membro", { p_competicao: id, p_email: email, p_papel: papel });

      if (error) {
        return toast(erroTexto(error), "erro");
      }

      toast(`Convite de ${PAPEL[papel].toLowerCase()} enviado para ${data}.`);
      await carregarEquipe();
      renderEquipe();
    });
  }

  async function mudarCargo(uid, papel, sel) {
    const { error } = await sb.from("competicao_membros")
      .update({ papel })
      .eq("competicao_id", id)
      .eq("user_id", uid);

    if (error) {
      toast(erroTexto(error), "erro");
      await carregarEquipe();
      return renderEquipe();
    }

    const m = S.membros.find(x => x.user_id === uid);

    if (m) {
      m.papel = papel;
    }

    sel.blur();
    toast(`Cargo alterado para ${PAPEL[papel].toLowerCase()}.`);
    renderEquipe();
  }

  async function removerMembro(uid) {
    const m = S.membros.find(x => x.user_id === uid);

    if (!m) {
      return;
    }

    if (!await confirmar(`Remover <b>${esc(m.nome || m.email)}</b>? Ele deixa de ver esta competição. Os atletas que ele cadastrou continuam inscritos.`, { titulo: "Remover da equipe", ok: "Remover", perigo: true })) {
      return;
    }

    const { error } = await sb.from("competicao_membros")
      .delete()
      .eq("competicao_id", id)
      .eq("user_id", uid);

    if (error) {
      return toast(erroTexto(error), "erro");
    }

    S.membros = S.membros.filter(x => x.user_id !== uid);
    renderEquipe();
    toast("Removido da equipe.");
  }

  async function apagarConvite(cid) {
    const { error } = await sb.from("convites").delete().eq("id", cid);

    if (error) {
      return toast(erroTexto(error), "erro");
    }

    S.convites = S.convites.filter(x => x.id !== cid);
    renderEquipe();
  }

  let lerDados = null;

  function renderDados() {
    const sec = $("#sec-dados");

    sec.innerHTML = `<div class="grid2" style="align-items:start">
      <div class="card stack"><h2>Dados da competição</h2>${formCompeticaoHTML(S.comp, false)}
        <div><button class="btn" id="salvarDados" type="button">Salvar alterações</button></div></div>
      <div class="stack" style="gap:20px">${cardFase()}<div class="card stack"><h2>Excluir competição</h2>
        <p class="mut">Apaga a competição com as categorias, os atletas, as chaves e os convites. Não dá para desfazer.</p>
        <div><button class="btn danger" id="excluirComp" type="button">Excluir competição</button></div></div></div></div>`;

    lerDados = bindFormCompeticao(sec, S.comp, false);
  }

  async function salvarDados(btn) {
    let lido;

    try {
      lido = lerDados();
    } catch (e) {
      return toast(e.message, "erro");
    }

    await comBotao(btn, async () => {
      const r = await sb.from("competicoes").update(lido.dados).eq("id", id).select().single();

      if (r.error) {
        return toast(erroTexto(r.error), "erro");
      }

      S.comp = r.data;
      hero();
      document.title = S.comp.nome + " — Shiai Manager";
      toast("Alterações salvas.");
    });
  }

  async function excluirCompeticao() {
    if (!await confirmar(`Excluir <b>${esc(S.comp.nome)}</b> e tudo o que há nela? Não dá para desfazer.`, {
      titulo: "Excluir competição",
      ok: "Excluir para sempre",
      perigo: true
    })) {
      return;
    }

    const { error } = await sb.from("competicoes").delete().eq("id", id);

    if (error) {
      return toast(erroTexto(error), "erro");
    }

    location.replace("painel.html");
  }

  async function sairDaCompeticao() {
    if (!await confirmar("Sair desta competição? Você deixa de ver os seus atletas aqui, mas eles continuam inscritos.", { titulo: "Sair da competição", ok: "Sair", perigo: true })) {
      return;
    }

    const { error } = await sb.from("competicao_membros")
      .delete()
      .eq("competicao_id", id)
      .eq("user_id", user.id);

    if (error) {
      return toast(erroTexto(error), "erro");
    }

    location.replace("painel.html");
  }

  function cardFase() {
    const f = fase();

    const textos = {
      inscricoes: "As inscrições estão abertas. Quando você iniciar a competição, inscrições, categorias e súmulas ficam trancadas e a mesa da competição é liberada para professores e mesários.",
      andamento: "A competição está em andamento. A mesa registra os resultados de cada luta. Ao finalizar, os resultados ficam disponíveis para consulta.",
      finalizada: "A competição foi finalizada. Você pode reabrir para corrigir algum resultado."
    };

    const botoes = {
      inscricoes: `<button class="btn" id="iniciarComp" type="button">${ICONE.play} Iniciar competição</button>`,
      andamento: `<button class="btn alt" id="finalizarComp" type="button">Finalizar competição</button>
        <button class="btn ghost" id="voltarInscricoes" type="button">Voltar para inscrições</button>`,
      finalizada: `<button class="btn alt" id="reabrirComp" type="button">Reabrir competição</button>`
    };

    return `<div class="card stack"><h2>Fase da competição</h2>
      <div>${chipFase(f)}</div>
      <p class="mut">${textos[f]}</p>
      <div class="row">${botoes[f]}</div>
      ${f === "andamento" ? `<p class="mut small">“Voltar para inscrições” só funciona enquanto nenhuma luta tiver sido registrada.</p>` : ""}</div>`;
  }

  async function mudarFase(status) {
    const { error } = await sb.rpc("mudar_fase_competicao", { p_competicao: id, p_status: status });

    if (error) {
      toast(erroTexto(error), "erro");
      return false;
    }

    S.comp.status = status;

    try {
      await carregarResultados();
    } catch (e) {
      toast(erroTexto(e), "erro");
    }

    hero();
    mostrarAba();
    return true;
  }

  function iniciarCompeticao() {
    const faltam = catsComAtletas().filter(c => !S.chaves[c.id]);
    const mudaram = catsSorteadas().filter(c => estadoChave(c).cls === "mudou");
    const avisos = [];

    if (faltam.length) {
      avisos.push(`<li><b>${faltam.length} categoria(s)</b> com atletas ainda não foram sorteadas e ficariam fora da mesa.</li>`);
    }

    if (mudaram.length) {
      avisos.push(`<li><b>${mudaram.length} categoria(s)</b> tiveram atletas alterados depois do sorteio.</li>`);
    }

    const iniciar = async (dd, sortearAntes) => {
      await comBotao(dd.querySelector(".modal-foot .btn:last-child"), async () => {
        if (sortearAntes && !await salvarChaves(faltam)) {
          return;
        }

        if (await mudarFase("andamento")) {
          dd.close();
          toast("Competição iniciada. A mesa da competição está liberada.");
        }
      });
    };

    modal({
      titulo: "Iniciar competição",
      corpo: `<div class="aviso alerta">${ICONE.cadeado} <b>Atenção:</b> ao iniciar, <b>as inscrições, as categorias e as súmulas ficam trancadas</b> até a competição ser finalizada. Ninguém consegue cadastrar, editar ou sortear de novo.</div>
        <p>A mesa da competição passa a ficar disponível para você, para os professores e para os mesários, e os resultados de cada luta são registrados nela.</p>
        ${avisos.length ? `<ul class="lista-avisos">${avisos.join("")}</ul>` : `<p class="mut">Todas as categorias com atletas já têm súmula.</p>`}`,
      acoes: [
        { texto: "Cancelar", classe: "alt" },
        ...(faltam.length ? [{ texto: "Iniciar sem sortear", classe: "alt", onClick: dd => iniciar(dd, false) }, { texto: `Sortear as ${faltam.length} e iniciar`, onClick: dd => iniciar(dd, true) }] : [{ texto: "Iniciar competição", onClick: dd => iniciar(dd, false) }])
      ]
    });
  }

  async function finalizarCompeticao() {
    const abertas = catsSorteadas().filter(c => !(S.mesas[c.id] && S.mesas[c.id].status === "concluida") && (S.chaves[c.id].dados.slots || []).filter(Boolean).length > 1);

    const txt = abertas.length
      ? `Ainda há <b>${abertas.length} categoria(s)</b> sem conclusão na mesa. Finalizar mesmo assim? Os resultados registrados até agora ficam salvos.`
      : "Todas as categorias foram concluídas. Finalizar a competição?";

    if (!await confirmar(txt, { titulo: "Finalizar competição", ok: "Finalizar" })) {
      return;
    }

    if (await mudarFase("finalizada")) {
      toast("Competição finalizada.");
    }
  }

  async function reabrirCompeticao() {
    if (!await confirmar("Reabrir a competição? Ela volta para “em andamento” e a mesa fica liberada de novo para corrigir resultados.", { titulo: "Reabrir competição", ok: "Reabrir" })) {
      return;
    }

    if (await mudarFase("andamento")) {
      toast("Competição reaberta.");
    }
  }

  async function voltarInscricoes() {
    if (!await confirmar("Voltar a competição para a fase de inscrições? As inscrições, categorias e súmulas são destrancadas e a mesa deixa de ficar disponível.", { titulo: "Voltar para inscrições", ok: "Voltar para inscrições" })) {
      return;
    }

    if (await mudarFase("inscricoes")) {
      toast("A competição voltou para a fase de inscrições.");
    }
  }

  function detalheAoVivo(c, l, ch) {
    const box = $("#chvDet");
    const m = S.mesas[c.id];
    const lutas = S.lutas[c.id] || {};
    const cab = `<div class="row"><div><h3>${c.codigo}. ${esc(nomeCategoria(c))}</h3>
      <p class="mut small">${MOD[c.modalidade]} ${SEXO[c.sexo]}${c.pcd ? " PCD" : ""} — ${esc(faixaIdade(c))}${c.faixas ? " — " + esc(c.faixas) : ""} — ${l.length} atleta(s)</p></div></div>`;

    if (!ch) {
      box.innerHTML = cab + `<p class="mut">Esta categoria não foi sorteada antes do início da competição, então não aparece na mesa.</p>`;
      return;
    }

    const res = Chave.resolver(ch.dados, resultadosDe(c.id));
    let situacao;

    if (m && m.status === "concluida") {
      situacao = `<div class="aviso ok-aviso"><b>Categoria concluída.</b> ${m.koto ? esc(m.koto) + " — " : ""}${esc(quando(m.concluida_em || m.atualizado_em))}</div>`;
    } else if (m && m.reservado_por) {
      situacao = `<div class="aviso vivo-aviso"><span class="dot vivo"></span> <b>Em andamento${m.koto ? " no " + esc(m.koto) : ""}</b> — mesa aberta por ${esc(m.reservado_nome || "um mesário")}.</div>`;
    } else {
      situacao = `<div class="aviso">Aguardando um koto abrir esta categoria na mesa.</div>`;
    }

    const linhas = res.ordem.map(p => {
      const reg = lutas[p.key];
      const nome = a => a ? esc(a.nome) : `<span class="mut">a definir</span>`;
      const venc = p.vencedor ? `<b class="v-${p.vencedor}">${esc((p.vencedor === "aka" ? p.aka : p.ao).nome)}</b>` : `<span class="mut">—</span>`;
      const doc = "";

      return `<tr><td data-l="Luta"><span class="cod">${p.numero}</span></td><td data-l="Fase">${esc(p.fase)}</td>
        <td data-l="AKA"><span class="lado aka">AKA</span> ${nome(p.aka)}</td><td data-l="AO"><span class="lado ao">AO</span> ${nome(p.ao)}</td>
        <td data-l="Vencedor">${venc}</td><td class="acoes">${doc}</td></tr>`;
    }).join("");

    const classif = res.classificacao.length && res.concluida
      ? `<div class="classif">${res.classificacao.map((a, i) => `<div class="pos p${i + 1}"><span>${i + 1}º</span><b>${esc(a.nome)}</b><small>${esc(a.equipe || "")}</small></div>`).join("")}</div>`
      : "";

    const qtdLutas = Object.keys(lutas).length;
    const arquivosLuta = c.modalidade === "kumite" ? res.ordem.filter(p => lutas[p.key]) : [];
    const acoesDono = [];

    if (S.dono && fase() === "andamento" && m && m.reservado_por) {
      acoesDono.push(`<button class="btn alt sm" id="liberarMesa" type="button">Liberar a mesa desta categoria</button>`);
    }

    if (S.dono && fase() === "andamento" && m && m.status === "concluida") {
      acoesDono.push(`<button class="btn alt sm" id="reabrirCat" type="button">Reabrir categoria</button>`);
    }

    box.innerHTML = `${cab}${situacao}
      ${classif}
      <div class="chv-svg">${Chave.svg(ch.dados, { resultados: resultadosDe(c.id) })}</div>
      ${res.ordem.length ? `<div class="tab-wrap"><table class="tab cards lutas-tab"><thead><tr><th>Luta</th><th>Fase</th><th>AKA</th><th>AO</th><th>Vencedor</th><th></th></tr></thead><tbody>${linhas}</tbody></table></div>` : `<p class="mut">Categoria com atleta único: não há lutas.</p>`}
      ${acoesDono.length ? `<div class="row">${acoesDono.join("")}</div>` : ""}
      <div class="pasta">
        <div class="pasta-head">${ICONE.pasta}<h3>Pasta de arquivos da categoria</h3><span class="spacer"></span>
          <button class="btn alt sm" type="button" data-arq="zip">${ICONE.zip} Baixar a pasta (ZIP)</button></div>
        <ul class="arquivos">
          <li><span>${ICONE.pdf} Súmula de ${MOD[c.modalidade]} — molde, sem resultados</span><button class="btn-ic" type="button" data-arq="molde">Baixar</button></li>
          <li><span>${ICONE.pdf} Súmula de ${MOD[c.modalidade]} — com vencedores${res.concluida ? "" : qtdLutas ? " (parcial)" : ""}</span>
            <button class="btn-ic" type="button" data-arq="venc" ${qtdLutas || res.S === 1 ? "" : "disabled"}>Baixar</button></li>
          ${c.modalidade === "kumite" ? `<li><span>${ICONE.pdf} Súmula de kumitê — ${arquivosLuta.length ? `${arquivosLuta.length} luta(s) registrada(s)` : "aguardando as lutas"}</span><button class="btn-ic" type="button" data-arq="kumite" ${arquivosLuta.length ? "" : "disabled"}>Baixar</button></li>` : ""}
        </ul>
        ${c.modalidade === "kumite" && !arquivosLuta.length ? `<p class="mut small">A súmula de kumitê é preenchida sozinha pela mesa, luta por luta, e aparece aqui assim que a primeira luta for registrada.</p>` : ""}
      </div>`;
  }

  const lutasKumite = c => {
    const ch = S.chaves[c.id];
    const res = Chave.resolver(ch.dados, resultadosDe(c.id));

    return res.ordem.map(p => (S.lutas[c.id] || {})[p.key]).filter(Boolean);
  };

  async function arquivosDaCategoria(c, aviso) {
    const ch = S.chaves[c.id];
    const resultados = resultadosDe(c.id);
    const res = Chave.resolver(ch.dados, resultados);
    const base = nomeArquivoSumula(c);
    const arqs = [];

    aviso("Gerando o molde…");
    await esperar(10);
    arqs.push({ nome: `Molde - ${base}.pdf`, paginas: [await paginaSumula(S.comp, c, ch.dados, { semAssinaturas: true, titulo: `Súmula de ${MOD[c.modalidade]} — molde` })] });

    if (Object.keys(resultados).length || res.S === 1) {
      aviso("Gerando a súmula com vencedores…");
      await esperar(10);
      arqs.push({ nome: `Vencedores - ${base}.pdf`, paginas: [await paginaSumula(S.comp, c, ch.dados, { resultados, semAssinaturas: true, titulo: "Súmula com vencedores", nota: res.concluida ? "" : "Resultado parcial: a categoria ainda não foi concluída." })] });
    }

    if (c.modalidade === "kumite" && lutasKumite(c).length) {
      aviso("Gerando a súmula de kumitê…");
      await esperar(10);
      arqs.push({ nome: `${nomeArquivoKumite(c)}.pdf`, paginas: await paginasKumite(S.comp, c, lutasKumite(c)) });
    }

    return arqs;
  }

  function baixarArquivo(btn, qual) {
    const c = catById(S.catSel);

    if (!c || !S.chaves[c.id]) {
      return;
    }

    const ch = S.chaves[c.id];
    const base = nomeArquivoSumula(c);

    comProgresso(btn, async (aviso) => {
      aviso("Gerando…");

      if (qual === "molde") {
        return baixarBlob(criarPDF([await paginaSumula(S.comp, c, ch.dados, { semAssinaturas: true, titulo: `Súmula de ${MOD[c.modalidade]} — molde` })]), `Molde - ${base}.pdf`);
      }

      if (qual === "venc") {
        const resultados = resultadosDe(c.id);
        const res = Chave.resolver(ch.dados, resultados);

        return baixarBlob(criarPDF([await paginaSumula(S.comp, c, ch.dados, { resultados, semAssinaturas: true, titulo: "Súmula com vencedores", nota: res.concluida ? "" : "Resultado parcial: a categoria ainda não foi concluída." })]), `Vencedores - ${base}.pdf`);
      }

      if (qual === "kumite") {
        return baixarBlob(criarPDF(await paginasKumite(S.comp, c, lutasKumite(c))), `${nomeArquivoKumite(c)}.pdf`);
      }

      if (qual === "zip") {
        const arqs = await arquivosDaCategoria(c, aviso);
        const pasta = nomeSeguro(`Cód ${c.codigo} - ${nomeCategoria(c)} - ${MOD[c.modalidade]} ${SEXO[c.sexo]}`);

        aviso("Montando o ZIP…");
        await esperar(10);
        baixarBlob(criarZIP(arqs.map(a => ({ nome: `${pasta}/${a.nome}`, dados: criarPDFBytes(a.paginas) }))), `${pasta}.zip`);
      }
    });
  }

  async function kumiteBranco(btn) {
    comProgresso(btn, async (aviso) => {
      aviso("Gerando…");

      const c = catById(S.catSel);
      const cat = c && c.modalidade === "kumite" ? c : null;

      baixarBlob(criarPDF(await paginasKumite(S.comp, cat, [])), `Súmula de kumitê em branco${cat ? " - Cód " + cat.codigo : ""}.pdf`);
    });
  }

  async function liberarMesa() {
    const c = catById(S.catSel);

    if (!c || !await confirmar("Liberar a mesa desta categoria? O koto que estava com ela perde o acesso, e outro koto pode abri-la. Os resultados já registrados ficam salvos.", { titulo: "Liberar mesa", ok: "Liberar" })) {
      return;
    }

    const { error } = await sb.rpc("liberar_categoria", { p_categoria: c.id });

    if (error) {
      return toast(erroTexto(error), "erro");
    }

    await atualizarAoVivo();
    toast("Mesa liberada.");
  }

  async function reabrirCategoria() {
    const c = catById(S.catSel);

    if (!c || !await confirmar("Reabrir esta categoria para corrigir resultados? Ela volta a ficar disponível na mesa.", { titulo: "Reabrir categoria", ok: "Reabrir" })) {
      return;
    }

    const { error } = await sb.rpc("reabrir_categoria", { p_categoria: c.id });

    if (error) {
      return toast(erroTexto(error), "erro");
    }

    await atualizarAoVivo();
    toast("Categoria reaberta.");
  }

  async function atualizarAoVivo() {
    try {
      await carregarResultados();
    } catch (e) {
      return;
    }

    if (abaAtual() === "chaves" && !$("#sec-chaves").hidden && !document.querySelector("dialog[open]")) {
      const rolagem = window.scrollY;

      renderChaves();
      window.scrollTo(0, rolagem);
    }
  }

  setInterval(() => {
    if (S.dono && fase() === "andamento" && document.visibilityState === "visible" && !gerando) {
      atualizarAoVivo();
    }
  }, 15000);

  function renderMesario() {
    const f = fase();
    const sec = $("#sec-mesario");

    sec.innerHTML = `<div class="card mesario-card stack">
      <span class="mesario-ic">${ICONE.mesa}</span>
      <h2>Mesa da competição</h2>
      ${f === "andamento"
        ? `<p>A competição está em andamento. Abra a mesa, escolha a categoria que chegou ao seu koto e registre as lutas na ordem da súmula.</p>
           <div><a class="btn big" href="${urlMesa()}">${ICONE.mesa} Abrir mesa da competição</a></div>`
        : f === "finalizada"
          ? `<p>A competição foi finalizada. Obrigado pelo trabalho na mesa!</p>`
          : `<p>Você é mesário desta competição. A mesa é liberada quando o organizador iniciar a competição; volte aqui no dia do evento.</p>
             <div><button class="btn big" type="button" disabled>${ICONE.cadeado} Mesa ainda bloqueada</button></div>`}
      <p class="mut small">A mesa funciona no navegador, com o mesmo placar do aplicativo para Windows, e já puxa as súmulas e salva os resultados no Shiai Manager.</p>
    </div>`;
  }

  app.addEventListener("click", e => {
    const t = e.target.closest("button");

    if (!t) {
      return;
    }

    const d = t.dataset;

    if (d.edit) {
      return editar(S.atletas.find(a => a.id === d.edit));
    }

    if (d.del) {
      return removerAtleta(d.del);
    }

    if (d.ecat) {
      e.preventDefault();
      return modalCategorias(catById(d.ecat));
    }

    if (d.dcat) {
      e.preventDefault();
      return excluirCategoria(d.dcat);
    }

    if (d.cat) {
      S.catSel = d.cat;
      $$("#chvLista .chv-item").forEach(b => b.setAttribute("aria-current", String(b.dataset.cat === d.cat)));
      detalheChave();

      if (matchMedia("(max-width:980px)").matches) {
        $("#chvDet").scrollIntoView({ behavior: "smooth", block: "start" });
      }

      return;
    }

    if (d.rmem) {
      return removerMembro(d.rmem);
    }

    if (d.cconv) {
      return apagarConvite(d.cconv);
    }

    if (d.arq) {
      return baixarArquivo(t, d.arq);
    }

    switch (t.id) {
      case "btnLista": return imprimir(folhaListaAtletas(S.comp, S.cats, S.atletas), { titulo: `Atletas - ${nomeSeguro(S.comp.nome)}`, paisagem: false });
      case "novaCat": return modalCategorias();
      case "abrirCats": {
        const ds = $$("#sec-categorias details.cat-item"), abrir = ds.some(x => !x.open);

        ds.forEach(x => {
          x.open = abrir;
        });

        t.textContent = abrir ? "Recolher todas" : "Mostrar atletas de todas";
        return;
      }
      case "sortear": return sortearUma();
      case "sortTodas": return sortearTodas();
      case "pdfUma": return pdfUma(t);
      case "pdfTodas": return pdfTodas(t);
      case "zipTodas": return zipTodas(t);
      case "apagarUma": return apagarUma();
      case "apagarTodas": return apagarTodas();
      case "sumBranco": return sumulaBranco();
      case "salvarDados": return salvarDados(t);
      case "excluirComp": return excluirCompeticao();
      case "sairComp": return sairDaCompeticao();
      case "iniciarComp": return iniciarCompeticao();
      case "finalizarComp": return finalizarCompeticao();
      case "reabrirComp": return reabrirCompeticao();
      case "voltarInscricoes": return voltarInscricoes();
      case "kumiteBranco": return kumiteBranco(t);
      case "liberarMesa": return liberarMesa();
      case "reabrirCat": return reabrirCategoria();
    }
  });

  app.addEventListener("input", e => {
    if (e.target.id === "busca") {
      S.busca = e.target.value;
      listaAtletas();
    }
  });

  app.addEventListener("change", e => {
    if (e.target.dataset.cargo) {
      mudarCargo(e.target.dataset.cargo, e.target.value, e.target);
    }
  });

  app.addEventListener("submit", e => {
    if (e.target.id === "fConv") {
      e.preventDefault();
      convidar(e.target);
    }
  });

  hero();
  mostrarAba();
})();
