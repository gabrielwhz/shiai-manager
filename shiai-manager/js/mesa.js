"use strict";

(async function() {
  if (location.hash === "#placar" || !window.Placar) {
    return;
  }

  const raiz = $("#mesaInt");
  const params = new URLSearchParams(location.search);
  const id = params.get("id");
  const ESTADO_KEY = `shiai-mesa-luta:${id}`;
  const FILA_KEY = `shiai-mesa-fila:${id}`;
  const KOTO_KEY = "shiai-mesa-koto";
  const outro = s => s === "aka" ? "ao" : "aka";

  const LADO = {
    aka: "AKA",
    ao: "AO"
  };

  const M = {
    user: null,
    perfil: null,
    comp: null,
    papel: null,
    cats: [],
    chaves: {},
    mesas: {},
    lutas: {},
    catId: null,
    escolhendo: true,
    verChave: false,
    busca: "",
    ativa: null,
    anterior: null,
    fila: []
  };

  function aviso(titulo, texto, extra = "") {
    raiz.innerHTML = `<div class="card mi mi-aviso"><b>${esc(titulo)}</b><p>${texto}</p>${extra}</div>`;
  }

  function lerLocal(chave, padrao) {
    try {
      const v = localStorage.getItem(chave);

      return v ? JSON.parse(v) : padrao;
    } catch (e) {
      return padrao;
    }
  }

  function gravarLocal(chave, valor) {
    try {
      if (valor == null) {
        localStorage.removeItem(chave);
      } else {
        localStorage.setItem(chave, JSON.stringify(valor));
      }
    } catch (e) {
      return;
    }
  }

  const erroDeRede = e => !navigator.onLine || /Failed to fetch|NetworkError|Load failed|network|fetch/i.test((e && (e.message || e.msg)) || String(e || ""));

  if (!sb) {
    return aviso("Mesa sem conexão com o Shiai Manager", "O arquivo de configuração não foi encontrado. O placar abaixo funciona normalmente, mas sem puxar as súmulas.");
  }

  if (!id) {
    return aviso("Competição não informada", "Abra a mesa pelo botão “Abrir mesa da competição”, na página da competição.");
  }

  const { data: { session } } = await sb.auth.getSession();

  if (!session) {
    location.replace("login.html");
    return;
  }

  M.user = session.user;

  const [{ data: comp }, { data: perfil }, { data: membro }] = await Promise.all([
    sb.from("competicoes").select("*").eq("id", id).maybeSingle(),
    sb.from("profiles").select("*").eq("id", M.user.id).maybeSingle(),
    sb.from("competicao_membros")
      .select("*")
      .eq("competicao_id", id)
      .eq("user_id", M.user.id)
      .maybeSingle()
  ]);

  if (!comp) {
    return aviso("Competição não encontrada", "Ela pode ter sido excluída, ou você não faz parte da equipe dela.", `<a class="mi-link" href="painel.html">Voltar para minhas competições</a>`);
  }

  M.comp = comp;
  M.perfil = perfil || { nome: "", email: M.user.email };
  M.papel = comp.owner_id === M.user.id ? "dono" : (membro && membro.papel) || "professor";
  document.title = `Mesa — ${comp.nome} — Shiai Manager`;

  const voltar = `<a class="mi-link" href="competicao.html?id=${id}">Voltar ao Shiai Manager</a>`;

  if ((comp.status || "inscricoes") !== "andamento") {
    const finalizada = comp.status === "finalizada";

    return aviso(finalizada ? "Competição finalizada" : "A mesa ainda não foi liberada", finalizada
      ? "Esta competição já foi finalizada. Os resultados estão na página da competição."
      : "A mesa da competição é liberada quando o organizador iniciar a competição. Enquanto isso, o placar abaixo funciona normalmente, sem puxar as súmulas.", voltar);
  }

  Placar.alterar(s => {
    s.event = comp.nome;
  });

  M.fila = lerLocal(FILA_KEY, []);
  M.ativa = lerLocal(ESTADO_KEY, null);

  if (M.ativa) {
    M.catId = M.ativa.catId;
    M.escolhendo = false;
  }

  const catById = cid => M.cats.find(c => c.id === cid);
  const kotoAtual = () => ($("#miKoto") ? $("#miKoto").value.trim() : lerLocal(KOTO_KEY, "")) || "";
  const resultadosDe = cid => Object.fromEntries(Object.entries(M.lutas[cid] || {}).map(([k, l]) => [k, { vencedor: l.vencedor, vencedor_id: l.vencedor_id }]));

  async function carregarTudo() {
    const [c, ch, me, lu] = await Promise.all([
      sb.from("categorias")
        .select("*")
        .eq("competicao_id", id)
        .order("codigo", { ascending: true }),
      sb.from("chaves").select("categoria_id,dados").eq("competicao_id", id),
      sb.from("mesas").select("*").eq("competicao_id", id),
      sb.from("lutas").select("*").eq("competicao_id", id)
    ]);

    const erro = [c, ch, me, lu].find(r => r.error);

    if (erro) {
      throw erro.error;
    }

    M.cats = c.data;
    M.chaves = Object.fromEntries(ch.data.map(x => [x.categoria_id, x]));
    M.mesas = Object.fromEntries(me.data.map(x => [x.categoria_id, x]));
    M.lutas = {};

    for (const l of lu.data) {
      (M.lutas[l.categoria_id] = M.lutas[l.categoria_id] || {})[l.chave] = l;
    }

    for (const f of M.fila) {
      if (f.tipo === "registrar") {
        (M.lutas[f.p.p_categoria] = M.lutas[f.p.p_categoria] || {})[f.p.p_chave] = {
          chave: f.p.p_chave,
          vencedor: f.p.p_vencedor,
          vencedor_id: f.p.p_vencedor_id,
          pendente: true
        };
      }
    }
  }

  try {
    await carregarTudo();
  } catch (e) {
    return aviso("Não foi possível carregar a competição", esc(erroTexto(e)), voltar);
  }

  function estruturaDe(cid) {
    const ch = M.chaves[cid];

    return ch ? Chave.resolver(ch.dados, resultadosDe(cid)) : null;
  }

  function situacao(c) {
    const m = M.mesas[c.id];

    if (m && m.status === "concluida") {
      return { cls: "ok", txt: "Concluída" };
    }

    if (m && m.reservado_por && m.reservado_por !== M.user.id) {
      return { cls: "uso", txt: `Em uso${m.koto ? " — " + m.koto : ""}${m.reservado_nome ? " (" + m.reservado_nome + ")" : ""}` };
    }

    if (m && m.reservado_por === M.user.id) {
      return { cls: "minha", txt: "Aberta nesta mesa" };
    }

    if (Object.keys(M.lutas[c.id] || {}).length) {
      return { cls: "parcial", txt: "Iniciada, sem mesa aberta" };
    }

    return { cls: "livre", txt: "Livre" };
  }

  function desenhar() {
    const c = M.catId ? catById(M.catId) : null;

    raiz.innerHTML = `<div class="card mi">
      <div class="mi-top">
        <div class="mi-comp"><small>Mesa da competição</small><b>${esc(M.comp.nome)}</b></div>
        <label class="field mi-koto">Koto<input id="miKoto" type="text" maxlength="30" placeholder="Ex.: Koto 1" value="${esc(lerLocal(KOTO_KEY, ""))}"></label>
        <div class="actions">
          ${c && !M.escolhendo ? `<button type="button" id="miTrocar">Trocar de categoria</button>` : ""}
          ${voltar}
        </div>
      </div>
      <div id="miFila" class="mi-fila" ${M.fila.length ? "" : "hidden"}></div>
      <div id="miCorpo"></div>
    </div>`;

    desenharFila();

    if (M.escolhendo || !c) {
      desenharEscolha();
    } else {
      desenharCategoria(c);
    }
  }

  function desenharFila() {
    const el = $("#miFila");

    if (!el) {
      return;
    }

    el.hidden = !M.fila.length;
    el.innerHTML = M.fila.length ? `⚠ ${M.fila.length} resultado(s) salvos neste computador, aguardando a internet para enviar. Não feche esta página.` : "";
  }

  function desenharEscolha() {
    const q = norm(M.busca);
    const lista = M.cats.filter(c => M.chaves[c.id])
      .filter(c => !q || norm(`${c.codigo} ${c.nome} ${MOD[c.modalidade]} ${SEXO[c.sexo]}`).includes(q) || String(c.codigo) === M.busca.trim());

    $("#miCorpo").innerHTML = `<div class="mi-escolha">
      <div class="mi-escolha-top"><h2>Qual categoria chegou neste koto?</h2>
        <input id="miBusca" type="search" placeholder="Digite o código ou o nome da categoria" value="${esc(M.busca)}" aria-label="Buscar categoria"></div>
      ${lista.length ? `<div class="mi-cats">${lista.map(c => {
      const st = situacao(c);
      const n = (M.chaves[c.id].dados.slots || []).filter(Boolean).length;

      return `<button type="button" class="mi-cat st-${st.cls}" data-abrir="${c.id}">
          <span class="mi-cod">${c.codigo ?? ""}</span>
          <span class="mi-cat-n"><b>${esc(nomeCategoria(c))}</b><small>${MOD[c.modalidade]} ${SEXO[c.sexo]} — ${n} atleta(s)</small></span>
          <span class="mi-st">${esc(st.txt)}</span>
        </button>`;
    }).join("")}</div>` : `<p class="mi-vazio">${M.cats.length ? "Nenhuma categoria encontrada." : "Esta competição não tem categorias sorteadas."}</p>`}
    </div>`;

    const b = $("#miBusca");

    if (b && M.busca) {
      b.focus();
      b.setSelectionRange(b.value.length, b.value.length);
    }
  }

  function desenharCategoria(c) {
    const res = estruturaDe(c.id);
    const m = M.mesas[c.id];
    const concluida = m && m.status === "concluida";
    const minha = m && m.reservado_por === M.user.id;
    const lutas = M.lutas[c.id] || {};
    const ativa = M.ativa && M.ativa.catId === c.id ? M.ativa.key : null;
    const proxima = res.ordem.find(p => p.pronta && p.key !== ativa);
    const nome = a => a ? esc(a.nome) : "a definir";

    const linhas = res.ordem.map(p => {
      const reg = lutas[p.key];
      let estado, acao = "";

      if (p.vencedor) {
        const v = p.vencedor === "aka" ? p.aka : p.ao;

        estado = `<span class="mi-venc v-${p.vencedor}">Vencedor: ${esc(v.nome)}</span>${reg && reg.pendente ? ` <span class="mi-pend">aguardando envio</span>` : ""}`;
        acao = !concluida && minha ? `<button type="button" class="mi-sec" data-desfazer="${p.key}">Desfazer</button>` : "";
      } else if (p.key === ativa) {
        estado = `<span class="mi-agora">● Na mesa agora</span>`;
        acao = `<button type="button" class="primary" data-confirmar="${p.key}">Confirmar resultado</button>
          <button type="button" class="mi-sec" data-cancelar="${p.key}">Cancelar</button>`;
      } else if (p.pronta) {
        estado = p === proxima ? `<span class="mi-prox">Próxima luta</span>` : `<span class="mi-mut">Pronta</span>`;
        acao = !concluida && minha ? `<button type="button" ${p === proxima ? 'class="primary"' : ""} data-chamar="${p.key}">Chamar luta</button>` : "";
      } else {
        const fonte = p.fontes.map(f => f.venc || f.perd).filter(Boolean).map(k => res.porChave[k]).filter(x => x && x.real && !x.vencedor);

        estado = `<span class="mi-mut">${fonte.length ? `Aguardando a luta ${fonte.map(x => x.numero).join(" e ")}` : "Aguardando"}</span>`;
      }

      return `<li class="mi-luta ${p.key === ativa ? "agora" : ""} ${p.vencedor ? "feita" : ""}" data-key="${p.key}">
        <span class="mi-num">${p.numero}</span>
        <span class="mi-fase">${esc(p.fase)}</span>
        <span class="mi-atl"><span class="mi-lado aka">AKA</span> ${nome(p.aka)}</span>
        <span class="mi-atl"><span class="mi-lado ao">AO</span> ${nome(p.ao)}</span>
        <span class="mi-estado">${estado}</span>
        <span class="mi-acao">${acao}</span>
      </li>`;
    }).join("");

    let topo = "";

    if (concluida) {
      topo = `<div class="mi-faixa ok">Categoria concluída.${M.papel !== "professor" ? ` <button type="button" id="miReabrir">Reabrir para corrigir</button>` : ""}</div>`;
    } else if (!minha) {
      topo = `<div class="mi-faixa alerta">Esta categoria não está aberta nesta mesa. <button type="button" class="primary" data-abrir="${c.id}">Abrir nesta mesa</button></div>`;
    } else if (res.concluida) {
      topo = `<div class="mi-faixa ok">Todas as lutas foram registradas. <button type="button" class="primary" id="miConcluir">Concluir categoria</button></div>`;
    } else if (res.S === 1) {
      topo = `<div class="mi-faixa ok">Categoria com atleta único: ${esc(res.classificacao[0] ? res.classificacao[0].nome : "")} fica em 1º lugar. <button type="button" class="primary" id="miConcluir">Concluir categoria</button></div>`;
    }

    const classif = (concluida || res.concluida) && res.classificacao.length
      ? `<div class="mi-classif">${res.classificacao.map((a, i) => `<div><span>${i + 1}º</span><b>${esc(a.nome)}</b></div>`).join("")}</div>`
      : "";

    $("#miCorpo").innerHTML = `<div class="mi-cat-view">
      <div class="mi-cat-head">
        <span class="mi-cod grande">${c.codigo ?? ""}</span>
        <div><h2>${esc(nomeCategoria(c))}</h2><small>${MOD[c.modalidade]} ${SEXO[c.sexo]} — ${esc(faixaIdade(c))}${c.faixas ? " — " + esc(c.faixas) : ""}</small></div>
        <span class="spacer"></span>
        <button type="button" id="miVerChave">${M.verChave ? "Esconder a chave" : "Ver a chave"}</button>
        ${minha && !concluida ? `<button type="button" id="miSair">Sair da categoria</button>` : ""}
      </div>
      ${topo}
      ${classif}
      ${M.verChave ? `<div class="mi-chave">${Chave.svg(M.chaves[c.id].dados, { resultados: resultadosDe(c.id) })}</div>` : ""}
      ${res.ordem.length ? `<ol class="mi-lutas">${linhas}</ol>` : ""}
      ${minha && !concluida && !ativa && proxima ? `<p class="mi-dica">Clique em <b>Chamar luta</b>: os nomes vão para o placar. Ao terminar, marque o vencedor no placar e clique em <b>Confirmar resultado</b>.</p>` : ""}
    </div>`;
  }

  async function abrirCategoria(cid, forcar = false) {
    const c = catById(cid);
    const koto = kotoAtual();

    if (!koto) {
      $("#miKoto").focus();
      return toast("Escreva o nome deste koto antes de abrir a categoria (ex.: Koto 1).", "erro");
    }

    gravarLocal(KOTO_KEY, koto);

    const m = M.mesas[cid];

    if (m && m.status === "concluida") {
      M.catId = cid;
      M.escolhendo = false;
      return desenhar();
    }

    const { data, error } = await sb.rpc("reservar_categoria", { p_categoria: cid, p_koto: koto, p_forcar: forcar });

    if (error) {
      const msg = erroTexto(error);

      if (/está aberta no/i.test(msg) && !forcar) {
        const ok = await confirmar(`${esc(msg)}<br><br>Só assuma a categoria se o outro koto realmente parou de usá-la.`, { titulo: "Categoria em uso", ok: "Assumir a categoria", perigo: true });

        return ok ? abrirCategoria(cid, true) : null;
      }

      return toast(msg, "erro");
    }

    M.mesas[cid] = data;
    M.catId = cid;
    M.escolhendo = false;
    toast(`${c ? "Cód. " + c.codigo + " — " + nomeCategoria(c) : "Categoria"} aberta neste koto.`);
    desenhar();
  }

  async function sairCategoria() {
    if (M.ativa && M.ativa.catId === M.catId && !await confirmar("Há uma luta chamada e ainda não confirmada. Sair mesmo assim? O resultado dela não será salvo.", { titulo: "Sair da categoria", ok: "Sair", perigo: true })) {
      return;
    }

    await sb.rpc("liberar_categoria", { p_categoria: M.catId });

    if (M.ativa && M.ativa.catId === M.catId) {
      M.ativa = null;
      gravarLocal(ESTADO_KEY, null);
    }

    M.catId = null;
    M.escolhendo = true;
    await recarregar();
  }

  function fotografar(s) {
    const k = s.kumite;

    return JSON.parse(JSON.stringify({
      mode: s.mode,
      kumite: {
        aka: k.aka,
        ao: k.ao,
        winner: k.winner,
        running: k.timer.running,
        duration: k.duration
      },
      kata: {
        aka: s.kata.aka,
        ao: s.kata.ao,
        winner: s.kata.winner
      }
    }));
  }

  async function chamarLuta(key) {
    const c = catById(M.catId);
    const res = estruturaDe(M.catId);
    const p = res.porChave[key];

    if (!p || !p.pronta) {
      return;
    }

    if (M.ativa && M.ativa.key !== key && !await confirmar(`A luta ${res.porChave[M.ativa.key] ? res.porChave[M.ativa.key].numero : ""} foi chamada e ainda não foi confirmada. Trocar pela luta ${p.numero}?`, { titulo: "Trocar de luta", ok: "Trocar" })) {
      return;
    }

    const modo = c.modalidade;
    const rotulo = `Cód. ${c.codigo} · ${nomeCategoria(c)} · Luta ${p.numero}`;

    Placar.alterar((s, f) => {
      s.mode = modo;
      s.event = M.comp.nome;

      if (modo === "kumite") {
        s.kumite = f.newKumite(s.kumite);
        s.kumite.category = rotulo;
        s.kumite.aka.name = p.aka.nome;
        s.kumite.ao.name = p.ao.nome;
      } else {
        s.kata = f.newKata(s.kata);
        s.kata.category = rotulo;
        s.kata.aka.name = p.aka.nome;
        s.kata.ao.name = p.ao.nome;
      }
    });

    M.ativa = {
      catId: M.catId,
      key,
      numero: p.numero,
      aka: { id: p.aka.id, nome: p.aka.nome, equipe: p.aka.equipe || "" },
      ao: { id: p.ao.id, nome: p.ao.nome, equipe: p.ao.equipe || "" },
      eventos: [],
      inicio: new Date().toISOString()
    };

    M.anterior = fotografar(Placar.estado());
    gravarLocal(ESTADO_KEY, M.ativa);
    desenhar();
    window.scrollTo({ top: $("#kumitePanel").getBoundingClientRect().top + window.scrollY - 12, behavior: "smooth" });
    toast(`Luta ${p.numero} no placar: ${p.aka.nome} (AKA) × ${p.ao.nome} (AO).`);
  }

  function invertido(s) {
    const a = M.ativa;
    const k = s.mode === "kata" ? s.kata : s.kumite;

    return !!a && a.aka.nome !== a.ao.nome && k.aka.name === a.ao.nome && k.ao.name === a.aka.nome;
  }

  function registrarEventos(s) {
    const a = M.ativa;

    if (!a || a.catId !== M.catId) {
      M.anterior = fotografar(s);
      return;
    }

    const c = catById(a.catId);
    const ant = M.anterior;
    const cur = fotografar(s);

    M.anterior = cur;

    if (!ant || !c || c.modalidade !== "kumite" || s.mode !== "kumite") {
      return;
    }

    const ka = ant.kumite, kc = cur.kumite;

    if (ka.aka.name === kc.ao.name && ka.ao.name === kc.aka.name && ka.aka.name !== ka.ao.name) {
      return;
    }

    if (!kc.aka.name && !kc.ao.name) {
      return;
    }

    const inv = invertido(s);
    const chave = lado => inv ? outro(lado) : lado;
    const t = Math.max(0, kc.duration - Placar.restante());

    const placar = () => {
      const pa = kc[inv ? "ao" : "aka"].score, po = kc[inv ? "aka" : "ao"].score;

      return [pa, po];
    };

    const novo = (lado, tipo, texto, v) => a.eventos.push({
      t,
      lado: lado ? chave(lado) : null,
      tipo,
      texto,
      v,
      placar: placar()
    });

    if (!ka.running && kc.running && !a.eventos.some(e => e.tipo === "inicio")) {
      novo(null, "inicio", "Início da luta (Hajime)");
    }

    for (const lado of ["aka", "ao"]) {
      const d = kc[lado].score - ka[lado].score;

      if (d > 0) {
        novo(lado, "ponto", d === 1 ? "Wazari" : d === 2 ? "Ippon" : `+${d} pontos`, d);
      } else if (d < 0) {
        novo(lado, "correcao", `Correção: ${d} ponto(s)`, d);
      }

      if (kc[lado].senshu !== ka[lado].senshu) {
        novo(lado, "senshu", kc[lado].senshu ? "Senshu" : "Senshu retirado");
      }

      s.settings.cats.forEach((_, ci) => {
        const antes = ka[lado].pen[ci] || 0, depois = kc[lado].pen[ci] || 0;

        if (depois !== antes) {
          const cats = s.settings.cats, nomes = s.settings.penalties;

          novo(lado, "penalidade", depois > antes ? `${cats[ci]}: ${nomes[depois - 1]}` : `${cats[ci]}: penalidade retirada`);
        }
      });
    }

    const wa = ka.winner, wc = kc.winner;

    if (JSON.stringify(wa) !== JSON.stringify(wc)) {
      if (wc && wc.side) {
        novo(wc.side, "resultado", `Vencedor: ${LADO[chave(wc.side)]} (${wc.text})`);
      } else if (wc) {
        novo(null, "resultado", wc.text || "Empate");
      } else {
        novo(null, "resultado", "Vencedor retirado");
      }
    }

    gravarLocal(ESTADO_KEY, a);
  }

  Placar.ouvir(registrarEventos);

  async function confirmarLuta(key) {
    const a = M.ativa;
    const c = catById(M.catId);

    if (!a || a.key !== key || !c) {
      return;
    }

    const s = Placar.estado();
    const modo = c.modalidade;

    if (s.mode !== modo) {
      return toast(`O placar está no modo ${s.mode === "kata" ? "Kata" : "Kumitê"}. Volte para ${MOD[modo]} para confirmar esta luta.`, "erro");
    }

    const k = modo === "kumite" ? s.kumite : s.kata;
    const ladoPlacar = modo === "kumite" ? (k.winner && k.winner.side) : k.winner;

    if (!ladoPlacar) {
      return toast(modo === "kumite"
        ? "Marque o vencedor no placar (por exemplo, “AKA venceu”). Empate não vale no chaveamento: escolha quem passa de fase."
        : "Marque o vencedor no placar clicando em “AKA venceu” ou “AO venceu”.", "erro");
    }

    const inv = invertido(s);
    const nomesConferem = inv || (k.aka.name === a.aka.nome && k.ao.name === a.ao.nome);
    const ladoChave = inv ? outro(ladoPlacar) : ladoPlacar;
    const vencedor = a[ladoChave];
    const res = estruturaDe(M.catId);
    const p = res.porChave[key];
    let extra = "";

    if (modo === "kumite") {
      const hans = k.winner.type === "hansoku";

      extra = `<div class="field">Como a luta terminou
          <div class="cf-fim">
            <label><input type="radio" name="cfFim" value="" ${hans ? "" : "checked"}> Normal</label>
            <label><input type="radio" name="cfFim" value="kiken"> Kiken (desistência) de ${esc(a[outro(ladoChave)].nome)}</label>
            <label><input type="radio" name="cfFim" value="hansoku" ${hans ? "checked" : ""}> Hansoku de ${esc(a[outro(ladoChave)].nome)}</label>
          </div></div>`;
    }

    if (modo === "kata") {
      const sistema = s.kata.method === "bandeiras" ? "bandeiras" : "notas";

      extra = `<p class="mut">Sistema: <b>${sistema === "bandeiras" ? "Bandeiras" : "Notas"}</b>. Se quiser, anote o resultado para a súmula:</p>
        <div class="grid2">
          <label class="field">${sistema === "bandeiras" ? "Bandeiras" : "Nota"} de ${esc(a.aka.nome)} (AKA)<input id="cfAka" inputmode="decimal" maxlength="8"></label>
          <label class="field">${sistema === "bandeiras" ? "Bandeiras" : "Nota"} de ${esc(a.ao.nome)} (AO)<input id="cfAo" inputmode="decimal" maxlength="8"></label>
        </div>`;
    }

    const d = modal({
      titulo: `Confirmar a luta ${a.numero}`,
      corpo: `<div class="cf-venc ${ladoChave}"><small>Vencedor</small><b>${esc(vencedor.nome)}</b><span>${LADO[ladoChave]}</span></div>
        ${modo === "kumite" ? `<p>Placar: <b>AKA ${k[inv ? "ao" : "aka"].score} × ${k[inv ? "aka" : "ao"].score} AO</b> — ${esc(k.winner.text || "")}</p>` : ""}
        ${nomesConferem ? "" : `<div class="aviso alerta">Os nomes no placar foram alterados. O vencedor será registrado pela cor marcada (${LADO[ladoPlacar]}).</div>`}
        ${extra}
        <p class="mut small">${p && p.r < res.R - 1 ? `${esc(vencedor.nome)} avança na chave.` : ""}</p>`,
      acoes: [{ texto: "Voltar", classe: "alt" }, {
        texto: "Confirmar resultado", onClick: async (dd) => {
          const detalhes = { modalidade: modo };

          if (modo === "kumite") {
            const map = l => inv ? outro(l) : l;

            detalhes.placar = { aka: k[map("aka")].score, ao: k[map("ao")].score };
            detalhes.senshu = k.aka.senshu ? map("aka") : k.ao.senshu ? map("ao") : null;
            detalhes.pen = { aka: k[map("aka")].pen.slice(), ao: k[map("ao")].pen.slice() };
            detalhes.penNomes = s.settings.penalties.slice();
            detalhes.cats = s.settings.cats.slice();
            detalhes.motivo = k.winner.text || "";
            detalhes.tipo = k.winner.type || "";

            const fim = (dd.querySelector("[name=cfFim]:checked") || {}).value || "";

            detalhes.fim = fim ? { tipo: fim, lado: outro(ladoChave) } : null;

            if (fim === "kiken") {
              detalhes.motivo = `Kiken de ${a[outro(ladoChave)].nome}`;
            }

            detalhes.modo = k.modality;
            detalhes.tempo = { duracao: k.duration, usado: Math.max(0, k.duration - Placar.restante()) };
            detalhes.eventos = a.eventos.slice();
          } else {
            detalhes.sistema = s.kata.method === "bandeiras" ? "bandeiras" : "notas";
            detalhes.formato = s.kata.format;
            detalhes.valor = { aka: ($("#cfAka", dd).value || "").trim(), ao: ($("#cfAo", dd).value || "").trim() };
            detalhes.katas = { aka: k[inv ? "ao" : "aka"].kata || "", ao: k[inv ? "aka" : "ao"].kata || "" };
          }

          const params = {
            p_categoria: M.catId,
            p_chave: key,
            p_numero: a.numero,
            p_fase: p ? p.fase : "",
            p_modalidade: modo,
            p_aka: a.aka,
            p_ao: a.ao,
            p_vencedor: ladoChave,
            p_vencedor_id: vencedor.id || null,
            p_detalhes: detalhes,
            p_koto: kotoAtual()
          };

          dd.close();
          await enviarResultado(params);
        }
      }]
    });

    void d;
  }

  async function enviarResultado(params) {
    const cid = params.p_categoria;

    const local = {
      chave: params.p_chave,
      numero: params.p_numero,
      fase: params.p_fase,
      aka: params.p_aka,
      ao: params.p_ao,
      vencedor: params.p_vencedor,
      vencedor_id: params.p_vencedor_id,
      detalhes: params.p_detalhes,
      koto: params.p_koto,
      registrado_nome: M.perfil.nome || M.perfil.email,
      created_at: new Date().toISOString()
    };

    const { error } = await sb.rpc("registrar_luta", params);

    if (error && erroDeRede(error)) {
      M.fila.push({ tipo: "registrar", p: params });
      gravarLocal(FILA_KEY, M.fila);
      local.pendente = true;
      toast("Sem internet agora. O resultado ficou salvo neste computador e será enviado assim que a conexão voltar.", "erro");
    } else if (error) {
      return toast(erroTexto(error), "erro");
    } else {
      toast(`Resultado da luta ${params.p_numero} salvo.`);
    }

    (M.lutas[cid] = M.lutas[cid] || {})[params.p_chave] = local;
    M.ativa = null;
    gravarLocal(ESTADO_KEY, null);
    desenhar();

    const res = estruturaDe(cid);
    const prox = res.ordem.find(p => p.pronta);

    if (prox) {
      setTimeout(() => {
        const el = $(`.mi-luta[data-key="${prox.key}"]`);

        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 80);
    }
  }

  async function enviarFila() {
    if (!M.fila.length) {
      return;
    }

    const restantes = [];

    for (const f of M.fila) {
      const { error } = await sb.rpc("registrar_luta", f.p);

      if (error && erroDeRede(error)) {
        restantes.push(f);
      } else if (error) {
        toast(`Um resultado guardado não pôde ser enviado: ${erroTexto(error)}`, "erro");
      } else {
        const l = (M.lutas[f.p.p_categoria] || {})[f.p.p_chave];

        if (l) {
          delete l.pendente;
        }
      }
    }

    const enviados = M.fila.length - restantes.length;

    M.fila = restantes;
    gravarLocal(FILA_KEY, M.fila);

    if (enviados) {
      toast(`${enviados} resultado(s) guardado(s) foram enviados.`);
      desenhar();
    } else {
      desenharFila();
    }
  }

  async function cancelarLuta() {
    if (!await confirmar("Cancelar esta luta? Ela volta a ficar pronta para ser chamada de novo, e o que foi marcado no placar não é salvo.", { titulo: "Cancelar luta", ok: "Cancelar luta", perigo: true })) {
      return;
    }

    M.ativa = null;
    gravarLocal(ESTADO_KEY, null);
    desenhar();
  }

  async function desfazer(key) {
    const res = estruturaDe(M.catId);
    const deps = Chave.dependentes(res, key).filter(k => (M.lutas[M.catId] || {})[k]);
    const p = res.porChave[key];

    const txt = deps.length
      ? `Desfazer o resultado da luta ${p.numero}? Isso também apaga o resultado das lutas ${deps.map(k => res.porChave[k].numero).join(", ")}, que dependem dela.`
      : `Desfazer o resultado da luta ${p.numero}? Ela volta a ficar pronta para ser chamada.`;

    if (!await confirmar(txt, { titulo: "Desfazer resultado", ok: "Desfazer", perigo: true })) {
      return;
    }

    const chaves = [key, ...deps];
    const { error } = await sb.rpc("apagar_lutas", { p_categoria: M.catId, p_chaves: chaves });

    if (error) {
      return toast(erroTexto(error), "erro");
    }

    chaves.forEach(k => {
      delete (M.lutas[M.catId] || {})[k];
    });

    M.fila = M.fila.filter(f => !(f.p.p_categoria === M.catId && chaves.includes(f.p.p_chave)));
    gravarLocal(FILA_KEY, M.fila);
    toast("Resultado desfeito.");
    desenhar();
  }

  async function concluir() {
    if (M.fila.some(f => f.p.p_categoria === M.catId)) {
      return toast("Ainda há resultados desta categoria aguardando a internet. Espere o envio para concluir.", "erro");
    }

    const res = estruturaDe(M.catId);
    const classif = res.classificacao.map((a, i) => ({ posicao: i + 1, id: a.id || null, nome: a.nome, equipe: a.equipe || "" }));

    if (!await confirmar(`Concluir a categoria com esta classificação?<br><br>${classif.map(x => `<b>${x.posicao}º</b> ${esc(x.nome)}`).join("<br>")}`, { titulo: "Concluir categoria", ok: "Concluir" })) {
      return;
    }

    const { error } = await sb.rpc("concluir_categoria", { p_categoria: M.catId, p_classificacao: classif });

    if (error) {
      return toast(erroTexto(error), "erro");
    }

    toast("Categoria concluída. Os vencedores já estão na súmula do Shiai Manager.");
    M.catId = null;
    M.escolhendo = true;
    await recarregar();
  }

  async function reabrir() {
    if (!await confirmar("Reabrir esta categoria para corrigir resultados?", { titulo: "Reabrir categoria", ok: "Reabrir" })) {
      return;
    }

    const { error } = await sb.rpc("reabrir_categoria", { p_categoria: M.catId });

    if (error) {
      return toast(erroTexto(error), "erro");
    }

    await recarregar();
    await abrirCategoria(M.catId);
  }

  async function recarregar() {
    try {
      await carregarTudo();
    } catch (e) {
      if (!erroDeRede(e)) {
        toast(erroTexto(e), "erro");
      }
    }

    desenhar();
  }

  raiz.addEventListener("click", e => {
    const b = e.target.closest("button");

    if (!b) {
      return;
    }

    const d = b.dataset;

    if (d.abrir) {
      return abrirCategoria(d.abrir);
    }

    if (d.chamar) {
      return chamarLuta(d.chamar);
    }

    if (d.confirmar) {
      return confirmarLuta(d.confirmar);
    }

    if (d.cancelar) {
      return cancelarLuta();
    }

    if (d.desfazer) {
      return desfazer(d.desfazer);
    }

    switch (b.id) {
      case "miTrocar": {
        M.escolhendo = true;
        return desenhar();
      }
      case "miSair": return sairCategoria();
      case "miConcluir": return concluir();
      case "miReabrir": return reabrir();
      case "miVerChave": {
        M.verChave = !M.verChave;
        return desenhar();
      }
    }
  });

  raiz.addEventListener("input", e => {
    if (e.target.id === "miBusca") {
      M.busca = e.target.value;
      desenharEscolha();
    }

    if (e.target.id === "miKoto") {
      gravarLocal(KOTO_KEY, e.target.value.trim());
    }
  });

  raiz.addEventListener("keydown", e => {
    if (e.target.id === "miBusca" && e.key === "Enter") {
      const primeiro = $(".mi-cat", raiz);

      if (primeiro) {
        primeiro.click();
      }
    }
  });

  window.addEventListener("beforeunload", e => {
    if (M.fila.length) {
      e.preventDefault();
      e.returnValue = "";
    }
  });

  window.addEventListener("online", enviarFila);
  setInterval(enviarFila, 10000);

  setInterval(async () => {
    if (document.visibilityState !== "visible" || document.querySelector("dialog[open]")) {
      return;
    }

    if (M.catId && !M.escolhendo) {
      const m = M.mesas[M.catId];

      if (m && m.reservado_por === M.user.id && m.status !== "concluida") {
        const { data, error } = await sb.rpc("reservar_categoria", { p_categoria: M.catId, p_koto: kotoAtual() || m.koto || "", p_forcar: false });

        if (error && !erroDeRede(error)) {
          toast(`Esta categoria saiu desta mesa: ${erroTexto(error)}`, "erro");
        } else if (data) {
          M.mesas[M.catId] = data;
        }
      }
    }

    const busca = $("#miBusca");
    const digitando = busca && document.activeElement === busca;

    if (!digitando) {
      await recarregar();
    }
  }, 30000);

  M.anterior = fotografar(Placar.estado());
  desenhar();
  enviarFila();
})();
