// AI_CHANGE:
// Tool: Cursor
// Model: Composer
// Timestamp: 2026-06-05T12:10:00-04:00
// Purpose: Capo offset, alternate tunings, and open-string labels for the fretboard.
// Reason: GP tab frets are relative to capo; Fleetwood Mac and other samples need correct neck layout.

/** alphaTab tuning[] order: index 0 = top tab line (high string). */
export const STANDARD_TUNING_TOP_DOWN = [64, 59, 55, 50, 45, 40] as const;

export function midiToShortName(midi: number): string {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(midi / 12) - 1;
  return `${names[((midi % 12) + 12) % 12]}${octave}`;
}

/** Open-string MIDI for alphaTab string index (1 = lowest). */
export function openStringMidi(
  tuningTopToBottom: number[],
  stringIndex: number,
): number | undefined {
  const idx = tuningTopToBottom.length - stringIndex;
  if (idx < 0 || idx >= tuningTopToBottom.length) return undefined;
  return tuningTopToBottom[idx];
}

export function isStandardTuning(tuningTopToBottom: number[]): boolean {
  if (tuningTopToBottom.length !== STANDARD_TUNING_TOP_DOWN.length) return false;
  return tuningTopToBottom.every(
    (midi, i) => midi === STANDARD_TUNING_TOP_DOWN[i],
  );
}

/** Human-readable open-string notes top → bottom (e.g. for tuning badges). */
export function formatTuningDetail(
  tuningTopToBottom: number[],
  stringCount: number,
): string {
  return neckStringLabels(tuningTopToBottom, stringCount).join(' · ');
}

/** Labels top → bottom for the neck (matches STANDARD_TUNING reversed). */
export function neckStringLabels(tuningTopToBottom: number[], stringCount: number): string[] {
  const labels: string[] = [];
  for (let row = 0; row < stringCount; row++) {
    const midi = tuningTopToBottom[row];
    labels.push(midi != null ? midiToShortName(midi) : `S${stringCount - row}`);
  }
  return labels;
}

/** GP tab fret → absolute position on a 0–24 fretboard when capo acts as the nut. */
export function tabFretToNeckFret(tabFret: number, capo: number): number {
  return Math.max(0, Math.min(24, capo + tabFret));
}

export function pitchMidiForFrettedNote(
  stringIndex: number,
  tabFret: number,
  tuningTopToBottom: number[],
  capo: number,
): number | undefined {
  const open = openStringMidi(tuningTopToBottom, stringIndex);
  if (open === undefined) return undefined;
  return open + capo + tabFret;
}
