export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    credentials: 'same-origin',
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
  return data;
}
export function readLocal<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback;
  } catch {
    return fallback;
  }
}
export function saveLocal(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Private browsing may disable persistent storage. */
  }
}
export const time = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
export const today = () => new Date().toISOString().slice(0, 10);
export const dateLabel = (date: string) =>
  new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
let audioContext: AudioContext | undefined;
export function tone(kind: 'move' | 'win' | 'click' = 'click') {
  try {
    audioContext ??= new AudioContext();
    void audioContext.resume();
    const notes = kind === 'win' ? [523, 659, 784, 1047] : kind === 'move' ? [420] : [600];
    notes.forEach((frequency, i) => {
      const oscillator = audioContext!.createOscillator(),
        gain = audioContext!.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.07, audioContext!.currentTime + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, audioContext!.currentTime + i * 0.12 + 0.15);
      oscillator.connect(gain);
      gain.connect(audioContext!.destination);
      oscillator.start(audioContext!.currentTime + i * 0.12);
      oscillator.stop(audioContext!.currentTime + i * 0.12 + 0.16);
    });
  } catch {
    /* Audio is optional. */
  }
}
let musicNodes: OscillatorNode[] = [];
export function music(enabled: boolean) {
  musicNodes.forEach((node) => node.stop());
  musicNodes = [];
  if (!enabled) return;
  try {
    audioContext ??= new AudioContext();
    void audioContext.resume();
    [130.81, 196, 261.63].forEach((frequency) => {
      const node = audioContext!.createOscillator(),
        gain = audioContext!.createGain();
      node.type = 'sine';
      node.frequency.value = frequency;
      gain.gain.value = 0.012;
      node.connect(gain);
      gain.connect(audioContext!.destination);
      node.start();
      musicNodes.push(node);
    });
  } catch {
    /* Optional audio. */
  }
}
