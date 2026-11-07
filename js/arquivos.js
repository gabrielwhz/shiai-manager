"use strict";

const _enc = new TextEncoder();

function baixarBlob(blob, nome) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = nome;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

function nomeSeguro(t) {
  return String(t || "arquivo").replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140) || "arquivo";
}

function criarPDFBytes(paginas) {
  const partes = [], offsets = [];
  let pos = 0;
  const put = x => {
    const b = typeof x === "string" ? _enc.encode(x) : x;

    partes.push(b);
    pos += b.length;
  };
  const obj = (n, corpo) => {
    offsets[n] = pos;
    put(`${n} 0 obj\n`);
    corpo();
    put("\nendobj\n");
  };

  put("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");

  const n = paginas.length;
  const pg = i => 3 + i * 3;

  obj(1, () => put("<< /Type /Catalog /Pages 2 0 R >>"));
  obj(2, () => put(`<< /Type /Pages /Count ${n} /Kids [${paginas.map((_, i) => `${pg(i)} 0 R`).join(" ")}] >>`));

  paginas.forEach((p, i) => {
    const W = p.paisagem === false ? 595.28 : 841.89, H = p.paisagem === false ? 841.89 : 595.28;
    const conteudo = `q ${W} 0 0 ${H} 0 0 cm /Im0 Do Q`;

    obj(pg(i), () => put(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 ${pg(i) + 2} 0 R >> >> /Contents ${pg(i) + 1} 0 R >>`));
    obj(pg(i) + 1, () => {
      put(`<< /Length ${conteudo.length} >>\nstream\n`);
      put(conteudo);
      put("\nendstream");
    });

    obj(pg(i) + 2, () => {
      put(`<< /Type /XObject /Subtype /Image /Width ${p.w} /Height ${p.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`);
      put(p.jpeg);
      put("\nendstream");
    });
  });

  const total = 3 + n * 3;
  const xref = pos;
  let x = `xref\n0 ${total}\n0000000000 65535 f \n`;

  for (let i = 1; i < total; i++) {
    x += String(offsets[i]).padStart(10, "0") + " 00000 n \n";
  }

  put(x + `trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);

  const out = new Uint8Array(pos);
  let o = 0;

  for (const b of partes) {
    out.set(b, o);
    o += b.length;
  }

  return out;
}

function criarPDF(paginas) {
  return new Blob([criarPDFBytes(paginas)], { type: "application/pdf" });
}

const _crcTab = (() => {
  const t = new Uint32Array(256);

  for (let n = 0; n < 256; n++) {
    let c = n;

    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    }

    t[n] = c >>> 0;
  }

  return t;
})();

function _crc32(b) {
  let c = 0xFFFFFFFF;

  for (let i = 0; i < b.length; i++) {
    c = _crcTab[(c ^ b[i]) & 0xFF] ^ (c >>> 8);
  }

  return (c ^ 0xFFFFFFFF) >>> 0;
}

function criarZIP(arquivos) {
  const partes = [], central = [];
  let pos = 0;
  const d = new Date();
  const hora = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const dia = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();

  for (const a of arquivos) {
    const nome = _enc.encode(a.nome), crc = _crc32(a.dados), tam = a.dados.length;
    const h = new DataView(new ArrayBuffer(30));

    h.setUint32(0, 0x04034b50, true);
    h.setUint16(4, 20, true);
    h.setUint16(6, 0x0800, true);
    h.setUint16(8, 0, true);
    h.setUint16(10, hora, true);
    h.setUint16(12, dia, true);
    h.setUint32(14, crc, true);
    h.setUint32(18, tam, true);
    h.setUint32(22, tam, true);
    h.setUint16(26, nome.length, true);
    h.setUint16(28, 0, true);

    const c = new DataView(new ArrayBuffer(46));

    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 20, true);
    c.setUint16(8, 0x0800, true);
    c.setUint16(10, 0, true);
    c.setUint16(12, hora, true);
    c.setUint16(14, dia, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, tam, true);
    c.setUint32(24, tam, true);
    c.setUint16(28, nome.length, true);
    c.setUint32(42, pos, true);
    partes.push(new Uint8Array(h.buffer), nome, a.dados);
    central.push(new Uint8Array(c.buffer), nome);
    pos += 30 + nome.length + tam;
  }

  const inicio = pos;
  const tamCentral = central.reduce((s, b) => s + b.length, 0);
  const e = new DataView(new ArrayBuffer(22));

  e.setUint32(0, 0x06054b50, true);
  e.setUint16(8, arquivos.length, true);
  e.setUint16(10, arquivos.length, true);
  e.setUint32(12, tamCentral, true);
  e.setUint32(16, inicio, true);
  return new Blob([...partes, ...central, new Uint8Array(e.buffer)], { type: "application/zip" });
}

function _carregarImg(src) {
  return new Promise((res, rej) => {
    const i = new Image();

    i.onload = () => res(i);
    i.onerror = () => rej(new Error("imagem"));
    i.src = src;
  });
}

async function svgParaJPEG(svg, largura, altura, logo, escala = 2) {
  const c = document.createElement("canvas");

  c.width = Math.round(largura * escala);
  c.height = Math.round(altura * escala);

  const g = c.getContext("2d");

  g.fillStyle = "#fff";
  g.fillRect(0, 0, c.width, c.height);

  const img = await _carregarImg("data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg));

  g.drawImage(img, 0, 0, c.width, c.height);

  if (logo && logo.src) {
    try {
      const L = await _carregarImg(logo.src);
      const k = Math.min(logo.w / L.width, logo.h / L.height);
      const w = L.width * k, h = L.height * k;

      g.drawImage(L, (logo.x + (logo.w - w) / 2) * escala, (logo.y + (logo.h - h) / 2) * escala, w * escala, h * escala);
    } catch (e) { }
  }

  const blob = await new Promise(r => c.toBlob(r, "image/jpeg", 0.9));

  return {
    jpeg: new Uint8Array(await blob.arrayBuffer()),
    w: c.width,
    h: c.height
  };
}

const esperar = (ms = 0) => new Promise(r => setTimeout(r, ms));
