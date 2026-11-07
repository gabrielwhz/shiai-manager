"use strict";

const Chave = {
  potencia(n) {
    let p = 2;

    while (p < n) {
      p *= 2;
    }

    return p;
  },
  ordem(size) {
    let o = [1];

    while (o.length < size) {
      const m = o.length * 2 + 1;

      o = o.flatMap(s => [s, m - s]);
    }

    return o;
  },
  embaralhar(a) {
    a = a.slice();

    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));

      [a[i], a[j]] = [a[j], a[i]];
    }

    return a;
  },
  montar(lista) {
    const size = this.potencia(lista.length);

    return this.ordem(size).map(s => s <= lista.length ? lista[s - 1] : null);
  },
  conflitos(slots) {
    let c = 0;

    for (let i = 0; i < slots.length; i += 2) {
      const a = slots[i], b = slots[i + 1];

      if (a && b && a.equipe && norm(a.equipe) === norm(b.equipe)) {
        c++;
      }
    }

    return c;
  },
  sortear(atletas) {
    const base = atletas.map(a => ({ id: a.id, nome: a.nome, equipe: a.equipe || "" }));

    if (!base.length) {
      return null;
    }

    const em = new Date().toISOString();

    if (base.length === 1) {
      return {
        v: 1,
        slots: base,
        conflitos: 0,
        em
      };
    }

    let best = null, bc = Infinity;

    for (let t = 0; t < 400 && bc > 0; t++) {
      const s = this.montar(this.embaralhar(base));
      const c = this.conflitos(s);

      if (c < bc) {
        bc = c;
        best = s;
      }
    }

    return {
      v: 1,
      slots: best,
      conflitos: bc,
      em
    };
  },
  vazia(tamanho) {
    return {
      v: 1,
      slots: Array.from({ length: tamanho }, () => ({ nome: "" })),
      vazia: true
    };
  },
  diferencas(dados, atletas) {
    const ids = new Set((dados.slots || []).filter(Boolean).map(s => s.id));
    const atuais = new Set(atletas.map(a => a.id));

    return {
      novos: atletas.filter(a => !ids.has(a.id)).length,
      saiu: [...ids].filter(i => !atuais.has(i)).length
    };
  },
  nomeRodada(r, R) {
    const k = R - r;

    return k === 0 ? "Vencedor" : k === 1 ? "Final" : k === 2 ? "Semifinal" : k === 3 ? "Quartas de final" : `${r + 1}ª rodada`;
  },
  corte(t, max) {
    t = String(t || "");
    return t.length > max ? t.slice(0, max - 1) + "…" : t;
  },
  svg(dados, opts = {}) {
    const C = {
      linha: "#1B2236",
      fraca: "#B7BFCF",
      aka: "#D12A3A",
      ao: "#2357C9",
      txt: "#111",
      mut: "#6B7385",
      ouro: "#E8A80C"
    };

    const F = 'font-family="Barlow, Arial, sans-serif"';
    const slots = dados.slots || [];
    let W = 1000;

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

    if (opts.proporcao) {
      W = Math.max(1000, Math.round(H * opts.proporcao));
    }

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

        if (r < R) {
          out.push(`<circle cx="${x + 6}" cy="${y - 8}" r="4" fill="${j % 2 ? C.ao : C.aka}"/>`);
        } else {
          out.push(`<circle cx="${x + 6}" cy="${y - 8}" r="4.5" fill="${C.ouro}"/>`);
        }

        const t = s.bye ? "sem adversário" : this.corte(s.nome, maxC);

        if (t) {
          out.push(`<text x="${x + 16}" y="${y - 5}" font-size="${s.bye ? fs - 2 : fs}" ${s.bye ? `fill="${C.mut}" font-style="italic"` : `fill="${C.txt}" font-weight="500"`}>${esc(t)}</text>`);
        }
      });

      if (r === R) {
        break;
      }

      const next = [], ny = [];

      for (let j = 0; j < cur.length; j += 2) {
        const y1 = ys[j], y2 = ys[j + 1], ym = (y1 + y2) / 2, a = cur[j], b = cur[j + 1];
        const temBye = r === 0 && (a.bye || b.bye);

        out.push(`<path d="M${xe} ${y1}V${y2}M${xe} ${ym}H${x + colW}" fill="none" stroke="${temBye ? C.fraca : C.linha}" stroke-width="1.6"/>`);

        let nome = null;

        if (temBye) {
          nome = a.bye ? b.nome : a.nome;
        } else {
          out.push(`<circle cx="${xe}" cy="${ym}" r="9.5" fill="#fff" stroke="${C.linha}" stroke-width="1.2"/>
            <text x="${xe}" y="${ym + 3.8}" font-size="10.5" font-weight="700" text-anchor="middle" fill="${C.txt}">${luta++}</text>`);
        }

        next.push({ nome, bye: false });
        ny.push(ym);
      }

      cur = next;
      ys = ny;
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" ${F}>${out.join("")}</svg>`;
  }
};

const LOGO_PADRAO = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Shiai Manager">
  <rect width="64" height="64" rx="15" fill="#15203B"/>
  <g fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="5">
    <path d="M13 18h13v14" stroke="#E5404F"/>
    <path d="M13 46h13V32" stroke="#4C7EEA"/>
    <path d="M26 32h14" stroke="#FFFFFF"/>
  </g>
  <circle cx="47" cy="32" r="6.5" fill="#F2B21B"/>
</svg>`);

function nomeArquivoSumula(cat) {
  return nomeSeguro(`${nomeCategoria(cat)} - ${MOD[cat.modalidade]} ${SEXO[cat.sexo]} - Cód ${cat.codigo ?? ""}`);
}

function paginaSumulaSVG(comp, cat, dados) {
  const W = 1123, H = 794, M = 36, NAVY = "#15203B";
  const info = [fmtDatas(comp.datas), comp.local, comp.federacao].filter(Boolean).join(" — ");
  const tit = cat ? `Súmula de ${MOD[cat.modalidade]}` : "Súmula de combate";
  let det;

  if (cat) {
    const partes = [["Categoria", nomeCategoria(cat)], ["Sexo", SEXO[cat.sexo]], ["Idade", faixaIdade(cat)]];

    if (cat.faixas) {
      partes.push(["Faixas", cat.faixas]);
    }

    partes.push(["Cód.", cat.codigo ?? ""]);
    det = partes.map(([k, v], i) => `<tspan font-weight="700" ${i ? 'dx="26"' : ""}>${k}: </tspan><tspan>${esc(Chave.corte(v, 70))}</tspan>`).join("");
  } else {
    det = `<tspan font-weight="700">Categoria: </tspan><tspan>__________________________________________</tspan>
      <tspan font-weight="700" dx="26">Modalidade: </tspan><tspan>(   ) Kata    (   ) Kumitê</tspan>
      <tspan font-weight="700" dx="26">Cód.: </tspan><tspan>________</tspan>`;
  }

  const top = M + 112, fy = H - M - 122, alt = fy - 14 - top;
  const chave = Chave.svg(dados, { proporcao: (W - 2 * M) / alt }).replace('<svg xmlns="http://www.w3.org/2000/svg" ', `<svg x="${M}" y="${top}" width="${W - 2 * M}" height="${alt}" preserveAspectRatio="xMidYMin meet" `);
  const lx2 = W - M - 262, tx = W - M - 236;
  const linhas = ["Árbitros:", "Mesários:", "Observações:"].map((r, i) => `<text x="${M}" y="${fy + 20 + i * 40}" font-size="13" font-weight="700">${r}</text>
     <line x1="${M}" y1="${fy + 28 + i * 40}" x2="${lx2}" y2="${fy + 28 + i * 40}" stroke="#000" stroke-width="1"/>`).join("");

  const tabela = `<rect x="${tx}" y="${fy}" width="236" height="24" fill="${NAVY}"/>
    <text x="${tx + 118}" y="${fy + 17}" font-size="14" font-weight="700" fill="#fff" text-anchor="middle">Classificação</text>
    ${["1º", "2º", "3º", "3º"].map((l, i) => `<rect x="${tx}" y="${fy + 24 + i * 24}" width="236" height="24" fill="none" stroke="#000"/>
      <line x1="${tx + 44}" y1="${fy + 24 + i * 24}" x2="${tx + 44}" y2="${fy + 48 + i * 24}" stroke="#000"/>
      <text x="${tx + 22}" y="${fy + 41 + i * 24}" font-size="13" font-weight="700" text-anchor="middle">${l}</text>`).join("")}`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Barlow, Arial, Helvetica, sans-serif" fill="#111">
    <rect width="${W}" height="${H}" fill="#fff"/>
    <text x="${M + 68}" y="${M + 25}" font-size="23" font-weight="700">${esc(Chave.corte(comp.nome, 56))}</text>
    <text x="${M + 68}" y="${M + 46}" font-size="12.5" fill="#444">${esc(Chave.corte(info, 110))}</text>
    <text x="${W - M}" y="${M + 32}" font-size="21" font-weight="700" text-anchor="end">${tit}</text>
    <line x1="${M}" y1="${M + 64}" x2="${W - M}" y2="${M + 64}" stroke="${NAVY}" stroke-width="2.5"/>
    <text x="${M}" y="${M + 88}" font-size="13.5">${det}</text>
    <line x1="${M}" y1="${M + 99}" x2="${W - M}" y2="${M + 99}" stroke="#BBB" stroke-width="1"/>
    ${chave}${linhas}${tabela}</svg>`;

  return {
    svg,
    logo: {
      src: comp.logo || LOGO_PADRAO,
      x: M,
      y: M,
      w: 56,
      h: 56
    },
    W,
    H
  };
}

async function paginaSumula(comp, cat, dados) {
  const p = paginaSumulaSVG(comp, cat, dados);
  const img = await svgParaJPEG(p.svg, p.W, p.H, p.logo, 2);

  return { ...img, paisagem: true };
}

function linhaCategoriasAtleta(a, catById) {
  const cs = (a.categorias || []).map(catById).filter(Boolean);

  return ["kata", "kumite"].map(m => {
    const l = cs.filter(c => c.modalidade === m);

    return `${MOD[m]}: ${l.length ? l.map(c => `Cód ${c.codigo ?? ""} - ${c.nome}`).join(" / ") : "(não inscrito)"}`;
  }).join("  |  ");
}

function folhaListaAtletas(comp, cats, atletas) {
  const catById = id => cats.find(c => c.id === id);
  const lista = atletas.slice().sort((x, y) => cmpNome(x.nome, y.nome));
  const logo = esc(comp.logo || "../assets/logo.svg");

  return `<section class="folha lista">
    <header class="lista-top"><img src="${logo}" alt=""><div><strong>${esc(comp.nome)}</strong>
      <span>Lista de atletas — ${lista.length} atleta(s) — ${new Date().toLocaleDateString("pt-BR")}</span></div></header>
    <table class="lista-tab"><thead><tr><th>Nº</th><th>Nome</th><th>Idade</th><th>Faixa</th><th>Equipe / academia</th></tr></thead>
    ${lista.map((a, i) => `<tbody><tr class="l1"><td class="n" rowspan="2">${i + 1}</td><td><b>${esc(a.nome)}</b>${a.pcd ? ` <span class="pcd-tag">PCD${a.pcd_descricao ? ": " + esc(a.pcd_descricao) : ""}</span>` : ""}</td><td>${a.idade ?? ""}</td><td>${esc(a.graduacao || "")}</td><td>${esc(a.equipe || "")}</td></tr>
      <tr class="l2"><td colspan="4">${esc(linhaCategoriasAtleta(a, catById))}</td></tr></tbody>`).join("")}
    </table>${lista.length ? "" : "<p>Nenhum atleta cadastrado.</p>"}</section>`;
}

function imprimir(html, { titulo, paisagem = true }) {
  let area = $("#print");

  if (!area) {
    area = document.createElement("div");
    area.id = "print";
    document.body.append(area);
  }

  area.innerHTML = html;

  let st = $("#pageStyle");

  if (!st) {
    st = document.createElement("style");
    st.id = "pageStyle";
    document.head.append(st);
  }

  st.textContent = `@page{size:A4 ${paisagem ? "landscape" : "portrait"};margin:10mm}`;

  const antigo = document.title;

  document.title = titulo;

  window.addEventListener("afterprint", () => {
    document.title = antigo;
    area.innerHTML = "";
  }, { once: true });

  const imgs = $$("img", area);

  Promise.all(imgs.map(i => i.complete ? 0 : new Promise(r => {
    i.onload = i.onerror = r;
  }))).then(() => setTimeout(() => window.print(), 60));
}
