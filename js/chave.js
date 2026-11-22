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

    return k === 0 ? "Vencedor" : k === 1 ? "Final" : k === 2 ? "Semifinal" : k === 3 ? "Quartas de final" : k === 4 ? "Oitavas de final" : `${r + 1}ª rodada`;
  },
  corte(t, max) {
    t = String(t || "");
    return t.length > max ? t.slice(0, max - 1) + "…" : t;
  },
  estrutura(dados) {
    const slots = dados.slots || [];
    const S = slots.length;

    const vazio = {
      S,
      R: 0,
      partidas: [],
      porChave: {},
      ordem: []
    };

    if (S <= 1) {
      return vazio;
    }

    const R = Math.round(Math.log2(S));
    const partidas = [], porChave = {};

    for (let r = 0; r < R; r++) {
      const qtd = S / 2 ** (r + 1);

      for (let j = 0; j < qtd; j++) {
        const key = `r${r}-${j}`;

        const fontes = r === 0
          ? [{ slot: 2 * j }, { slot: 2 * j + 1 }]
          : [{ venc: `r${r - 1}-${2 * j}` }, { venc: `r${r - 1}-${2 * j + 1}` }];

        const real = r > 0 || (!!slots[2 * j] && !!slots[2 * j + 1]);

        const p = {
          key,
          r,
          j,
          fontes,
          real,
          fase: this.nomeRodada(r, R)
        };

        partidas.push(p);
        porChave[key] = p;
      }
    }

    let n = 1;

    for (let r = 0; r < R; r++) {
      partidas.filter(p => p.r === r && p.real).forEach(p => {
        p.numero = n++;
      });
    }

    const ordem = partidas.filter(p => p.real).sort((a, b) => a.numero - b.numero);

    return {
      S,
      R,
      partidas,
      porChave,
      ordem
    };
  },
  resolver(dados, resultados = {}) {
    const e = this.estrutura(dados);
    const slots = dados.slots || [];
    const venc = {}, perd = {};
    const atleta = f => f.slot != null ? slots[f.slot] || null : f.venc ? venc[f.venc] || null : perd[f.perd] || null;
    const lista = e.partidas;

    for (const p of lista) {
      p.aka = atleta(p.fontes[0]);
      p.ao = atleta(p.fontes[1]);
      p.vencedor = null;
      p.bye = !p.real;

      if (!p.real) {
        venc[p.key] = p.aka || p.ao;
        p.vencedor = p.aka ? "aka" : "ao";
        continue;
      }

      const res = resultados[p.key];

      if (res && p.aka && p.ao) {
        const vence = res.vencedor === "ao" ? p.ao : p.aka;
        const ok = !res.vencedor_id || !vence.id || res.vencedor_id === vence.id;

        if (ok) {
          p.vencedor = res.vencedor === "ao" ? "ao" : "aka";
          p.resultado = res;
          venc[p.key] = vence;
          perd[p.key] = p.vencedor === "aka" ? p.ao : p.aka;
        }
      }

      p.pronta = !!(p.aka && p.ao) && !p.vencedor;
    }

    const classificacao = [];
    let concluida = false;

    if (e.S === 1) {
      if (slots[0]) {
        classificacao.push(slots[0]);
      }

      concluida = true;
    } else if (e.S >= 2) {
      const fin = `r${e.R - 1}-0`;

      if (venc[fin] && e.porChave[fin].vencedor) {
        classificacao.push(venc[fin], perd[fin]);

        if (e.R >= 2) {
          const ordemSemis = e.porChave[fin].vencedor === "aka" ? [0, 1] : [1, 0];

          ordemSemis.map(j => e.porChave[`r${e.R - 2}-${j}`]).filter(s => s.real && perd[s.key]).forEach(s => classificacao.push(perd[s.key]));
        }

        concluida = true;
      }
    }

    return {
      ...e,
      venc,
      perd,
      classificacao,
      concluida
    };
  },
  dependentes(e, key) {
    const deps = new Set();
    const lista = e.partidas;
    let mudou = true;

    while (mudou) {
      mudou = false;

      for (const p of lista) {
        if (deps.has(p.key)) {
          continue;
        }

        const usa = p.fontes.some(f => f.venc === key || f.perd === key || deps.has(f.venc) || deps.has(f.perd));

        if (usa) {
          deps.add(p.key);
          mudou = true;
        }
      }
    }

    return [...deps];
  },
  svg(dados, opts = {}) {
    const C = {
      linha: "#1B2236",
      aka: "#D12A3A",
      ao: "#2357C9",
      txt: "#111",
      mut: "#6B7385",
      ouro: "#E8A80C",
      vence: "#0F7A45"
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

    const res = this.resolver(dados, opts.resultados || {});
    const S = res.S, R = res.R;
    const linhas = slots.filter(Boolean).length;
    const gap = linhas >= 48 ? 24 : linhas >= 24 ? 28 : linhas >= 12 ? 34 : 42;
    const fs = linhas >= 24 ? 11 : 13.5;
    const top = 34, padL = 8;
    const H = top + linhas * gap + 30;

    if (opts.proporcao) {
      W = Math.max(1000, Math.round(H * opts.proporcao));
    }

    const colW = (W - padL - 8) / (R + 1);
    const out = [];
    const colX = r => padL + r * colW;
    const colFim = r => r < R ? colX(r) + colW - 16 : colX(r) + colW - 20;
    const maxC = r => Math.max(6, Math.floor((colW - (r < R ? 30 : 12)) / (fs * 0.52)));
    const folhas = [], saidas = [];
    let cursor = top + gap / 2 + 4;

    for (let j = 0; j < S / 2; j++) {
      if (res.porChave[`r0-${j}`].real) {
        folhas.push(cursor, cursor + gap);
        saidas.push(cursor + gap / 2);
        cursor += 2 * gap;
      } else {
        folhas.push(cursor, cursor);
        saidas.push(cursor);
        cursor += gap;
      }
    }

    const ys = [folhas, saidas];

    for (let r = 2; r <= R; r++) {
      const ant = ys[r - 1], cur = [];

      for (let j = 0; j < ant.length; j += 2) {
        cur.push((ant[j] + ant[j + 1]) / 2);
      }

      ys.push(cur);
    }

    const linhaAtleta = (r, y, cor, atleta, extra = {}) => {
      const x = colX(extra.direto ? 0 : r), xe = colFim(r);
      const limite = extra.direto ? maxC(0) + maxC(r) : maxC(r);

      out.push(`<line x1="${x}" y1="${y}" x2="${xe}" y2="${y}" stroke="${C.linha}" stroke-width="${r === R ? 2.4 : 1.6}"/>`);
      out.push(`<circle cx="${x + 6}" cy="${y - 8}" r="${cor === "ouro" ? 4.5 : 4}" fill="${C[cor]}"/>`);

      if (atleta && atleta.nome) {
        const peso = extra.perdeu ? `fill="${C.mut}"` : `fill="${C.txt}" font-weight="${extra.venceu ? 700 : 500}"`;

        out.push(`<text x="${x + 16}" y="${y - 5}" font-size="${fs}" ${peso}>${esc(this.corte(atleta.nome, limite))}</text>`);
      }

      if (extra.direto) {
        out.push(`<text x="${x + 16}" y="${y + 10}" font-size="${fs - 3}" fill="${C.mut}" font-style="italic">(sem adversário)</text>`);
      }
    };

    const direto = (p, lado) => p.r === 1 && !res.porChave[`r0-${2 * p.j + lado}`].real;

    const circulo = (x, y, numero) => {
      out.push(`<circle cx="${x}" cy="${y}" r="9.5" fill="#fff" stroke="${C.linha}" stroke-width="1.2"/>
        <text x="${x}" y="${y + 3.8}" font-size="10.5" font-weight="700" text-anchor="middle" fill="${C.txt}">${numero}</text>`);
    };

    for (let r = 0; r <= R; r++) {
      out.push(`<text x="${colX(r)}" y="16" font-size="11.5" font-weight="700" fill="${C.mut}">${this.nomeRodada(r, R)}</text>`);
    }

    for (const p of res.partidas) {
      if (!p.real) {
        continue;
      }

      const y1 = ys[p.r][2 * p.j], y2 = ys[p.r][2 * p.j + 1];
      const decidido = p.vencedor;

      linhaAtleta(p.r, y1, "aka", p.aka, { direto: direto(p, 0), venceu: decidido && p.vencedor === "aka", perdeu: decidido && p.vencedor === "ao" });
      linhaAtleta(p.r, y2, "ao", p.ao, { direto: direto(p, 1), venceu: decidido && p.vencedor === "ao", perdeu: decidido && p.vencedor === "aka" });

      const xe = colFim(p.r), ym = (y1 + y2) / 2;

      out.push(`<path d="M${xe} ${y1}V${y2}M${xe} ${ym}H${colX(p.r + 1)}" fill="none" stroke="${C.linha}" stroke-width="1.6"/>`);

      if (p.real) {
        circulo(xe, ym, p.numero);
      }
    }

    const campeao = res.venc[`r${R - 1}-0`];
    const finalDecidida = res.porChave[`r${R - 1}-0`].vencedor;

    linhaAtleta(R, ys[R][0], "ouro", finalDecidida ? campeao : null, { venceu: true });
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

function cabecalhoSVG(comp, titulo, W, M) {
  const NAVY = "#15203B";
  const info = [fmtDatas(comp.datas), comp.local, comp.federacao].filter(Boolean).join(" — ");

  return `<text x="${M + 68}" y="${M + 25}" font-size="23" font-weight="700">${esc(Chave.corte(comp.nome, W > 900 ? 56 : 34))}</text>
    <text x="${M + 68}" y="${M + 46}" font-size="12.5" fill="#444">${esc(Chave.corte(info, W > 900 ? 110 : 64))}</text>
    <text x="${W - M}" y="${M + 32}" font-size="21" font-weight="700" text-anchor="end">${esc(titulo)}</text>
    <line x1="${M}" y1="${M + 64}" x2="${W - M}" y2="${M + 64}" stroke="${NAVY}" stroke-width="2.5"/>`;
}

function paginaSumulaSVG(comp, cat, dados, opts = {}) {
  const W = 1123, H = 794, M = 36, NAVY = "#15203B";
  const tit = opts.titulo || (cat ? `Súmula de ${MOD[cat.modalidade]}` : "Súmula de combate");
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

  const res = Chave.resolver(dados, opts.resultados || {});
  const classif = opts.resultados ? res.classificacao : [];
  const semisReais = res.R >= 2 && [0, 1].every(j => res.porChave[`r${res.R - 2}-${j}`].real);
  const qtdLugares = res.S <= 1 ? 1 : res.S === 2 ? 2 : semisReais ? 4 : 3;
  const lugares = ["1º", "2º", "3º", "4º"].slice(0, Math.max(qtdLugares, 2));
  const altTab = 24 + lugares.length * 24;
  const fy = H - M - Math.max(altTab, opts.semAssinaturas ? 0 : 128);
  const top = M + 112, alt = fy - 16 - top;
  const chave = Chave.svg(dados, { proporcao: (W - 2 * M) / alt, resultados: opts.resultados })
    .replace('<svg xmlns="http://www.w3.org/2000/svg" ', `<svg x="${M}" y="${top}" width="${W - 2 * M}" height="${alt}" preserveAspectRatio="xMidYMin meet" `);
  const tw = 300, tx = W - M - tw;
  const larg = tx - 26 - M;

  const assinaturas = (titulo, qtd, x, w) => `<text x="${x}" y="${fy + 14}" font-size="13" font-weight="700">${titulo}</text>
    ${Array.from({ length: qtd }, (_, i) => `<text x="${x}" y="${fy + 36 + i * 22}" font-size="12">${i + 1}.</text>
      <line x1="${x + 18}" y1="${fy + 38 + i * 22}" x2="${x + w}" y2="${fy + 38 + i * 22}" stroke="#000" stroke-width="1"/>`).join("")}`;

  const linhas = opts.semAssinaturas
    ? (opts.nota ? `<text x="${M}" y="${fy + 20}" font-size="12" fill="#555">${esc(opts.nota)}</text>` : "")
    : assinaturas("Árbitros", 5, M, larg * 0.54) + assinaturas("Mesários", 3, M + larg * 0.6, larg * 0.4);

  const tabela = `<rect x="${tx}" y="${fy}" width="${tw}" height="24" fill="${NAVY}"/>
    <text x="${tx + tw / 2}" y="${fy + 17}" font-size="14" font-weight="700" fill="#fff" text-anchor="middle">Classificação</text>
    ${lugares.map((l, i) => `<rect x="${tx}" y="${fy + 24 + i * 24}" width="${tw}" height="24" fill="none" stroke="#000"/>
      <line x1="${tx + 44}" y1="${fy + 24 + i * 24}" x2="${tx + 44}" y2="${fy + 48 + i * 24}" stroke="#000"/>
      <text x="${tx + 22}" y="${fy + 41 + i * 24}" font-size="13" font-weight="700" text-anchor="middle">${l}</text>
      <text x="${tx + 54}" y="${fy + 41 + i * 24}" font-size="13">${esc(Chave.corte(classif[i] ? classif[i].nome : "", 34))}</text>`).join("")}`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Barlow, Arial, Helvetica, sans-serif" fill="#111">
    <rect width="${W}" height="${H}" fill="#fff"/>
    ${cabecalhoSVG(comp, tit, W, M)}
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

async function paginaSumula(comp, cat, dados, opts = {}) {
  const p = paginaSumulaSVG(comp, cat, dados, opts);
  const img = await svgParaJPEG(p.svg, p.W, p.H, p.logo, 2);

  return { ...img, paisagem: true };
}

function fmtTempoLuta(ms) {
  if (ms == null || isNaN(ms)) {
    return "";
  }

  const s = Math.max(0, Math.round(ms / 1000));

  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function contagemKumite(luta, lado) {
  const d = (luta && luta.detalhes) || {};
  const ev = (d.eventos || []).filter(e => e.lado === lado);
  let wazari = 0, ippon = 0;

  for (const e of ev) {
    if (e.tipo === "ponto") {
      if (e.v === 2) {
        ippon++;
      } else {
        wazari += e.v || 1;
      }
    }

    if (e.tipo === "correcao") {
      let falta = Math.abs(e.v || 1);

      while (falta > 0) {
        if (wazari > 0) {
          wazari--;
          falta--;
        } else if (ippon > 0) {
          ippon--;
          wazari++;
          falta--;
        } else {
          break;
        }
      }
    }
  }

  if (!ev.length && d.placar && d.placar[lado]) {
    wazari = d.placar[lado];
  }

  return { wazari, ippon };
}

function blocoKumiteSVG(x0, y0, w, h, luta) {
  const COR = { aka: "#E8202A", ao: "#4A86C8" };
  const d = (luta && luta.detalhes) || {};
  const out = [];
  const pw = 236, topo = 17, cab = 15, rodape = 16;
  const rh = (h - topo - cab - rodape) / 5;
  const linhas = [["Wazari", 6], ["Ippon", 3], ["Jogai", 4], ["Atenai", 4], ["Comport.", 4]];
  const fim = d.fim || {};
  const perdedor = luta && luta.vencedor ? (luta.vencedor === "aka" ? "ao" : "aka") : null;

  out.push(`<rect x="${x0}" y="${y0}" width="${w}" height="${h}" fill="none" stroke="#000" stroke-width="1.2"/>`);
  out.push(`<text x="${x0 + 6}" y="${y0 + 13}" font-size="12" font-weight="700">${luta && luta.numero ? luta.numero : "___"} <tspan>Luta</tspan>${luta && luta.fase ? `<tspan font-weight="400" fill="#555" dx="8">${esc(luta.fase)}</tspan>` : ""}</text>`);

  if (luta && luta.koto) {
    out.push(`<text x="${x0 + w - 6}" y="${y0 + 13}" font-size="9.5" fill="#555" text-anchor="end">${esc(luta.koto)}${luta.registrado_nome ? " — Mesário: " + esc(luta.registrado_nome) : ""}</text>`);
  }

  ["aka", "ao"].forEach(lado => {
    const px = lado === "aka" ? x0 : x0 + w - pw;
    const py = y0 + topo;
    const atleta = luta ? luta[lado] || {} : {};
    const cont = contagemKumite(luta, lado);
    const pen = (d.pen && d.pen[lado]) || [];
    const marcados = [cont.wazari, cont.ippon, pen[0] || 0, pen[1] || 0, pen[2] || 0];

    out.push(`<rect x="${px}" y="${py}" width="${pw}" height="${cab}" fill="${COR[lado]}" stroke="#000" stroke-width="1"/>`);
    out.push(`<text x="${px + 18}" y="${py + 11.5}" font-size="10" font-weight="700" fill="${lado === "aka" ? "#fff" : "#000"}">Atleta ${lado === "aka" ? "AKA" : "AO"} <tspan font-weight="400">${esc(Chave.corte(atleta.nome || "", 28))}</tspan></text>`);

    if (luta && luta.vencedor === lado) {
      out.push(`<text x="${px + pw - 5}" y="${py + 11.5}" font-size="8.5" font-weight="700" fill="${lado === "aka" ? "#fff" : "#000"}" text-anchor="end">VENCEDOR</text>`);
    }

    linhas.forEach(([rot, qtd], i) => {
      const ry = py + cab + i * rh;

      out.push(`<rect x="${px}" y="${ry}" width="62" height="${rh}" fill="none" stroke="#000" stroke-width="1"/>`);
      out.push(`<rect x="${px + 62}" y="${ry}" width="${pw - 62}" height="${rh}" fill="none" stroke="#000" stroke-width="1"/>`);
      out.push(`<text x="${px + 31}" y="${ry + rh / 2 + 4}" font-size="10.5" text-anchor="middle">${rot}</text>`);

      for (let k = 1; k <= qtd; k++) {
        const cx = px + 62 + 12 + (k - 1) * 23, cy = ry + rh / 2;
        const on = k <= Math.min(marcados[i], qtd);

        out.push(`<circle cx="${cx}" cy="${cy}" r="7" fill="${on ? "#000" : "#fff"}" stroke="#000" stroke-width="0.9"/>`);
        out.push(`<text x="${cx}" y="${cy + 3.2}" font-size="8.5" text-anchor="middle" fill="${on ? "#fff" : "#000"}">${k}</text>`);
      }

      if (marcados[i] > qtd) {
        out.push(`<text x="${px + pw - 6}" y="${ry + rh / 2 + 4}" font-size="9" text-anchor="end" font-weight="700">+${marcados[i] - qtd}</text>`);
      }
    });

    const ry = py + cab + 5 * rh;
    const kiken = perdedor === lado && fim.tipo === "kiken";
    const hansoku = perdedor === lado && (fim.tipo === "hansoku" || d.tipo === "hansoku");

    out.push(`<rect x="${px}" y="${ry}" width="${pw}" height="${rodape}" fill="none" stroke="#000" stroke-width="1"/>`);
    out.push(`<text x="${px + 36}" y="${ry + 11.5}" font-size="8.5" font-weight="700">KIKEN</text>`);
    out.push(`<circle cx="${px + 72}" cy="${ry + 8}" r="5" fill="${kiken ? "#000" : "#fff"}" stroke="#000" stroke-width="0.9"/>`);
    out.push(`<text x="${px + 134}" y="${ry + 11.5}" font-size="8.5" font-weight="700">HANSOKU</text>`);
    out.push(`<circle cx="${px + 184}" cy="${ry + 8}" r="5" fill="${hansoku ? "#000" : "#fff"}" stroke="#000" stroke-width="0.9"/>`);
  });

  const cx = x0 + w / 2, cy = y0 + topo;
  const sAka = d.senshu === "aka", sAo = d.senshu === "ao";

  out.push(`<rect x="${cx - 68}" y="${cy + 3}" width="16" height="11" fill="${sAka ? COR.aka : "#fff"}" stroke="${COR.aka}" stroke-width="1.6"/>`);
  out.push(`<text x="${cx}" y="${cy + 12}" font-size="9.5" font-style="italic" font-weight="700" fill="#777" text-anchor="middle">SENSHU</text>`);
  out.push(`<rect x="${cx + 52}" y="${cy + 3}" width="16" height="11" fill="${sAo ? COR.ao : "#fff"}" stroke="#2B5D94" stroke-width="1.6"/>`);
  out.push(`<rect x="${cx - 70}" y="${cy + cab + 2}" width="140" height="16" fill="none" stroke="#000" stroke-width="1"/>`);
  out.push(`<text x="${cx}" y="${cy + cab + 14}" font-size="10.5" font-weight="700" text-anchor="middle">TOTAL</text>`);
  out.push(`<rect x="${cx - 70}" y="${cy + cab + 18}" width="140" height="34" fill="none" stroke="#000" stroke-width="1"/>`);

  const pa = luta && d.placar ? d.placar.aka : "", po = luta && d.placar ? d.placar.ao : "";

  out.push(`<text x="${cx}" y="${cy + cab + 42}" font-size="20" text-anchor="middle"><tspan font-weight="700" fill="${COR.aka}">${pa}</tspan><tspan dx="10">X</tspan><tspan dx="10" font-weight="700" fill="#2B5D94">${po}</tspan></text>`);

  if (luta && d.motivo) {
    out.push(`<text x="${cx}" y="${cy + cab + 68}" font-size="8.5" fill="#555" text-anchor="middle">${esc(Chave.corte(d.motivo, 38))}</text>`);
  }

  if (luta && d.tempo) {
    out.push(`<text x="${cx}" y="${cy + cab + 80}" font-size="8.5" fill="#555" text-anchor="middle">Tempo: ${fmtTempoLuta(d.tempo.usado)} de ${fmtTempoLuta(d.tempo.duracao)}</text>`);
  }

  return out.join("");
}

function paginasKumiteSVG(comp, cat, lutas) {
  const W = 794, H = 1123, M = 34, POR = 6;
  const lista = lutas && lutas.length ? lutas : [];
  const paginas = [];
  const total = Math.max(1, Math.ceil(lista.length / POR));

  for (let pg = 0; pg < total; pg++) {
    const out = [];
    const y0 = M + 62;
    const gap = 10;
    const bh = (H - M - 16 - y0 - gap * (POR - 1)) / POR;

    out.push(`<text x="${W / 2}" y="${M + 14}" font-size="19" font-weight="700" text-anchor="middle">Súmula Kumitê</text>`);
    out.push(`<text x="${W / 2}" y="${M + 30}" font-size="10" fill="#555" text-anchor="middle">${esc(Chave.corte(comp.nome, 80))}</text>`);
    out.push(`<text x="${M + 6}" y="${M + 50}" font-size="12.5">CATEGORIA</text>`);
    out.push(`<line x1="${M + 78}" y1="${M + 52}" x2="${M + 420}" y2="${M + 52}" stroke="#000" stroke-width="0.8"/>`);

    if (cat) {
      out.push(`<text x="${M + 82}" y="${M + 49}" font-size="12.5" font-weight="700">${esc(Chave.corte(`Cód. ${cat.codigo ?? ""} — ${nomeCategoria(cat)} — ${SEXO[cat.sexo]}`, 52))}</text>`);
    }

    if (total > 1) {
      out.push(`<text x="${W - M}" y="${M + 50}" font-size="10" fill="#555" text-anchor="end">Folha ${pg + 1} de ${total}</text>`);
    }

    for (let i = 0; i < POR; i++) {
      out.push(blocoKumiteSVG(M, y0 + i * (bh + gap), W - 2 * M, bh, lista[pg * POR + i] || null));
    }

    out.push(`<text x="${M}" y="${H - M + 8}" font-size="8.5" fill="#777">${lista.length ? `Preenchida automaticamente pelo Shiai Manager em ${new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}.` : "Súmula de kumitê para preenchimento manual."}</text>`);

    paginas.push({
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Arial, Helvetica, sans-serif" fill="#111">
        <rect width="${W}" height="${H}" fill="#fff"/>${out.join("")}</svg>`,
      W,
      H
    });
  }

  return paginas;
}

async function paginasKumite(comp, cat, lutas) {
  const saida = [];

  for (const p of paginasKumiteSVG(comp, cat, lutas)) {
    const img = await svgParaJPEG(p.svg, p.W, p.H, null, 2);

    saida.push({ ...img, paisagem: false });
  }

  return saida;
}

function nomeArquivoKumite(cat) {
  return nomeSeguro(`Súmula de kumitê - ${nomeCategoria(cat)} - ${SEXO[cat.sexo]} - Cód ${cat.codigo ?? ""}`);
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
