import { useState, useRef, useCallback, useEffect } from 'react'
import { Plus, Trash2, ClipboardPaste } from 'lucide-react'
import { normalizePeriod, normalizeDate, normalizeDecimal } from '../data/mockData'
import styles from './SpreadsheetEditor.module.css'

function emptyRow(columns) {
  return Object.fromEntries(columns.map(c => [c.key, '']))
}

function validateRow(row, columns) {
  const errors = {}
  for (const col of columns) {
    if (!col.validate) continue
    const err = col.validate(row[col.key] ?? '', row)
    if (err) errors[col.key] = err
  }
  return errors
}

function applyCPFMask(v) {
  const d = v.replace(/\D/g,'').slice(0,11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0,3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`
  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`
}

function applyCNPJMask(v) {
  const d = v.replace(/\D/g,'').slice(0,14)
  if (d.length <= 2)  return d
  if (d.length <= 5)  return `${d.slice(0,2)}.${d.slice(2)}`
  if (d.length <= 8)  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5)}`
  if (d.length <= 12) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8)}`
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`
}

function onlyDigits(v) {
  return v.replace(/\D/g,'')
}

// Normaliza valor colado/digitado de acordo com o tipo da coluna
function normalizeForCol(col, raw) {
  if (raw == null) return raw
  const v = String(raw).trim()
  switch (col.type) {
    case 'period': return normalizePeriod(v) ?? v
    case 'date':   return normalizeDate(v)   ?? v
    case 'number': return normalizeDecimal(v)
    case 'cnpj':   return applyCNPJMask(v)
    case 'cpf':    return applyCPFMask(v)
    case 'digits': return onlyDigits(v)
    case 'select':
      if (col.options?.includes('0') && col.options?.includes('1')) {
        if (v.startsWith('0')) return '0'
        if (v.startsWith('1')) return '1'
      }
      if (col.options?.includes('S') && col.options?.includes('N')) {
        const u = v.toUpperCase()
        if (u === 'S' || u.startsWith('S')) return 'S'
        if (u === 'N' || u.startsWith('N')) return 'N'
      }
      if (col.options?.includes('ENVIAR')) return v.toUpperCase()
      return v
    default: return v
  }
}

function CellInput({ col, value, onChange, onFocus, onBlur, isLocked }) {
  const base = { className: styles.cellInput, onFocus, spellCheck: false }

  if (col.type === 'select') {
    return (
      <select
        className={styles.cellSelect}
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
      >
        <option value="">—</option>
        {col.options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    )
  }

  if (col.computed) {
    return (
      <span className={styles.cellReadOnly} title="Calculado automaticamente pelo campo CPRB">
        {value || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.72em' }}>auto</span>}
      </span>
    )
  }

  if (isLocked) {
    return (
      <span className={styles.cellReadOnly} title={col.key === 'nrRecibo' ? 'Preenchido automaticamente' : 'Preenchido automaticamente pelo CNPJ do Passo 1'}>
        {value || <span style={{ color: 'var(--text-muted)' }}>—</span>}
      </span>
    )
  }

  if (col.type === 'number') {
    return (
      <input
        {...base}
        type="text"
        inputMode="decimal"
        value={value}
        onChange={e => onChange(e.target.value)}
        onBlur={e => {
          const norm = normalizeDecimal(e.target.value)
          if (norm !== e.target.value) onChange(norm)
          onBlur?.()
        }}
        placeholder={col.tip}
      />
    )
  }

  if (col.type === 'period') {
    return (
      <input
        {...base}
        value={value}
        onChange={e => onChange(e.target.value)}
        onBlur={e => {
          const norm = normalizePeriod(e.target.value)
          if (norm && norm !== e.target.value) onChange(norm)
          onBlur?.()
        }}
        placeholder="AAAA-MM ou Nov-25"
      />
    )
  }

  if (col.type === 'date') {
    return (
      <input
        {...base}
        value={value}
        onChange={e => onChange(e.target.value)}
        onBlur={e => {
          const norm = normalizeDate(e.target.value)
          if (norm && norm !== e.target.value) onChange(norm)
          onBlur?.()
        }}
        placeholder="AAAA-MM-DD"
      />
    )
  }

  if (col.type === 'cpf') {
    return (
      <input
        {...base}
        value={value}
        onChange={e => onChange(applyCPFMask(e.target.value))}
        onBlur={onBlur}
        placeholder="###.###.###-##"
        maxLength={14}
      />
    )
  }

  if (col.type === 'cnpj') {
    return (
      <input
        {...base}
        value={value}
        onChange={e => onChange(applyCNPJMask(e.target.value))}
        onBlur={onBlur}
        placeholder="##.###.###/####-##"
        maxLength={18}
      />
    )
  }

  if (col.type === 'digits') {
    return (
      <input
        {...base}
        value={value}
        onChange={e => onChange(onlyDigits(e.target.value))}
        onBlur={onBlur}
        placeholder={col.tip}
        inputMode="numeric"
      />
    )
  }

  // default: text (recibo, text)
  return (
    <input
      {...base}
      value={value}
      onChange={e => onChange(e.target.value)}
      onBlur={onBlur}
      placeholder={col.tip}
    />
  )
}

export default function SpreadsheetEditor({ columns, rows, onChange, rowDefaults = {}, perApurExpected = null, lockedCols = [] }) {
  const [focused, setFocused] = useState(null) // { row, col }
  const [headerTip, setHeaderTip] = useState(null) // { col, x, y }
  const tableRef = useRef(null)

  // Hide tooltip on scroll so it doesn't drift
  useEffect(() => {
    if (!headerTip) return
    const el = tableRef.current
    if (!el) return
    const hide = () => setHeaderTip(null)
    el.addEventListener('scroll', hide, { passive: true })
    return () => el.removeEventListener('scroll', hide)
  }, [headerTip])

  function showTip(e, col) {
    if (!col.desc) return
    const r = e.currentTarget.getBoundingClientRect()
    const x = Math.min(r.left, window.innerWidth - 275)
    setHeaderTip({ col, x, y: r.bottom })
  }

  const allErrors = rows.map(r => validateRow(r, columns))
  const totalErrors = allErrors.reduce((sum, e) => sum + Object.keys(e).length, 0)
  const validRows = allErrors.filter(e => Object.keys(e).length === 0).length

  function updateCell(rowIdx, key, value) {
    const col = columns.find(c => c.key === key)
    const extra = col?.autoFill ? col.autoFill(value) : {}
    const next = rows.map((r, i) => i === rowIdx ? { ...r, [key]: value, ...extra } : r)
    onChange(next)
  }

  function addRow() {
    onChange([...rows, { ...emptyRow(columns), ...rowDefaults }])
  }

  function deleteRow(idx) {
    onChange(rows.filter((_, i) => i !== idx))
  }

  // Ctrl+V paste from Excel (tab-delimited) com normalização por tipo de coluna
  const handlePaste = useCallback((e) => {
    const text = e.clipboardData?.getData('text/plain')
    if (!text) return
    e.preventDefault()

    const pastedRows = text.trim().split('\n').map(line =>
      line.split('\t').map(v => v.trim())
    )

    const startRow = focused?.row ?? 0
    const startCol = focused ? columns.findIndex(c => c.key === focused.col) : 0

    const next = [...rows]
    for (let pr = 0; pr < pastedRows.length; pr++) {
      const targetRow = startRow + pr
      if (targetRow >= next.length) {
        next.push(emptyRow(columns))
      }
      for (let pc = 0; pc < pastedRows[pr].length; pc++) {
        const colIdx = startCol + pc
        if (colIdx < columns.length) {
          const col = columns[colIdx]
          const rawVal = pastedRows[pr][pc]
          const normalized = normalizeForCol(col, rawVal)
          next[targetRow] = { ...next[targetRow], [col.key]: normalized }
        }
      }
    }
    // Aplica autoFill para colunas que derivam valor de outra (ex: aliq ← indCPRB)
    for (let r = startRow; r < startRow + pastedRows.length && r < next.length; r++) {
      for (const col of columns) {
        if (col.autoFill && next[r][col.key] !== undefined && next[r][col.key] !== '') {
          Object.assign(next[r], col.autoFill(next[r][col.key]))
        }
      }
    }
    onChange(next)
  }, [rows, focused, columns, onChange])

  return (
    <div className={styles.container} onPaste={handlePaste}>
      {/* Stats + actions */}
      <div className={styles.toolbar}>
        <div className={styles.stats}>
          <span className={styles.stat}>{rows.length} linhas</span>
          <span className={`${styles.stat} ${styles.statOk}`}>{validRows} válidas</span>
          {totalErrors > 0 && <span className={`${styles.stat} ${styles.statErr}`}>{totalErrors} erro(s)</span>}
        </div>
        <div className={styles.actions}>
          <span className={styles.pasteHint}><ClipboardPaste size={11} /> Ctrl+V para colar do Excel</span>
          <button className={styles.addBtn} onClick={addRow}>
            <Plus size={13} /> Adicionar linha
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className={styles.tableWrap} ref={tableRef}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.thNum}>#</th>
              {columns.map(col => (
                <th
                  key={col.key}
                  style={{ minWidth: col.width, cursor: col.desc ? 'help' : 'default' }}
                  onMouseEnter={col.desc ? e => showTip(e, col) : undefined}
                  onMouseLeave={col.desc ? () => setHeaderTip(null) : undefined}
                >
                  {col.label}
                  {col.validate && <span className={styles.reqMark}>*</span>}
                  {col.desc && <span className={styles.thInfoDot} aria-hidden>ⓘ</span>}
                </th>
              ))}
              <th className={styles.thDel} />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIdx) => {
              const errors  = allErrors[rowIdx]
              const hasError = Object.keys(errors).length > 0
              const isEmpty  = columns.every(c => !String(row[c.key] ?? '').trim())

              return (
                <tr
                  key={rowIdx}
                  className={`${styles.tr} ${hasError && !isEmpty ? styles.trError : isEmpty ? styles.trEmpty : styles.trOk}`}
                >
                  <td className={styles.tdNum}>{rowIdx + 1}</td>

                  {columns.map(col => {
                    const err  = errors[col.key]
                    const isFoc = focused?.row === rowIdx && focused?.col === col.key
                    const isLocked = !!(row._locked && col.key === 'nrRecibo') || lockedCols.includes(col.key)
                    const isPerApurWarn = col.key === 'perApur'
                      && perApurExpected
                      && row[col.key]
                      && (normalizePeriod(row[col.key]) ?? row[col.key]) !== perApurExpected

                    return (
                      <td
                        key={col.key}
                        className={`${styles.td} ${err ? styles.tdErr : ''} ${isFoc ? styles.tdFoc : ''} ${isLocked ? styles.tdLocked : ''} ${isPerApurWarn && !err ? styles.tdWarn : ''}`}
                        title={err ?? (isPerApurWarn ? `Período diferente do configurado (${perApurExpected})` : col.tip)}
                      >
                        <CellInput
                          col={col}
                          value={row[col.key] ?? ''}
                          onChange={v => updateCell(rowIdx, col.key, v)}
                          onFocus={() => setFocused({ row: rowIdx, col: col.key })}
                          onBlur={() => setFocused(null)}
                          isLocked={isLocked}
                        />
                        {err && <span className={styles.errTooltip}>{err}</span>}
                        {!err && isPerApurWarn && (
                          <span className={`${styles.errTooltip} ${styles.warnTooltip}`}>
                            Período ≠ {perApurExpected}
                          </span>
                        )}
                      </td>
                    )
                  })}

                  <td className={styles.tdDel}>
                    <button
                      className={styles.delBtn}
                      onClick={() => deleteRow(rowIdx)}
                      tabIndex={-1}
                      title="Remover linha"
                    >
                      <Trash2 size={12} />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {rows.length === 0 && (
          <div className={styles.empty}>
            <p>Nenhuma linha. Clique em "Adicionar linha" ou cole dados do Excel.</p>
          </div>
        )}
      </div>

      {/* Rich column header tooltip — position:fixed to escape scroll container */}
      {headerTip && headerTip.col.desc && (
        <div
          className={styles.colTip}
          style={{ top: headerTip.y + 6, left: headerTip.x }}
        >
          <span className={styles.colTipLabel}>{headerTip.col.fullLabel || headerTip.col.label}</span>
          <span className={styles.colTipBadge}>{headerTip.col.tip}</span>
          <p className={styles.colTipText}>{headerTip.col.desc.text}</p>
          <code className={styles.colTipExample}>Ex: {headerTip.col.desc.example}</code>
        </div>
      )}
    </div>
  )
}
