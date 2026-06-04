import { useCallback, useRef, useState } from 'react';
import { GP_EXTENSIONS, isValidGpExtension } from '../utils/noteHelpers';
import styles from './FileUploader.module.css';

type FileUploaderProps = {
  onFileSelected: (file: File) => void;
  loading: boolean;
  error: string | null;
  /** Compact layout for the app header */
  compact?: boolean;
};

export function FileUploader({
  onFileSelected,
  loading,
  error,
  compact = false,
}: FileUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const [localError, setLocalError] = useState<string | null>(null);

  const validateAndEmit = useCallback(
    (file: File | undefined) => {
      if (!file) return;
      if (!isValidGpExtension(file.name)) {
        setLocalError(`Please choose a Guitar Pro file (${GP_EXTENSIONS.join(', ')})`);
        return;
      }
      setLocalError(null);
      onFileSelected(file);
    },
    [onFileSelected],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      validateAndEmit(e.dataTransfer.files[0]);
    },
    [validateAndEmit],
  );

  const extList = GP_EXTENSIONS.join(', ');

  const sectionClass = [styles.section, compact ? styles.sectionCompact : '']
    .filter(Boolean)
    .join(' ');
  const dropzoneClass = [
    styles.dropzone,
    compact ? styles.dropzoneCompact : '',
    dragOver ? styles.dragOver : '',
    loading ? styles.loading : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <section className={sectionClass}>
      <div
        className={dropzoneClass}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={GP_EXTENSIONS.join(',')}
          className={styles.hiddenInput}
          onChange={(e) => validateAndEmit(e.target.files?.[0])}
        />
        {loading ? (
          <p className={styles.primary}>Parsing Guitar Pro file…</p>
        ) : compact ? (
          <>
            <p className={styles.primary}>Drop a Guitar Pro file or click to browse</p>
            <p className={styles.formatsCompact}>Supported: {extList}</p>
          </>
        ) : (
          <>
            <p className={styles.primary}>Drop a Guitar Pro file here</p>
            <p className={styles.secondary}>or click to browse</p>
            <p className={styles.formats}>Supported: {extList}</p>
          </>
        )}
      </div>
      {localError || error ? (
        <p className={styles.error}>{localError ?? error}</p>
      ) : null}
    </section>
  );
}
