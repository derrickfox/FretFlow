import type { PreloadedSong } from '../data/preloadedSongs';
import styles from './PreloadedSongsSelect.module.css';

type PreloadedSongsSelectProps = {
  songs: PreloadedSong[];
  selectedId: string | null;
  loading: boolean;
  onSelect: (id: string) => void;
};

export function PreloadedSongsSelect({
  songs,
  selectedId,
  loading,
  onSelect,
}: PreloadedSongsSelectProps) {
  return (
    <div className={styles.wrap}>
      <label className={styles.label} htmlFor="preloaded-songs">
        Sample songs
      </label>
      <select
        id="preloaded-songs"
        className={styles.select}
        value={selectedId ?? ''}
        disabled={loading}
        onChange={(e) => {
          const id = e.target.value;
          if (id) onSelect(id);
        }}
      >
        <option value="">Choose a song…</option>
        {songs.map((song) => (
          <option key={song.id} value={song.id}>
            {song.label}
          </option>
        ))}
      </select>
    </div>
  );
}
