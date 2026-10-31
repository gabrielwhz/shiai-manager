"use strict";
/* Sorteio, desenho da chave (SVG) e folhas de impressão. */
const Chave = {
  potencia(n) { let p = 2; while (p < n) p *= 2; return p; },
  // Ordem padrão de cabeças de chave: os "byes" (vagas livres) ficam espalhados e nunca se enfrentam.
  ordem(size) { let o = [1]; while (o.length < size) { const m = o.length * 2 + 1; o = o.flatMap(s => [s, m - s]); } return o; },
  embaralhar(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; },
  montar(lista) { const size = this.potencia(lista.length); return this.ordem(size).map(s => s <= lista.length ? lista[s - 1] : null); },
  conflitos(slots) {
    let c = 0;
    for (let i = 0; i < slots.length; i += 2) { const a = slots[i], b = slots[i + 1]; if (a && b && a.equipe && norm(a.equipe) === norm(b.equipe)) c++; }
    return c;
  },
  // Sorteia, tentando evitar que atletas da mesma equipe se enfrentem na primeira luta.
  sortear(atletas) {
    const base = atletas.map(a => ({ id: a.id, nome: a.nome, equipe: a.equipe || "" }));
    if (!base.length) return null;
    const em = new Date().toISOString();
    if (base.length === 1) return { v: 1, slots: base, conflitos: 0, em };
    let best = null, bc = Infinity;
    for (let t = 0; t < 400 && bc > 0; t++) { const s = this.montar(this.embaralhar(base)); const c = this.conflitos(s); if (c < bc) { bc = c; best = s; } }
    return { v: 1, slots: best, conflitos: bc, em };
  },
  vazia(tamanho) { return { v: 1, slots: Array.from({ length: tamanho }, () => ({ nome: "" })), vazia: true }; },
  // Atletas que mudaram desde o sorteio
  diferencas(dados, atletas) {
    const ids = new Set((dados.slots || []).filter(Boolean).map(s => s.id));
    const atuais = new Set(atletas.map(a => a.id));
    return { novos: atletas.filter(a => !ids.has(a.id)).length, saiu: [...ids].filter(i => !atuais.has(i)).length };
  },

  nomeRodada(r, R) {
    const k = R - r;
    return k === 0 ? "Vencedor" : k === 1 ? "Final" : k === 2 ? "Semifinal" : k === 3 ? "Quartas de final" : `${r + 1}ª rodada`;
  },
  corte(t, max) { t = String(t || ""); return t.length > max ? t.slice(0, max - 1) + "…" : t; },

  svg(dados) {
    const C = { linha: "#1B2236", fraca: "#B7BFCF", aka: "#D12A3A", ao: "#2357C9", txt: "#111", mut: "#6B7385", ouro: "#E8A80C" };
    const F = 'font-family="Barlow, Arial, sans-serif"';
    const slots = dados.slots || [];
    const W = 1000;
    if (slots.length === 1) {
      const n = slots[0] ? slots[0].nome : "";
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} 110" ${F}>
        <text x="20" y="22" font-size="13" fill="${C.mut}">Atleta único na categoria</text>
        <circle cx="26" cy="62" r="5" fill="${C.ouro}"/><text x="40" y="66" font-size="18" font-weight="600" fill="${C.txt}">${esc(n)}</text>
        <line x1="20" y1="76" x2="520" y2="76" stroke="${C.linha}" stroke-width="2"/>
        <text x="20" y="98" font-size="12" fill="${C.mut}">1º lugar</text></svg>`;
    }
    const S = slots.length, R = Math.log2(S);
    const gap = S >= 64 ? 22 : S >= 32 ? 26 : S >= 16 ? 32 : 42;
    const fs = S >= 32 ? 11 : 13.5;
    const top = 34, padL = 8;
    const H = top + S * gap + 26;
    const colW = (W - padL - 8) / (R + 1);
    let ys = slots.map((_, i) => top + i * gap + gap / 2 + 4);
    let cur = slots.map(s => ({ nome: s ? s.nome : null, bye: s === null }));
    const out = [];
    let luta = 1;
    for (let r = 0; r <= R; r++) {
      const x = padL + r * colW, xe = r < R ? x + colW - 16 : x + colW - 20;
      const maxC = Math.max(6, Math.floor((colW - (r < R ? 30 : 12)) / (fs * 0.52)));
      out.push(`<text x="${x}" y="16" font-size="11.5" font-weight="700" fill="${C.mut}">${this.nomeRodada(r, R)}</text>`);
      cur.forEach((s, j) => {
        const y = ys[j];
        out.push(`<line x1="${x}" y1="${y}" x2="${xe}" y2="${y}" stroke="${s.bye ? C.fraca : C.linha}" stroke-width="${r === R ? 2.4 : 1.6}" ${s.bye ? 'stroke-dasharray="4 4"' : ""}/>`);
        if (r < R) out.push(`<circle cx="${x + 6}" cy="${y - 8}" r="4" fill="${j % 2 ? C.ao : C.aka}"/>`);
        else out.push(`<circle cx="${x + 6}" cy="${y - 8}" r="4.5" fill="${C.ouro}"/>`);
        const t = s.bye ? "sem adversário" : this.corte(s.nome, maxC);
        if (t) out.push(`<text x="${x + 16}" y="${y - 5}" font-size="${s.bye ? fs - 2 : fs}" ${s.bye ? `fill="${C.mut}" font-style="italic"` : `fill="${C.txt}" font-weight="500"`}>${esc(t)}</text>`);
      });
      if (r === R) break;
      const next = [], ny = [];
      for (let j = 0; j < cur.length; j += 2) {
        const y1 = ys[j], y2 = ys[j + 1], ym = (y1 + y2) / 2, a = cur[j], b = cur[j + 1];
        const temBye = r === 0 && (a.bye || b.bye);
        out.push(`<path d="M${xe} ${y1}V${y2}M${xe} ${ym}H${x + colW}" fill="none" stroke="${temBye ? C.fraca : C.linha}" stroke-width="1.6"/>`);
        let nome = null;
        if (temBye) nome = a.bye ? b.nome : a.nome;
        else {
          out.push(`<circle cx="${xe}" cy="${ym}" r="9.5" fill="#fff" stroke="${C.linha}" stroke-width="1.2"/>
            <text x="${xe}" y="${ym + 3.8}" font-size="10.5" font-weight="700" text-anchor="middle" fill="${C.txt}">${luta++}</text>`);
        }
        next.push({ nome, bye: false }); ny.push(ym);
      }
      cur = next; ys = ny;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" ${F}>${out.join("")}</svg>`;
  }
};

/* ---------- impressão ---------- */
function cabecalhoFolha(comp) {
  const logo = comp.logo || "../assets/logo.svg";
  const info = [fmtDatas(comp.datas), comp.local, comp.federacao].filter(Boolean).map(esc).join(" — ");
  return { logo: esc(logo), nome: esc(comp.nome), info };
}
function folhaSumula(comp, cat, dados) {
  const h = cabecalhoFolha(comp);
  const det = cat
    ? `<span><b>Categoria:</b> ${esc(cat.nome)}</span><span><b>Sexo:</b> ${SEXO[cat.sexo]}</span><span><b>Idade:</b> ${esc(faixaIdade(cat))}</span>${cat.faixas ? `<span><b>Faixas:</b> ${esc(cat.faixas)}</span>` : ""}<span><b>Cód.</b> ${cat.codigo ?? ""}</span>`
    : `<span><b>Categoria:</b> ______________________________________</span><span><b>Modalidade:</b> (&nbsp;&nbsp;) Kata&nbsp;&nbsp;(&nbsp;&nbsp;) Kumitê</span><span><b>Cód.</b> ______</span>`;
  const tit = cat ? `Súmula de ${MOD[cat.modalidade]}` : "Súmula de combate";
  const grande = (dados.slots || []).length >= 32 ? " grande" : "";
  return `<section class="folha sumula${grande}">
    <header class="fs-top"><img src="${h.logo}" alt=""><div><strong>${h.nome}</strong><span>${h.info}</span></div><div class="fs-tit">${tit}</div></header>
    <div class="fs-cat">${det}</div>
    <div class="fs-chave">${Chave.svg(dados)}</div>
    <footer class="fs-rodape">
      <div class="fs-linhas"><p><b>Árbitros:</b></p><p><b>Mesários:</b></p><p><b>Observações:</b></p></div>
      <table class="fs-class"><tr><th colspan="2">Classificação</th></tr><tr><td>1º</td><td></td></tr><tr><td>2º</td><td></td></tr><tr><td>3º</td><td></td></tr><tr><td>3º</td><td></td></tr></table>
    </footer>
  </section>`;
}
function folhaListaAtletas(comp, cats, atletas, mostrarQuem) {
  const h = cabecalhoFolha(comp);
  const linhas = (lista) => `<table class="lista-tab"><thead><tr><th>#</th><th>Nome</th><th>Idade</th><th>Sexo</th><th>Graduação</th><th>Equipe</th>${mostrarQuem ? "<th>Cadastrado por</th>" : ""}</tr></thead><tbody>
    ${lista.map((a, i) => `<tr><td>${i + 1}</td><td>${esc(a.nome)}</td><td>${a.idade ?? ""}</td><td>${a.sexo || ""}</td><td>${esc(a.graduacao || "")}</td><td>${esc(a.equipe || "")}</td>${mostrarQuem ? `<td>${esc(a.cadastrado_por_nome || "")}</td>` : ""}</tr>`).join("")}</tbody></table>`;
  let html = "";
  for (const c of cats) {
    const l = atletas.filter(a => (a.categorias || []).includes(c.id)).sort((x, y) => cmpNome(x.nome, y.nome));
    if (!l.length) continue;
    html += `<div class="lista-cat"><h3>Cód. ${c.codigo ?? ""} — ${esc(c.nome)} — ${MOD[c.modalidade]} ${SEXO[c.sexo]} — ${esc(faixaIdade(c))} (${l.length})</h3>${linhas(l)}</div>`;
  }
  const ids = new Set(cats.map(c => c.id));
  const sem = atletas.filter(a => !(a.categorias || []).some(id => ids.has(id))).sort((x, y) => cmpNome(x.nome, y.nome));
  if (sem.length) html += `<div class="lista-cat"><h3>Sem categoria (${sem.length})</h3>${linhas(sem)}</div>`;
  return `<section class="folha">
    <header class="lista-top"><img src="${h.logo}" alt=""><div><strong>${h.nome}</strong><span>${h.info}</span><span style="display:block">Lista de atletas por categoria — ${atletas.length} atleta(s)</span></div></header>
    ${html || "<p>Nenhum atleta cadastrado.</p>"}</section>`;
}
function imprimir(html, { titulo, paisagem = true }) {
  let area = $("#print");
  if (!area) { area = document.createElement("div"); area.id = "print"; document.body.append(area); }
  area.innerHTML = html;
  let st = $("#pageStyle");
  if (!st) { st = document.createElement("style"); st.id = "pageStyle"; document.head.append(st); }
  st.textContent = `@page{size:A4 ${paisagem ? "landscape" : "portrait"};margin:9mm}`;
  const antigo = document.title;
  document.title = titulo; // o navegador usa o título como nome sugerido do PDF
  window.addEventListener("afterprint", () => { document.title = antigo; area.innerHTML = ""; }, { once: true });
  const imgs = $$("img", area);
  Promise.all(imgs.map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; }))).then(() => setTimeout(() => window.print(), 60));
}
