import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, Loader2, Clock } from 'lucide-react';
import styles from './ResultsTable.module.css';

const EVENTO_COLORS = {
  'R-4010': styles.tagR4010,
  'R-4020': styles.tagR4020,
  'R-2010': styles.tagR2010,
  'R-1000': styles.tagR1000,
};

const ACAO_LABELS = {
  ENVIAR: { label: 'Enviar', cls: styles.acaoEnviar },
  ALTERAR: { label: 'Alterar', cls: styles.acaoAlterar },
  EXCLUIR: { label: 'Excluir', cls: styles.acaoExcluir },
};

function StatusCell({ status, nrRecibo, codigo, mensagem }) {
  if (status === 'pending') return <span className={styles.statusPending}><Clock size={13} /> Aguardando</span>;
  if (status === 'processing') return <span className={styles.statusProcessing}><Loader2 size={13} className={styles.spin} /> Processando…</span>;
  if (status === 'success') return (
    <div className={styles.statusSuccess}>
      <CheckCircle2 size={13} />
      <span className={styles.recibo}>{nrRecibo}</span>
    </div>
  );
  if (status === 'error') return (
    <div className={styles.statusError}>
      <XCircle size={13} />
      <span title={mensagem}>[{codigo}] {mensagem}</span>
    </div>
  );
  return null;
}

export default function ResultsTable({ rows, results, currentIndex, totalRows }) {
  const sucessos = Object.values(results).filter(r => r?.sucesso).length;
  const erros = Object.values(results).filter(r => r && !r.sucesso).length;
  const done = currentIndex >= totalRows;

  return (
    <div className={styles.container}>
      {/* Stats bar */}
      <div className={styles.statsBar}>
        <div className={styles.statItem}>
          <span className={styles.statNum}>{totalRows}</span>
          <span className={styles.statLabel}>Total</span>
        </div>
        <div className={`${styles.statItem} ${styles.statSuccess}`}>
          <span className={styles.statNum}>{sucessos}</span>
          <span className={styles.statLabel}>Sucesso</span>
        </div>
        <div className={`${styles.statItem} ${styles.statError}`}>
          <span className={styles.statNum}>{erros}</span>
          <span className={styles.statLabel}>Erro</span>
        </div>
        <div className={`${styles.statItem} ${styles.statPending}`}>
          <span className={styles.statNum}>{totalRows - sucessos - erros}</span>
          <span className={styles.statLabel}>Pendente</span>
        </div>

        {!done && (
          <div className={styles.progressWrap}>
            <div className={styles.progressBar}>
              <motion.div
                className={styles.progressFill}
                initial={{ width: 0 }}
                animate={{ width: `${(currentIndex / totalRows) * 100}%` }}
                transition={{ ease: 'linear' }}
              />
            </div>
            <span className={styles.progressLabel}>Linha {currentIndex} de {totalRows}</span>
          </div>
        )}

        {done && (
          <span className={`${styles.doneBadge} ${erros > 0 ? styles.doneWithErrors : styles.doneOk}`}>
            {erros > 0 ? `Concluído com ${erros} erro(s)` : 'Concluído com sucesso'}
          </span>
        )}
      </div>

      {/* Table */}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>#</th>
              <th>Evento</th>
              <th>Período</th>
              <th>Beneficiário</th>
              <th>Vl. Rendimento</th>
              <th>Ação</th>
              <th>Resultado</th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence>
              {rows.map((row, idx) => {
                const result = results[row.id];
                let status = 'pending';
                if (idx < currentIndex - 1) status = result?.sucesso ? 'success' : 'error';
                else if (idx === currentIndex - 1) status = result ? (result.sucesso ? 'success' : 'error') : 'processing';

                return (
                  <motion.tr
                    key={row.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    className={`${styles.row} ${status === 'error' ? styles.rowError : ''} ${status === 'success' ? styles.rowSuccess : ''}`}
                  >
                    <td className={styles.cellNum}>{row.id}</td>
                    <td>
                      <span className={`${styles.eventoTag} ${EVENTO_COLORS[row.evento] ?? ''}`}>
                        {row.evento}
                      </span>
                    </td>
                    <td className={styles.cellMono}>{row.perApur}</td>
                    <td className={styles.cellMono}>
                      {row.cpfBenef || <span className={styles.dim}>—</span>}
                    </td>
                    <td className={styles.cellMono}>
                      {row.vlrRend > 0
                        ? row.vlrRend.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                        : <span className={styles.dim}>—</span>
                      }
                    </td>
                    <td>
                      <span className={`${styles.acaoTag} ${ACAO_LABELS[row.acao]?.cls ?? ''}`}>
                        {ACAO_LABELS[row.acao]?.label ?? row.acao}
                      </span>
                    </td>
                    <td className={styles.cellResult}>
                      <StatusCell status={status} {...result} />
                    </td>
                  </motion.tr>
                );
              })}
            </AnimatePresence>
          </tbody>
        </table>
      </div>
    </div>
  );
}
