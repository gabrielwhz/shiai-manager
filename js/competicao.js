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
    busca: ""
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

  const ABAS = S.dono
    ? [["atletas", "Atletas"], ["categorias", "Categorias"], ["chaves", "Súmulas"], ["equipe", "Professores"], ["dados", "Dados da competição"]]
    : [["atletas", "Meus atletas"]];

  app.innerHTML = `<section class="comp-hero" id="hero"></section>
    <nav class="tabs" id="abas" aria-label="Seções da competição">${ABAS.map(([k, t]) => `<a href="#${k}" data-aba="${k}">${t}</a>`).join("")}</nav>
    ${ABAS.map(([k]) => `<section id="sec-${k}" hidden></section>`).join("")}`;

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
    await Promise.all([carregarCats(), carregarAtletas(), S.dono && carregarChaves(), S.dono && carregarEquipe()]);
  } catch (e) {
    app.insertAdjacentHTML("afterbegin", `<div class="aviso erro" style="margin-bottom:16px">${esc(erroTexto(e))}</div>`);
  }

  function hero() {
    const c = S.comp;

    $("#hero").innerHTML = `${logoHTML(c)}
      <div><h1>${esc(c.nome)}</h1>
        <div class="info"><span>${esc(fmtDatas(c.datas))}</span>${c.local ? `<span>${esc(c.local)}</span>` : ""}${c.federacao ? `<span>${esc(c.federacao)}</span>` : ""}</div>
        <span class="papel ${S.dono ? "dono" : ""}">${S.dono ? "Você é o organizador" : "Você é professor convidado"}</span></div>
      <div class="acoes-hero">${S.dono ? "" : `<button class="btn ghost sm" id="sairComp" type="button">Sair da competição</button>`}</div>`;
  }

  function abaAtual() {
    const h = location.hash.slice(1);

    return ABAS.some(a => a[0] === h) ? h : "atletas";
  }

  function mostrarAba() {
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

    $("#sec-atletas").innerHTML = `<div class="atl-layout">
      <form class="card atl-form stack" id="fAtl" novalidate>
        <h2 id="fAtlTit">Cadastrar atleta</h2>
        ${semCats ? `<div class="aviso alerta">${S.dono
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
        <div class="row"><button class="btn" type="submit" id="fAtlBtn" ${semCats ? "disabled" : ""}>Cadastrar atleta</button>
          <button class="btn ghost" type="button" id="fAtlCancel" hidden>Cancelar edição</button></div>
      </form>
      <div class="stack">
        <div class="row"><h2>${S.dono ? "Atletas inscritos" : "Atletas que você cadastrou"} <span class="mut" id="atlCount"></span></h2><span class="spacer"></span>
          ${S.dono ? `<button class="btn alt sm" id="btnLista" type="button">${ICONE.pdf} Tabela de atletas (PDF)</button>` : ""}</div>
        <input type="search" id="busca" placeholder="Buscar por nome, equipe ou categoria" aria-label="Buscar atletas" value="${esc(S.busca)}">
        <div id="atlLista"></div>
      </div></div>`;

    bindFormAtleta();
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
        ? "Nenhum atleta inscrito ainda. Cadastre pelo formulário ou convide professores na aba Professores."
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
        <td class="acoes"><button class="btn-ic so-ic" type="button" data-edit="${a.id}" title="Editar atleta" aria-label="Editar ${esc(a.nome)}">${ICONE.editar}</button> <button class="btn-ic so-ic danger" type="button" data-del="${a.id}" title="Remover atleta" aria-label="Remover ${esc(a.nome)}">${ICONE.excluir}</button></td></tr>`).join("")}
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
        <button class="btn" id="novaCat" type="button">+ Adicionar categorias</button></div>
      ${S.cats.length ? `<div class="cat-list">${S.cats.map(c => {
      const l = atletasDaCat(c.id);

      return `<details class="cat-item" data-id="${c.id}" ${abertas.has(c.id) ? "open" : ""}>
          <summary>
            <span class="cod-box" title="Código">${c.codigo ?? ""}</span>
            <span class="n"><b>${esc(c.nome)}</b><small><span class="chip ${c.modalidade}">${MOD[c.modalidade]}</span>${chipPcd(c.pcd)} ${SEXO[c.sexo]} — ${esc(faixaIdade(c))}${c.faixas ? " — " + esc(c.faixas) : ""}</small></span>
            <span class="qtd">${ICONE.seta} ${l.length} atleta(s)</span>
            <span class="acoes-cat">
              <button class="btn-ic" type="button" data-ecat="${c.id}" title="Editar categoria">${ICONE.editar} Editar</button>
              <button class="btn-ic danger" type="button" data-dcat="${c.id}" title="Excluir categoria">${ICONE.excluir} Excluir</button>
            </span>
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

  function estadoChave(c) {
    const ch = S.chaves[c.id];

    if (!ch) {
      return { cls: "", txt: "Súmula ainda não gerada" };
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

    sec.innerHTML = `<div class="page-head"><div><h2>Súmulas</h2>
        <p>${sorteadas} súmula(s) gerada(s). ${comAtl.length} categoria(s) com atletas.</p></div><span class="spacer"></span>
        <button class="btn" id="sortTodas" type="button" ${comAtl.length ? "" : "disabled"}>Sortear todas</button></div>
      <div class="card row" style="margin-bottom:18px">
        <span class="mut small" style="margin-right:4px">Todas as súmulas:</span>
        <button class="btn alt sm" id="pdfTodas" type="button" ${sorteadas ? "" : "disabled"}>${ICONE.pdf} Todas em um único PDF</button>
        <button class="btn alt sm" id="zipTodas" type="button" ${sorteadas ? "" : "disabled"}>${ICONE.zip} Todas em ZIP (uma por arquivo)</button>
        <button class="btn alt sm" id="sumBranco" type="button">${ICONE.pdf} Súmula em branco</button>
        <span class="spacer"></span>
        <button class="btn ghost sm perigo-txt" id="apagarTodas" type="button" ${sorteadas ? "" : "disabled"}>${ICONE.excluir} Apagar todas</button>
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

    $("#sec-equipe").innerHTML = `<div class="grid2" style="align-items:start">
      <div class="card stack"><h2>Convidar professor</h2>
        <p class="mut">Digite o e-mail da conta do professor. Ele precisa já ter uma conta neste site. O convite aparece em Notificações, na conta dele. Depois de aceitar, ele só cadastra e vê os próprios atletas.</p>
        <form id="fConv" class="row" novalidate><input type="email" name="email" placeholder="email@doprofessor.com" aria-label="E-mail do professor" style="flex:1;min-width:200px" required>
          <button class="btn" id="convBtn" type="submit">Enviar convite</button></form></div>
      <div class="card"><h2 style="margin-bottom:6px">Professores (${S.membros.length})</h2>
        ${S.membros.length ? S.membros.map(m => `<div class="membro"><span class="avatar">${esc(iniciais(m.nome || m.email))}</span>
            <div><b>${esc(m.nome || "Sem nome")}</b><div class="mut small">${esc(m.email || "")} — ${nAtl(m.user_id)} atleta(s)</div></div>
            <button class="linkbtn danger" type="button" data-rmem="${m.user_id}">Remover</button></div>`).join("")
        : `<p class="mut">Nenhum professor ainda. Os convites aceitos aparecem aqui.</p>`}
        ${pend.length ? `<h3 style="margin:18px 0 2px">Aguardando resposta</h3>${pend.map(c => `<div class="membro"><span class="avatar" aria-hidden="true">✉</span>
            <div><b>${esc(c.convidado_nome || c.email)}</b><div class="mut small">${esc(c.email)} — enviado ${esc(quando(c.created_at))}</div></div>
            <button class="linkbtn danger" type="button" data-cconv="${c.id}">Cancelar convite</button></div>`).join("")}` : ""}
        ${rec.length ? `<h3 style="margin:18px 0 2px">Recusaram</h3>${rec.map(c => `<div class="membro"><span class="avatar" aria-hidden="true">–</span>
            <div><b>${esc(c.convidado_nome || c.email)}</b><div class="mut small">${esc(c.email)}</div></div>
            <button class="linkbtn" type="button" data-cconv="${c.id}">Apagar</button></div>`).join("")}` : ""}
      </div></div>`;
  }

  async function convidar(f) {
    const email = f.email.value.trim().toLowerCase();

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      f.email.focus();
      return toast("Digite um e-mail válido.", "erro");
    }

    await comBotao($("#convBtn"), async () => {
      const { data, error } = await sb.rpc("convidar_professor", { p_competicao: id, p_email: email });

      if (error) {
        return toast(erroTexto(error), "erro");
      }

      toast(`Convite enviado para ${data}.`);
      await carregarEquipe();
      renderEquipe();
    });
  }

  async function removerMembro(uid) {
    const m = S.membros.find(x => x.user_id === uid);

    if (!m) {
      return;
    }

    if (!await confirmar(`Remover <b>${esc(m.nome || m.email)}</b>? Ele deixa de ver esta competição. Os atletas que ele cadastrou continuam inscritos.`, { titulo: "Remover professor", ok: "Remover", perigo: true })) {
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
    toast("Professor removido.");
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
      <div class="card stack"><h2>Excluir competição</h2>
        <p class="mut">Apaga a competição com as categorias, os atletas, as chaves e os convites. Não dá para desfazer.</p>
        <div><button class="btn danger" id="excluirComp" type="button">Excluir competição</button></div></div></div>`;

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
    }
  });

  app.addEventListener("input", e => {
    if (e.target.id === "busca") {
      S.busca = e.target.value;
      listaAtletas();
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
