import { useState, useRef } from 'react';
import { FileSpreadsheet, KeyRound, Upload, X, CheckCircle2 } from 'lucide-react';
import styles from './UploadZone.module.css';

export default function UploadZone({ type, file, onFile }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const isExcel = type === 'excel';
  const accept = isExcel ? '.xlsx,.xls,.csv,.tsv' : '.pfx';
  const Icon = isExcel ? FileSpreadsheet : KeyRound;
  const label = isExcel ? 'Planilha Modelo' : 'Certificado Digital';
  const sublabel = isExcel ? 'Excel ou CSV · Arraste ou clique' : 'Certificado A1 (.pfx)';

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) onFile(f);
  }

  function handleChange(e) {
    const f = e.target.files[0];
    if (f) onFile(f);
  }

  function clearFile(e) {
    e.stopPropagation();
    onFile(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div
      className={`${styles.zone} ${dragging ? styles.dragging : ''} ${file ? styles.filled : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => !file && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        style={{ display: 'none' }}
      />

      {file ? (
        <div className={styles.fileInfo}>
          <CheckCircle2 size={20} className={styles.checkIcon} />
          <div className={styles.fileMeta}>
            <span className={styles.fileName}>{file.name}</span>
            <span className={styles.fileSize}>{(file.size / 1024).toFixed(0)} KB</span>
          </div>
          <button className={styles.clearBtn} onClick={clearFile} title="Remover arquivo">
            <X size={14} />
          </button>
        </div>
      ) : (
        <div className={styles.placeholder}>
          <div className={styles.iconWrap}>
            <Icon size={24} />
          </div>
          <div className={styles.texts}>
            <span className={styles.mainLabel}>{label}</span>
            <span className={styles.subLabel}>{sublabel} · Arraste ou clique</span>
          </div>
          <Upload size={16} className={styles.uploadIcon} />
        </div>
      )}
    </div>
  );
}
