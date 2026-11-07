"use strict";

const BUILD = 7;

console.log("Shiai Manager build " + BUILD);

const CFG = window.APP_CONFIG || {};
const CONFIG_OK = !!CFG.SUPABASE_URL && !/COLE_AQUI/.test(CFG.SUPABASE_URL) &&
  !!CFG.SUPABASE_ANON_KEY && !/COLE_AQUI/.test(CFG.SUPABASE_ANON_KEY);
const sb = (CONFIG_OK && window.supabase) ? window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY) : null;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
}[c]));

const cmpNome = (a, b) => String(a || "").trim().localeCompare(String(b || "").trim(), "pt-BR", { sensitivity: "base" });

const norm = s => String(s || "").trim()
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "");

const SEXO = { M: "Masculino", F: "Feminino", X: "Misto" };
const _ic = d => `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

const ICONE = {
  editar: _ic('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>'),
  excluir: _ic('<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>'),
  pdf: _ic('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M12 12v6M9 15l3 3 3-3"/>'),
  zip: _ic('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><path d="M12 11v6M9 14l3 3 3-3"/>'),
  seta: _ic('<path d="m9 6 6 6-6 6"/>')
};

const MOD = { kata: "Kata", kumite: "Kumitê" };
const FAIXAS = ["Branca", "Amarela", "Vermelha", "Laranja", "Verde", "Roxa", "Marrom", "Preta"];

function iniciais(t) {
  return String(t || "?").trim()
    .split(/\s+/)
    .filter(w => w.length > 2 || /^\p{Lu}/u.test(w))
    .slice(0, 2)
    .map(w => w[0])
    .join("")
    .toUpperCase() || "?";
}

function avatarHTML(p, cls = "av") {
  return p && p.avatar
    ? `<img class="${cls}" src="${esc(p.avatar)}" alt="">`
    : `<span class="${cls}" aria-hidden="true">${esc(iniciais(p && (p.nome || p.email)))}</span>`;
}

function logoHTML(comp, cls = "comp-logo") {
  return comp && comp.logo
    ? `<img class="${cls}" src="${esc(comp.logo)}" alt="">`
    : `<div class="${cls} vazio" aria-hidden="true">${esc(iniciais(comp && comp.nome))}</div>`;
}

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function fmtDatas(arr) {
  const ds = (arr || []).filter(Boolean).map(s => {
    const [y, m, d] = s.split("-").map(Number);

    return {
      y,
      m,
      d,
      s
    };
  })
    .sort((a, b) => a.s.localeCompare(b.s));

  if (!ds.length) {
    return "Data a definir";
  }

  const lista = xs => xs.length === 1 ? xs[0] : xs.slice(0, -1).join(", ") + " e " + xs[xs.length - 1];
  const mesmoMes = ds.every(x => x.y === ds[0].y && x.m === ds[0].m);

  if (mesmoMes) {
    return `${lista(ds.map(x => x.d))} de ${MESES[ds[0].m - 1]} de ${ds[0].y}`;
  }

  const mesmoAno = ds.every(x => x.y === ds[0].y);

  if (mesmoAno) {
    return `${lista(ds.map(x => `${x.d} de ${MESES[x.m - 1]}`))} de ${ds[0].y}`;
  }

  return lista(ds.map(x => `${x.d}/${String(x.m).padStart(2, "0")}/${x.y}`));
}

function quando(iso) {
  const d = new Date(iso), s = (Date.now() - d) / 1000;

  if (s < 60) {
    return "agora";
  }

  if (s < 3600) {
    return `há ${Math.floor(s / 60)} min`;
  }

  if (s < 86400) {
    return `há ${Math.floor(s / 3600)} h`;
  }

  return d.toLocaleDateString("pt-BR");
}

function faixaIdade(c) {
  const a = c.idade_min, b = c.idade_max;

  if (a != null && b != null) {
    return a === b ? `${a} anos` : `${a} a ${b} anos`;
  }

  if (a != null) {
    return `${a} anos ou mais`;
  }

  if (b != null) {
    return `até ${b} anos`;
  }

  return "Idade livre";
}

function catCompativel(c, idade, sexo) {
  if (sexo && c.sexo !== "X" && c.sexo !== sexo) {
    return false;
  }

  if (idade !== "" && idade != null && !isNaN(idade)) {
    if (c.idade_min != null && idade < c.idade_min) {
      return false;
    }

    if (c.idade_max != null && idade > c.idade_max) {
      return false;
    }
  }

  return true;
}

function nomeArquivoCat(c) {
  return `${MOD[c.modalidade]} ${SEXO[c.sexo]} - ${c.nome} - Cod ${c.codigo}`.replace(/[\\/:*?"<>|]/g, "");
}

function erroTexto(e) {
  const m = (e && (e.message || e.error_description || e.msg)) || String(e || "Erro desconhecido");

  if (/Invalid login credentials/i.test(m)) {
    return "E-mail ou senha incorretos.";
  }

  if (/already registered|already been registered/i.test(m)) {
    return "Já existe uma conta com esse e-mail. Use a opção Entrar.";
  }

  if (/Password should be at least/i.test(m)) {
    return "A senha precisa ter pelo menos 6 caracteres.";
  }

  if (/Email not confirmed/i.test(m)) {
    return "Confirme o seu e-mail antes de entrar. Procure a mensagem na sua caixa de entrada.";
  }

  if (/For security purposes, you can only request this after/i.test(m)) {
    return "Aguarde um minuto antes de pedir outro e-mail.";
  }

  if (/rate limit/i.test(m)) {
    return "Muitas tentativas seguidas. Espere alguns minutos e tente de novo.";
  }

  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) {
    return "Sem conexão com o servidor. Verifique a internet.";
  }

  if (/categorias_codigo_idx/i.test(m)) {
    return "Já existe uma categoria com esse código nesta competição.";
  }

  if (/should be different from the old/i.test(m)) {
    return "A nova senha precisa ser diferente da senha atual.";
  }

  if (/session missing|Auth session/i.test(m)) {
    return "O link expirou ou já foi usado. Peça um novo link.";
  }

  if (/row-level security|permission denied/i.test(m)) {
    return "Você não tem permissão para fazer isso nesta competição.";
  }

  return m;
}

function toast(msg, tipo = "ok") {
  let box = $("#toasts");

  if (!box) {
    box = document.createElement("div");
    box.id = "toasts";
    box.setAttribute("aria-live", "polite");
    document.body.append(box);
  }

  const el = document.createElement("div");

  el.className = "toast " + tipo;
  el.textContent = msg;
  box.append(el);

  while (box.children.length > 3) {
    box.firstElementChild.remove();
  }

  setTimeout(() => el.remove(), tipo === "erro" ? 6500 : 3500);
}

function modal({ titulo, corpo, largo = false, acoes = [] }) {
  const d = document.createElement("dialog");

  d.className = "modal" + (largo ? " largo" : "");

  d.innerHTML = `<div class="modal-head"><h2>${esc(titulo)}</h2><button type="button" class="x" aria-label="Fechar">×</button></div>
    <div class="modal-body">${corpo}</div>
    ${acoes.length ? `<div class="modal-foot">${acoes.map((a, i) => `<button type="button" class="btn ${a.classe || ""}" data-i="${i}">${esc(a.texto)}</button>`).join("")}</div>` : ""}`;

  document.body.append(d);
  d.querySelector(".x").onclick = () => d.close();
  d.addEventListener("close", () => d.remove());

  acoes.forEach((a, i) => {
    d.querySelector(`[data-i="${i}"]`).onclick = () => a.onClick ? a.onClick(d) : d.close();
  });

  d.showModal();
  return d;
}

function confirmar(texto, { titulo = "Confirmar", ok = "Confirmar", perigo = false } = {}) {
  return new Promise(res => {
    let r = false;

    const d = modal({
      titulo,
      corpo: `<p>${texto}</p>`,
      acoes: [
        { texto: "Cancelar", classe: "alt" },
        {
          texto: ok,
          classe: perigo ? "danger" : "",
          onClick: dd => {
            r = true;
            dd.close();
          }
        }
      ]
    });

    d.addEventListener("close", () => res(r));
  });
}

async function comBotao(btn, fn) {
  const t = btn.textContent;

  btn.disabled = true;
  btn.textContent = "Aguarde…";

  try {
    return await fn();
  } finally {
    btn.disabled = false;

    if (btn.textContent === "Aguarde…") {
      btn.textContent = t;
    }
  }
}

function lerImagem(file, max = 320) {
  return new Promise((res, rej) => {
    if (!file || !/^image\//.test(file.type)) {
      return rej(new Error("Escolha um arquivo de imagem (PNG ou JPG)."));
    }

    const fr = new FileReader();

    fr.onerror = () => rej(new Error("Não foi possível ler a imagem."));

    fr.onload = () => {
      const img = new Image();

      img.onerror = () => rej(new Error("Esse formato de imagem não é suportado. Use PNG ou JPG."));

      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");

        c.width = Math.round(img.width * k);
        c.height = Math.round(img.height * k);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        res(c.toDataURL("image/png"));
      };

      img.src = fr.result;
    };

    fr.readAsDataURL(file);
  });
}

function telaSemConfig() {
  document.body.innerHTML = `<main><div class="card stack" style="max-width:640px;margin:40px auto">
    <h2>Falta configurar o Supabase</h2>
    <p>Abra o arquivo <b>js/config.js</b> e cole a <b>Project URL</b> e a chave <b>anon public</b> do seu projeto do Supabase.</p>
    <p class="mut">${window.supabase ? "" : "A biblioteca do Supabase também não carregou. Verifique a internet."}</p></div></main>`;
}

async function iniciarPagina(ativa) {
  if (!sb) {
    telaSemConfig();
    return new Promise(() => { });
  }

  if (/error_code=|error=/.test(location.hash)) {
    location.replace("login.html" + location.hash);
    return new Promise(() => { });
  }

  const { data: { session } } = await sb.auth.getSession();

  if (!session) {
    location.replace("login.html");
    return new Promise(() => { });
  }

  const user = session.user;
  let { data: perfil } = await sb.from("profiles").select("*").eq("id", user.id).maybeSingle();

  if (!perfil) {
    perfil = {
      id: user.id,
      nome: (user.user_metadata && user.user_metadata.nome) || "",
      email: user.email
    };
  }

  montarTopo(perfil, ativa);
  atualizarSino(user.id);

  sb.auth.onAuthStateChange(ev => {
    if (ev === "SIGNED_OUT" && !window.__semRedirect) {
      location.replace("login.html");
    }
  });

  return { user, perfil };
}

function montarTopo(perfil, ativa) {
  const velho = $("header.topo");

  if (velho) {
    velho.remove();
  }

  const h = document.createElement("header");

  h.className = "topo";

  h.innerHTML = `<div class="topo-in">
    <a class="marca" href="painel.html"><img src="../assets/logo.svg" alt=""><span><b>Shiai Manager</b><small>Campeonatos de karatê</small></span></a>
    <nav aria-label="Principal">
      <a href="painel.html" ${ativa === "comp" ? 'aria-current="page"' : ""}>Competições</a>
      <a href="painel.html#notificacoes" ${ativa === "notif" ? 'aria-current="page"' : ""}>Notificações<span class="badge" id="sino" hidden></span></a>
      <a href="conta.html" class="eu" title="Minha conta" ${ativa === "conta" ? 'aria-current="page"' : ""}>${avatarHTML(perfil)}<span class="quem">${esc(perfil.nome || perfil.email)}</span></a>
      <button type="button" id="sair">Sair</button>
    </nav></div>`;

  document.body.prepend(h);

  $("#sair").onclick = async () => {
    await sb.auth.signOut();
    location.replace("login.html");
  };
}

async function atualizarSino(uid) {
  const { count } = await sb.from("convites").select("id", { count: "exact", head: true })
    .eq("convidado_id", uid).eq("status", "pendente");
  const b = $("#sino");

  if (b) {
    b.hidden = !count;
    b.textContent = count || "";
    b.setAttribute("aria-label", `${count} novas`);
  }

  return count || 0;
}

function linhaCategoriaHTML(c = {}) {
  const sel = (v, o) => v === o ? "selected" : "";

  return `<div class="cat-row" data-id="${esc(c.id || "")}">
    <label class="field c-cod">Código<input name="codigo" type="number" min="1" max="99999" inputmode="numeric" value="${c.codigo ?? ""}" placeholder="auto" title="Deixe em branco para numerar automaticamente"></label>
    <label class="field c-nome">Nome da categoria<input name="nome" value="${esc(c.nome || "")}" placeholder="Ex.: Infantil 9 e 10 anos" maxlength="100"></label>
    <label class="field">Modalidade<select name="modalidade"><option value="kata" ${sel(c.modalidade, "kata")}>Kata</option><option value="kumite" ${sel(c.modalidade, "kumite")}>Kumitê</option></select></label>
    <label class="field">Sexo<select name="sexo"><option value="M" ${sel(c.sexo, "M")}>Masculino</option><option value="F" ${sel(c.sexo, "F")}>Feminino</option><option value="X" ${sel(c.sexo, "X")}>Misto</option></select></label>
    <label class="field">Idade de<input name="idade_min" type="number" min="0" max="120" inputmode="numeric" value="${c.idade_min ?? ""}"></label>
    <label class="field">até<input name="idade_max" type="number" min="0" max="120" inputmode="numeric" value="${c.idade_max ?? ""}"></label>
    <label class="field c-faixas">Faixas (opcional)<input name="faixas" value="${esc(c.faixas || "")}" placeholder="Ex.: Branca a amarela" maxlength="80"></label>
    <label class="field c-pcd">PCD<span class="pcd-chk"><input type="checkbox" name="pcd" ${c.pcd ? "checked" : ""}> Sim</span></label>
    <button type="button" class="rm" title="Remover esta categoria" aria-label="Remover esta categoria">×</button>
  </div>`;
}

function bindLinhasCategoria(box, addBtn, { minimo = 0 } = {}) {
  const add = (c) => {
    box.insertAdjacentHTML("beforeend", linhaCategoriaHTML(c));

    const r = box.lastElementChild;

    return r;
  };

  box.addEventListener("click", e => {
    const b = e.target.closest(".rm");

    if (!b) {
      return;
    }

    if (box.children.length <= minimo) {
      return toast("Mantenha pelo menos uma linha.", "erro");
    }

    b.closest(".cat-row").remove();
  });

  if (addBtn) {
    addBtn.onclick = () => {
      const last = box.lastElementChild;
      const base = last ? lerLinha(last) : {};
      const r = add({ modalidade: base.modalidade, sexo: base.sexo, pcd: base.pcd });

      r.querySelector("input[name=nome]").focus();
    };
  }

  return add;
}

function nomeCategoria(c) {
  return c.pcd && !/pcd/i.test(c.nome) ? `${c.nome} (PCD)` : c.nome;
}

function chipPcd(cond) {
  return cond ? ` <span class="chip pcd">PCD</span>` : "";
}

function num(v) {
  return v === "" || v == null ? null : parseInt(v, 10);
}

function lerLinha(row) {
  const g = n => row.querySelector(`[name=${n}]`).value.trim();

  return {
    id: row.dataset.id || null,
    codigo: num(g("codigo")),
    nome: g("nome"),
    modalidade: g("modalidade"),
    sexo: g("sexo"),
    idade_min: num(g("idade_min")),
    idade_max: num(g("idade_max")),
    faixas: g("faixas") || null,
    pcd: row.querySelector("[name=pcd]").checked
  };
}

function lerLinhasCategoria(box) {
  const out = [];

  for (const row of $$(".cat-row", box)) {
    const c = lerLinha(row);
    const vazia = !c.nome && c.codigo == null && c.idade_min == null && c.idade_max == null && !c.faixas;

    if (vazia) {
      continue;
    }

    if (!c.nome) {
      row.querySelector("[name=nome]").focus();
      throw new Error("Dê um nome para cada categoria.");
    }

    if (c.codigo != null && (isNaN(c.codigo) || c.codigo < 1)) {
      row.querySelector("[name=codigo]").focus();
      throw new Error(`O código da categoria "${c.nome}" precisa ser um número a partir de 1.`);
    }

    if (c.codigo != null && out.some(o => o.codigo === c.codigo)) {
      row.querySelector("[name=codigo]").focus();
      throw new Error(`O código ${c.codigo} está repetido na lista.`);
    }

    if (c.idade_min != null && c.idade_max != null && c.idade_min > c.idade_max) {
      row.querySelector("[name=idade_min]").focus();
      throw new Error(`Na categoria "${c.nome}", a idade inicial é maior que a final.`);
    }

    out.push(c);
  }

  return out;
}

function atribuirCodigos(lista, usados = []) {
  let max = Math.max(0, ...usados, ...lista.map(c => c.codigo || 0));

  return lista.map(c => ({ ...c, codigo: c.codigo != null ? c.codigo : ++max }));
}

function formCompeticaoHTML(comp = {}, comCategorias = true) {
  return `<form class="stack" id="fComp" novalidate>
    <div class="logo-pick">
      <span id="logoPrev">${logoHTML(comp)}</span>
      <div class="stack" style="gap:6px">
        <span class="field" style="margin:0">Logo da competição</span>
        <div class="row"><label class="btn alt sm">Escolher imagem<input type="file" id="logoFile" accept="image/png,image/jpeg,image/webp" hidden></label>
        <button type="button" class="linkbtn danger" id="logoTirar" ${comp.logo ? "" : "hidden"}>Remover</button></div>
      </div>
    </div>
    <label class="field">Nome da competição<input name="nome" required maxlength="120" value="${esc(comp.nome || "")}" placeholder="Ex.: I Copa Regional de Karatê"></label>
    <label class="field">Local<input name="local" maxlength="160" value="${esc(comp.local || "")}" placeholder="Ex.: Ginásio Municipal, Vitória da Conquista"></label>
    <fieldset><legend>Data</legend><div class="datas-list" id="datas"></div>
      <button type="button" class="btn alt sm" id="addData">+ Adicionar outro dia</button></fieldset>
    <label class="field">Federação<input name="federacao" maxlength="120" value="${esc(comp.federacao || "")}" placeholder="Ex.: Federação Baiana de Karatê"></label>
    ${comCategorias ? `<fieldset><legend>Categorias</legend>
      <p class="mut small" style="margin-bottom:10px">Deixe o código em branco para numerar automaticamente. Você pode adicionar ou mudar categorias depois, dentro da competição.</p>
      <div class="cat-rows" id="catRows"></div>
      <button type="button" class="btn alt sm" id="addCat" style="margin-top:10px">+ Adicionar categoria</button></fieldset>` : ""}
  </form>`;
}

function bindFormCompeticao(root, comp = {}, comCategorias = true) {
  let logo = comp.logo || null;
  const prev = $("#logoPrev", root), tirar = $("#logoTirar", root);

  const pintar = () => {
    prev.innerHTML = logoHTML({ logo, nome: $("[name=nome]", root).value });
    tirar.hidden = !logo;
  };

  $("#logoFile", root).onchange = async (e) => {
    try {
      logo = await lerImagem(e.target.files[0]);
      pintar();
    } catch (err) {
      toast(err.message, "erro");
    }

    e.target.value = "";
  };

  tirar.onclick = () => {
    logo = null;
    pintar();
  };

  $("[name=nome]", root).addEventListener("input", () => {
    if (!logo) {
      pintar();
    }
  });

  const datasBox = $("#datas", root);

  const addData = (v = "") => {
    datasBox.insertAdjacentHTML("beforeend", `<div class="row"><input type="date" value="${esc(v)}" aria-label="Dia da competição">
      <button type="button" class="linkbtn danger" data-rmdata>Remover</button></div>`);
  };

  datasBox.addEventListener("click", e => {
    if (!e.target.matches("[data-rmdata]")) {
      return;
    }

    if (datasBox.children.length === 1) {
      datasBox.querySelector("input").value = "";
      return;
    }

    e.target.parentElement.remove();
  });

  (comp.datas && comp.datas.length ? comp.datas : [""]).forEach(addData);

  $("#addData", root).onclick = () => {
    addData();
    datasBox.lastElementChild.querySelector("input").focus();
  };

  let addCat = null;

  if (comCategorias) {
    addCat = bindLinhasCategoria($("#catRows", root), $("#addCat", root));
    addCat({ modalidade: "kata", sexo: "M" });
  }

  return function ler() {
    const nome = $("[name=nome]", root).value.trim();

    if (!nome) {
      $("[name=nome]", root).focus();
      throw new Error("Escreva o nome da competição.");
    }

    const datas = [...new Set($$("#datas input", root).map(i => i.value).filter(Boolean))].sort();

    const dados = {
      nome,
      local: $("[name=local]", root).value.trim() || null,
      federacao: $("[name=federacao]", root).value.trim() || null,
      datas,
      logo
    };

    return {
      dados,
      categorias: comCategorias ? lerLinhasCategoria($("#catRows", root)) : []
    };
  };
}
