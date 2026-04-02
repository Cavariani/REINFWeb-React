import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { FileSpreadsheet, ChevronDown, ChevronRight, Download, RefreshCw, AlertTriangle, Search, Copy, Check } from 'lucide-react'
import * as XLSX from 'xlsx'
import { listEmpresas, getInforme } from '../api/client'
import styles from './InformeRendimentos.module.css'

const ANO_ATUAL = new Date().getFullYear()
const ANOS = Array.from({ length: 5 }, (_, i) => ANO_ATUAL - i)

function fmtBRL(v) {
  return Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtDoc(doc) {
  if (!doc) return '—'
  const d = doc.replace(/\D/g, '')
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
  return doc
}

function fmtPer(per) {
  if (!per || per.length < 7) return per
  const [y, m] = per.split('-')
  return `${m}/${y}`
}

function tipoBadgeClass(tipo) {
  if (tipo === 'R-4010') return styles.badge4010
  if (tipo === 'R-4020') return styles.badge4020
  return styles.badge2010
}

function rowKey(row) {
  return `${row.tipo}|${row.cpfCnpjBenef}|${row.natRend}`
}

// ── Helpers para célula estilizada no Excel ────────────────────────────────────
function cell(v, t = 's', s = {}) { return { v, t, s } }

const S = {
  titulo: {
    font: { bold: true, sz: 14, color: { rgb: 'E97320' } },
    fill: { fgColor: { rgb: '0D1917' } },
    alignment: { horizontal: 'left', vertical: 'center' },
  },
  meta: {
    font: { bold: false, sz: 10, color: { rgb: 'A0ADB8' } },
    fill: { fgColor: { rgb: '0D1917' } },
    alignment: { horizontal: 'left', vertical: 'center' },
  },
  header: {
    font: { bold: true, sz: 10, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: '1D3D3A' } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: {
      bottom: { style: 'medium', color: { rgb: 'E97320' } },
      top:    { style: 'thin',   color: { rgb: '334544' } },
      left:   { style: 'thin',   color: { rgb: '334544' } },
      right:  { style: 'thin',   color: { rgb: '334544' } },
    },
  },
  headerNum: {
    font: { bold: true, sz: 10, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: '1D3D3A' } },
    alignment: { horizontal: 'right', vertical: 'center', wrapText: true },
    border: {
      bottom: { style: 'medium', color: { rgb: 'E97320' } },
      top:    { style: 'thin',   color: { rgb: '334544' } },
      left:   { style: 'thin',   color: { rgb: '334544' } },
      right:  { style: 'thin',   color: { rgb: '334544' } },
    },
  },
  sectionRow: {
    font: { bold: true, sz: 9, color: { rgb: '818CF8' } },
    fill: { fgColor: { rgb: '111F1E' } },
    alignment: { horizontal: 'left', vertical: 'center' },
    border: {
      top:    { style: 'medium', color: { rgb: '334544' } },
      bottom: { style: 'thin',   color: { rgb: '334544' } },
    },
  },
  rowEven: {
    fill: { fgColor: { rgb: '111F1E' } },
    alignment: { vertical: 'center' },
    border: {
      bottom: { style: 'thin', color: { rgb: '1D3D3A' } },
      left:   { style: 'thin', color: { rgb: '1D3D3A' } },
      right:  { style: 'thin', color: { rgb: '1D3D3A' } },
    },
  },
  rowOdd: {
    fill: { fgColor: { rgb: '0D1917' } },
    alignment: { vertical: 'center' },
    border: {
      bottom: { style: 'thin', color: { rgb: '1D3D3A' } },
      left:   { style: 'thin', color: { rgb: '1D3D3A' } },
      right:  { style: 'thin', color: { rgb: '1D3D3A' } },
    },
  },
  totalLabel: {
    font: { bold: true, sz: 10, color: { rgb: 'E97320' } },
    fill: { fgColor: { rgb: '1D3D3A' } },
    alignment: { horizontal: 'left', vertical: 'center' },
    border: { top: { style: 'medium', color: { rgb: 'E97320' } } },
  },
  totalVal: {
    font: { bold: true, sz: 10, color: { rgb: 'F5F5F5' } },
    fill: { fgColor: { rgb: '1D3D3A' } },
    alignment: { horizontal: 'right', vertical: 'center' },
    border: { top: { style: 'medium', color: { rgb: 'E97320' } } },
  },
}

const FMT_BRL = '"R$" #,##0.00'

function numCell(v, isEven, isTotalRow = false) {
  const base = isTotalRow ? S.totalVal : (isEven ? S.rowEven : S.rowOdd)
  return { v: Number(v ?? 0), t: 'n', z: FMT_BRL, s: { ...base, alignment: { horizontal: 'right', vertical: 'center' } } }
}

// ── Exportação Excel estilizada ────────────────────────────────────────────────
function exportarExcel(rows, empresaNome, empresaCnpj, ano) {
  const wb = XLSX.utils.book_new()

  const irpfRows = rows.filter(r => r.tipo !== 'R-2010')
  const inssRows = rows.filter(r => r.tipo === 'R-2010')

  // ── Aba Resumo ──
  const wsData = []

  wsData.push([cell('INFORME DE RENDIMENTOS', 's', S.titulo), '', '', '', '', '', '', ''])
  wsData.push([cell(`Empresa: ${empresaNome}  |  CNPJ: ${fmtDoc(empresaCnpj)}`, 's', S.meta), '', '', '', '', '', '', ''])
  wsData.push([cell(`Ano-Calendário: ${ano}  |  Emitido em: ${new Date().toLocaleDateString('pt-BR')}`, 's', S.meta), '', '', '', '', '', '', ''])
  wsData.push(['', '', '', '', '', '', '', ''])

  const colHeader = [
    cell('#',                    's', S.header),
    cell('Evento',               's', S.header),
    cell('CPF / CNPJ',           's', S.header),
    cell('Nat.',                 's', S.header),
    cell('Natureza (Descrição)', 's', S.header),
    cell('Rend. Bruto',          's', S.headerNum),
    cell('IRRF',                 's', S.headerNum),
    cell('INSS',                 's', S.headerNum),
    cell('CSLL',                 's', S.headerNum),
  ]

  if (irpfRows.length > 0) {
    wsData.push([cell('RENDIMENTOS — IRRF (R-4010 / R-4020)', 's', S.sectionRow), '', '', '', '', '', '', '', ''])
    wsData.push(colHeader)
    irpfRows.forEach((r, idx) => {
      const isEven = idx % 2 === 0
      const rs = isEven ? S.rowEven : S.rowOdd
      wsData.push([
        { v: idx + 1, t: 'n', s: { ...rs, alignment: { horizontal: 'center' }, font: { color: { rgb: 'A0ADB8' }, sz: 9 } } },
        cell(r.tipo, 's', { ...rs, font: { bold: true, color: { rgb: r.tipo === 'R-4010' ? '60A5FA' : 'E97320' }, sz: 9 } }),
        cell(fmtDoc(r.cpfCnpjBenef), 's', { ...rs, font: { name: 'Courier New', sz: 10, color: { rgb: 'E2E8F0' } } }),
        cell(r.natRend, 's', { ...rs, font: { bold: true, color: { rgb: 'E97320' }, sz: 9 } }),
        cell(r.natRendDesc, 's', { ...rs, font: { sz: 10, color: { rgb: 'CBD5E1' } } }),
        numCell(r.vlrRend, isEven),
        numCell(r.vlrIrrf, isEven),
        numCell(0, isEven),
        numCell(r.vlrCsll, isEven),
      ])
    })
    wsData.push([
      cell('TOTAL IRRF', 's', S.totalLabel), '', '', '', '',
      numCell(irpfRows.reduce((s, r) => s + Number(r.vlrRend), 0), true, true),
      numCell(irpfRows.reduce((s, r) => s + Number(r.vlrIrrf), 0), true, true),
      numCell(0, true, true),
      numCell(irpfRows.reduce((s, r) => s + Number(r.vlrCsll), 0), true, true),
    ])
    wsData.push(['', '', '', '', '', '', '', '', ''])
  }

  if (inssRows.length > 0) {
    wsData.push([cell('RETENÇÃO PREVIDENCIÁRIA — INSS (R-2010)', 's', { ...S.sectionRow, font: { ...S.sectionRow.font, color: { rgb: '818CF8' } } }), '', '', '', '', '', '', '', ''])
    wsData.push([cell('Nota: este bloco corresponde ao Comprovante de Retenção Previdenciária, documento separado do Informe de Rendimentos para IRPF.', 's', S.meta), '', '', '', '', '', '', '', ''])
    wsData.push(colHeader)
    inssRows.forEach((r, idx) => {
      const isEven = idx % 2 === 0
      const rs = isEven ? S.rowEven : S.rowOdd
      wsData.push([
        { v: idx + 1, t: 'n', s: { ...rs, alignment: { horizontal: 'center' }, font: { color: { rgb: 'A0ADB8' }, sz: 9 } } },
        cell(r.tipo, 's', { ...rs, font: { bold: true, color: { rgb: '34D399' }, sz: 9 } }),
        cell(fmtDoc(r.cpfCnpjBenef), 's', { ...rs, font: { name: 'Courier New', sz: 10, color: { rgb: 'E2E8F0' } } }),
        cell(r.natRend, 's', { ...rs, font: { bold: true, color: { rgb: '818CF8' }, sz: 9 } }),
        cell(r.natRendDesc, 's', { ...rs, font: { sz: 10, color: { rgb: 'CBD5E1' } } }),
        numCell(r.vlrRend, isEven),
        numCell(0, isEven),
        numCell(r.vlrInss, isEven),
        numCell(0, isEven),
      ])
    })
    wsData.push([
      cell('TOTAL INSS', 's', { ...S.totalLabel, font: { ...S.totalLabel.font, color: { rgb: '818CF8' } } }), '', '', '', '',
      numCell(inssRows.reduce((s, r) => s + Number(r.vlrRend), 0), true, true),
      numCell(0, true, true),
      numCell(inssRows.reduce((s, r) => s + Number(r.vlrInss), 0), true, true),
      numCell(0, true, true),
    ])
  }

  const wsResumo = XLSX.utils.aoa_to_sheet(wsData)
  wsResumo['!cols'] = [
    { wch: 5 }, { wch: 8 }, { wch: 20 }, { wch: 8 }, { wch: 42 },
    { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
  ]
  wsResumo['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 8 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 8 } },
  ]
  XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo')

  // ── Aba Detalhado ──
  const detData = []
  detData.push([cell('INFORME DETALHADO — BREAKDOWN MENSAL', 's', S.titulo), '', '', '', '', '', '', '', ''])
  detData.push([cell(`Empresa: ${empresaNome}  |  CNPJ: ${fmtDoc(empresaCnpj)}  |  Ano: ${ano}`, 's', S.meta), '', '', '', '', '', '', '', ''])
  detData.push(['', '', '', '', '', '', '', '', ''])
  detData.push([
    cell('#',            's', S.header),
    cell('Evento',       's', S.header),
    cell('CPF / CNPJ',  's', S.header),
    cell('Nat.',         's', S.header),
    cell('Natureza',     's', S.header),
    cell('Período',      's', S.header),
    cell('Rend. Bruto', 's', S.headerNum),
    cell('IRRF',         's', S.headerNum),
    cell('INSS',         's', S.headerNum),
    cell('CSLL',         's', S.headerNum),
  ])

  let rowNum = 0
  for (const r of rows) {
    r.periodos.forEach((p, pi) => {
      const isEven = rowNum % 2 === 0
      const rs = isEven ? S.rowEven : S.rowOdd
      detData.push([
        pi === 0
          ? { v: ++rowNum, t: 'n', s: { ...rs, alignment: { horizontal: 'center' }, font: { color: { rgb: 'A0ADB8' }, sz: 9 } } }
          : { v: '', t: 's', s: rs },
        pi === 0
          ? cell(r.tipo, 's', { ...rs, font: { bold: true, color: { rgb: r.tipo === 'R-4010' ? '60A5FA' : r.tipo === 'R-4020' ? 'E97320' : '34D399' }, sz: 9 } })
          : cell('', 's', rs),
        pi === 0
          ? cell(fmtDoc(r.cpfCnpjBenef), 's', { ...rs, font: { name: 'Courier New', sz: 10 } })
          : cell('', 's', rs),
        pi === 0 ? cell(r.natRend, 's', { ...rs, font: { bold: true, color: { rgb: 'E97320' }, sz: 9 } }) : cell('', 's', rs),
        pi === 0 ? cell(r.natRendDesc, 's', { ...rs, font: { sz: 10, color: { rgb: 'CBD5E1' } } }) : cell('', 's', rs),
        cell(fmtPer(p.periodo), 's', { ...rs, font: { bold: true, sz: 10 }, alignment: { horizontal: 'center' } }),
        numCell(p.vlrRend, isEven),
        numCell(p.vlrIrrf, isEven),
        numCell(p.vlrInss, isEven),
        numCell(p.vlrCsll, isEven),
      ])
    })
  }

  const wsDetalhado = XLSX.utils.aoa_to_sheet(detData)
  wsDetalhado['!cols'] = [
    { wch: 5 }, { wch: 8 }, { wch: 20 }, { wch: 8 }, { wch: 36 },
    { wch: 9 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
  ]
  wsDetalhado['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 9 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 9 } },
  ]
  wsDetalhado['!freeze'] = { xSplit: 0, ySplit: 4 }
  XLSX.utils.book_append_sheet(wb, wsDetalhado, 'Detalhado')

  const slug = empresaNome.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 20)
  XLSX.writeFile(wb, `Informe_${slug}_${ano}.xlsx`, { cellStyles: true })
}

// ── Botão copiar CPF/CNPJ ─────────────────────────────────────────────────────
function CopyDocBtn({ doc }) {
  const [copied, setCopied] = useState(false)
  function handleCopy(e) {
    e.stopPropagation()
    navigator.clipboard.writeText(doc.replace(/\D/g, '')).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  return (
    <button className={styles.copyBtn} onClick={handleCopy} title="Copiar CPF/CNPJ">
      {copied ? <Check size={11} /> : <Copy size={11} />}
    </button>
  )
}

// ── Linha da tabela com checkbox e toggle ─────────────────────────────────────
function InformeRow({ row, num, checked, onToggle }) {
  const [open, setOpen] = useState(false)

  function handleRowClick(e) {
    // Não abre/fecha se o clique foi no checkbox
    if (e.target.type === 'checkbox') return
    setOpen(v => !v)
  }

  return (
    <>
      <tr
        className={`${styles.tr} ${checked ? styles.trSelected : ''}`}
        onClick={handleRowClick}
        style={{ cursor: 'pointer' }}
      >
        <td className={styles.tdCheck} onClick={e => e.stopPropagation()}>
          <input
            type="checkbox"
            className={styles.checkbox}
            checked={checked}
            onChange={() => onToggle(rowKey(row))}
          />
        </td>
        <td className={styles.tdNum}>{num}</td>
        <td>
          <span className={`${styles.badge} ${tipoBadgeClass(row.tipo)}`}>{row.tipo}</span>
        </td>
        <td className={styles.tdDoc}>
          {fmtDoc(row.cpfCnpjBenef)}
          <CopyDocBtn doc={row.cpfCnpjBenef} />
        </td>
        <td className={styles.tdNat}>
          <span className={styles.natCod}>{row.natRend}</span>
          <span className={styles.natDesc}>{row.natRendDesc}</span>
        </td>
        <td className={`${styles.tdVal} ${styles.valRend}`}>{fmtBRL(row.vlrRend)}</td>
        <td className={`${styles.tdVal} ${styles.valIrrf}`}>{row.vlrIrrf > 0 ? fmtBRL(row.vlrIrrf) : <span className={styles.zero}>—</span>}</td>
        <td className={`${styles.tdVal} ${styles.valInss}`}>{row.vlrInss > 0 ? fmtBRL(row.vlrInss) : <span className={styles.zero}>—</span>}</td>
        <td className={`${styles.tdVal} ${styles.valCsll}`}>{row.vlrCsll > 0 ? fmtBRL(row.vlrCsll) : <span className={styles.zero}>—</span>}</td>
        <td className={styles.tdToggle}>
          {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </td>
      </tr>
      {open && row.periodos.map(p => (
        <tr key={p.periodo} className={styles.trPeriodo}>
          <td></td>
          <td></td>
          <td></td>
          <td colSpan={2} className={styles.tdPer}>{fmtPer(p.periodo)}</td>
          <td className={`${styles.tdVal} ${styles.valRend}`}>{fmtBRL(p.vlrRend)}</td>
          <td className={`${styles.tdVal} ${styles.valIrrf}`}>{p.vlrIrrf > 0 ? fmtBRL(p.vlrIrrf) : <span className={styles.zero}>—</span>}</td>
          <td className={`${styles.tdVal} ${styles.valInss}`}>{p.vlrInss > 0 ? fmtBRL(p.vlrInss) : <span className={styles.zero}>—</span>}</td>
          <td className={`${styles.tdVal} ${styles.valCsll}`}>{p.vlrCsll > 0 ? fmtBRL(p.vlrCsll) : <span className={styles.zero}>—</span>}</td>
          <td></td>
        </tr>
      ))}
    </>
  )
}

// ── Barra de totais color-coded ───────────────────────────────────────────────
function TotaisBar({ totalRend, totalIrrf, totalInss, totalCsll }) {
  return (
    <div className={styles.totaisBar}>
      <div className={`${styles.totalChip} ${styles.chipRend}`}>
        <span className={styles.chipLabel}>Rend. Bruto</span>
        <span className={styles.chipValue}>{fmtBRL(totalRend)}</span>
      </div>
      <div className={`${styles.totalChip} ${styles.chipIrrf}`}>
        <span className={styles.chipLabel}>IRRF</span>
        <span className={styles.chipValue}>{fmtBRL(totalIrrf)}</span>
      </div>
      <div className={`${styles.totalChip} ${styles.chipInss}`}>
        <span className={styles.chipLabel}>INSS</span>
        <span className={styles.chipValue}>{fmtBRL(totalInss)}</span>
      </div>
      {totalCsll > 0 && (
        <div className={`${styles.totalChip} ${styles.chipCsll}`}>
          <span className={styles.chipLabel}>CSLL</span>
          <span className={styles.chipValue}>{fmtBRL(totalCsll)}</span>
        </div>
      )}
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function InformeRendimentos() {
  const [empresas, setEmpresas]     = useState([])
  const [empresaId, setEmpresaId]   = useState('')
  const [ano, setAno]               = useState(ANO_ATUAL)
  const [informe, setInforme]       = useState(null)
  const [loading, setLoading]       = useState(false)
  const [erro, setErro]             = useState('')
  const [query, setQuery]           = useState('')
  const [selecao, setSelecao]       = useState(new Set())

  useEffect(() => {
    listEmpresas()
      .then(data => {
        setEmpresas(data)
        if (data.length > 0) setEmpresaId(data[0].id)
      })
      .catch(() => {})
  }, [])

  async function handleGerar() {
    const empresa = empresas.find(e => String(e.id) === String(empresaId))
    if (!empresa) { setErro('Selecione uma empresa.'); return }
    setErro('')
    setInforme(null)
    setSelecao(new Set())
    setLoading(true)
    try {
      const data = await getInforme(empresa.cnpj, ano)
      setInforme(data)
    } catch (e) {
      setErro(e.message)
    } finally {
      setLoading(false)
    }
  }

  function toggleRow(key) {
    setSelecao(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function toggleAll(rows) {
    const keys = rows.map(rowKey)
    const allChecked = keys.every(k => selecao.has(k))
    setSelecao(prev => {
      const next = new Set(prev)
      if (allChecked) keys.forEach(k => next.delete(k))
      else keys.forEach(k => next.add(k))
      return next
    })
  }

  const empresaSelecionada = empresas.find(e => String(e.id) === String(empresaId))

  const informeFiltrado = informe
    ? informe.filter(r => !query || r.cpfCnpjBenef?.includes(query.replace(/\D/g, '')))
    : []

  const irpfRows = informeFiltrado.filter(r => r.tipo !== 'R-2010')
  const inssRows = informeFiltrado.filter(r => r.tipo === 'R-2010')

  const rowsParaExportar = selecao.size > 0
    ? informeFiltrado.filter(r => selecao.has(rowKey(r)))
    : informeFiltrado

  const allIrpfSelected = irpfRows.length > 0 && irpfRows.every(r => selecao.has(rowKey(r)))
  const someIrpfSelected = irpfRows.some(r => selecao.has(rowKey(r)))
  const allInssSelected = inssRows.length > 0 && inssRows.every(r => selecao.has(rowKey(r)))
  const someInssSelected = inssRows.some(r => selecao.has(rowKey(r)))

  const totalRend = informeFiltrado.reduce((s, r) => s + Number(r.vlrRend), 0)
  const totalIrrf = informeFiltrado.reduce((s, r) => s + Number(r.vlrIrrf), 0)
  const totalInss = informeFiltrado.reduce((s, r) => s + Number(r.vlrInss), 0)
  const totalCsll = informeFiltrado.reduce((s, r) => s + Number(r.vlrCsll), 0)

  const theadRow = (rows, allSelected, someSelected, onToggleAll) => (
    <tr>
      <th className={styles.thCheck}>
        <input
          type="checkbox"
          className={styles.checkbox}
          checked={allSelected}
          ref={el => { if (el) el.indeterminate = someSelected && !allSelected }}
          onChange={() => onToggleAll(rows)}
        />
      </th>
      <th className={styles.thNum}>#</th>
      <th style={{ width: 72 }}>Evento</th>
      <th>CPF / CNPJ</th>
      <th>Natureza</th>
      <th className={`${styles.thVal} ${styles.thRend}`}>Rend. Bruto</th>
      <th className={`${styles.thVal} ${styles.thIrrf}`}>IRRF</th>
      <th className={`${styles.thVal} ${styles.thInss}`}>INSS</th>
      <th className={`${styles.thVal} ${styles.thCsll}`}>CSLL</th>
      <th style={{ width: 24 }}></th>
    </tr>
  )

  return (
    <motion.div
      className={styles.page}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <FileSpreadsheet size={22} className={styles.headerIcon} />
          <div>
            <h1 className={styles.title}>Informe de Rendimentos</h1>
            <p className={styles.subtitle}>Geração de informe anual por empresa contribuinte</p>
          </div>
        </div>
        {informe && informe.length > 0 && (
          <button
            className={styles.btnExport}
            onClick={() => exportarExcel(rowsParaExportar, empresaSelecionada?.nome ?? '', empresaSelecionada?.cnpj ?? '', ano)}
          >
            <Download size={14} />
            {selecao.size > 0 ? `Exportar ${selecao.size} selecionado${selecao.size !== 1 ? 's' : ''}` : 'Exportar Excel'}
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className={styles.filterCard}>
        <div className={styles.filterRow}>
          <div className={styles.filterField}>
            <label className={styles.filterLabel}>Empresa (contribuinte)</label>
            <select
              className={styles.select}
              value={empresaId}
              onChange={e => setEmpresaId(e.target.value)}
            >
              {empresas.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.nome}</option>
              ))}
            </select>
          </div>
          <div className={styles.filterField} style={{ maxWidth: 140 }}>
            <label className={styles.filterLabel}>Ano-Calendário</label>
            <select
              className={styles.select}
              value={ano}
              onChange={e => setAno(Number(e.target.value))}
            >
              {ANOS.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
          <button
            className={styles.btnGerar}
            onClick={handleGerar}
            disabled={loading || !empresaId}
          >
            {loading ? <RefreshCw size={14} className={styles.spin} /> : <FileSpreadsheet size={14} />}
            {loading ? 'Gerando…' : 'Gerar Informe'}
          </button>
        </div>
      </div>

      {erro && (
        <div className={styles.erroMsg}>
          <AlertTriangle size={13} /> {erro}
        </div>
      )}

      {/* Resultado */}
      {informe !== null && (
        informe.length === 0 ? (
          <div className={styles.empty}>
            <FileSpreadsheet size={36} className={styles.emptyIcon} />
            <p>Nenhum dado encontrado para {empresaSelecionada?.nome} em {ano}.</p>
            <p className={styles.emptyHint}>Verifique se há lotes com status ACEITO para este período.</p>
          </div>
        ) : (
          <>
            {/* KPIs topo */}
            <div className={styles.kpiRow}>
              <div className={styles.kpiCard}>
                <span className={styles.kpiLabel}>Beneficiários</span>
                <span className={styles.kpiValue}>{informe.length}</span>
              </div>
              <div className={`${styles.kpiCard} ${styles.kpiRend}`}>
                <span className={styles.kpiLabel}>Rend. Bruto</span>
                <span className={styles.kpiValue}>{fmtBRL(totalRend)}</span>
              </div>
              <div className={`${styles.kpiCard} ${styles.kpiIrrf}`}>
                <span className={styles.kpiLabel}>IRRF</span>
                <span className={styles.kpiValue}>{fmtBRL(totalIrrf)}</span>
              </div>
              <div className={`${styles.kpiCard} ${styles.kpiInss}`}>
                <span className={styles.kpiLabel}>INSS</span>
                <span className={styles.kpiValue}>{fmtBRL(totalInss)}</span>
              </div>
              {totalCsll > 0 && (
                <div className={`${styles.kpiCard} ${styles.kpiCsll}`}>
                  <span className={styles.kpiLabel}>CSLL</span>
                  <span className={styles.kpiValue}>{fmtBRL(totalCsll)}</span>
                </div>
              )}
            </div>

            {/* Busca */}
            <div className={styles.searchWrap}>
              <Search size={13} className={styles.searchIcon} />
              <input
                className={styles.searchBar}
                placeholder="Filtrar por CPF ou CNPJ…"
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
              {selecao.size > 0 && (
                <button
                  className={styles.btnClearSel}
                  onClick={() => setSelecao(new Set())}
                >
                  Limpar seleção ({selecao.size})
                </button>
              )}
            </div>

            {/* Seção IRPF */}
            {irpfRows.length > 0 && (
              <div className={styles.tableWrap}>
                <div className={styles.sectionHeader}>
                  <span className={styles.sectionHeaderLabel}>Rendimentos — IRRF</span>
                  <span className={styles.sectionHeaderSub}>R-4010 (Pessoas Físicas) · R-4020 (Pessoas Jurídicas)</span>
                </div>
                <table className={styles.table}>
                  <thead>
                    {theadRow(irpfRows, allIrpfSelected, someIrpfSelected, toggleAll)}
                  </thead>
                  <tbody>
                    {irpfRows.map((row, i) => (
                      <InformeRow
                        key={rowKey(row)}
                        row={row}
                        num={i + 1}
                        checked={selecao.has(rowKey(row))}
                        onToggle={toggleRow}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Seção INSS */}
            {inssRows.length > 0 && (
              <div className={styles.tableWrap}>
                <div className={`${styles.sectionHeader} ${styles.sectionHeaderInss}`}>
                  <span className={styles.sectionHeaderLabel}>Retenção Previdenciária — INSS</span>
                  <span className={styles.sectionHeaderSub}>R-2010 (Serviços com retenção) · Comprovante separado do Informe de Rendimentos para IRPF</span>
                </div>
                <table className={styles.table}>
                  <thead>
                    {theadRow(inssRows, allInssSelected, someInssSelected, toggleAll)}
                  </thead>
                  <tbody>
                    {inssRows.map((row, i) => (
                      <InformeRow
                        key={rowKey(row)}
                        row={row}
                        num={i + 1}
                        checked={selecao.has(rowKey(row))}
                        onToggle={toggleRow}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Totais color-coded abaixo */}
            <TotaisBar
              totalRend={totalRend}
              totalIrrf={totalIrrf}
              totalInss={totalInss}
              totalCsll={totalCsll}
            />
          </>
        )
      )}
    </motion.div>
  )
}
