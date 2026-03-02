/**
 * Teste unitare — funcția timeAgo() din Layout.tsx
 * Extragem logica pură pentru testare (fără DOM).
 * Rulează prin Vitest (CI) sau prin backend Jest (local macOS arm64).
 */

// Funcția extrasă din Layout.tsx — identică cu originalul
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'acum';
  if (m < 60) return `acum ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `acum ${h}h`;
  return `acum ${Math.floor(h / 24)}z`;
}

describe('timeAgo()', () => {
  let fakeNow: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let dateSpy: any;

  beforeEach(() => {
    fakeNow = new Date('2024-06-15T12:00:00Z').getTime();
    dateSpy = vi.spyOn(Date, 'now').mockReturnValue(fakeNow);
  });

  afterEach(() => {
    dateSpy.mockRestore();
  });

  it('returnează "acum" pentru o dată cu mai puțin de 1 minut în urmă', () => {
    const date = new Date(fakeNow - 30 * 1000).toISOString();
    expect(timeAgo(date)).toBe('acum');
  });

  it('returnează "acum" pentru o dată exact la 59 secunde în urmă', () => {
    const date = new Date(fakeNow - 59 * 1000).toISOString();
    expect(timeAgo(date)).toBe('acum');
  });

  it('returnează "acum 1 min" pentru 1 minut în urmă', () => {
    const date = new Date(fakeNow - 60 * 1000).toISOString();
    expect(timeAgo(date)).toBe('acum 1 min');
  });

  it('returnează "acum 30 min" pentru 30 minute în urmă', () => {
    const date = new Date(fakeNow - 30 * 60 * 1000).toISOString();
    expect(timeAgo(date)).toBe('acum 30 min');
  });

  it('returnează "acum 59 min" pentru 59 minute în urmă', () => {
    const date = new Date(fakeNow - 59 * 60 * 1000).toISOString();
    expect(timeAgo(date)).toBe('acum 59 min');
  });

  it('returnează "acum 1h" pentru 1 oră în urmă', () => {
    const date = new Date(fakeNow - 60 * 60 * 1000).toISOString();
    expect(timeAgo(date)).toBe('acum 1h');
  });

  it('returnează "acum 5h" pentru 5 ore în urmă', () => {
    const date = new Date(fakeNow - 5 * 60 * 60 * 1000).toISOString();
    expect(timeAgo(date)).toBe('acum 5h');
  });

  it('returnează "acum 23h" pentru 23 ore în urmă', () => {
    const date = new Date(fakeNow - 23 * 60 * 60 * 1000).toISOString();
    expect(timeAgo(date)).toBe('acum 23h');
  });

  it('returnează "acum 1z" pentru 1 zi în urmă', () => {
    const date = new Date(fakeNow - 24 * 60 * 60 * 1000).toISOString();
    expect(timeAgo(date)).toBe('acum 1z');
  });

  it('returnează "acum 7z" pentru 7 zile în urmă', () => {
    const date = new Date(fakeNow - 7 * 24 * 60 * 60 * 1000).toISOString();
    expect(timeAgo(date)).toBe('acum 7z');
  });

  it('funcționează cu un string de dată ISO format', () => {
    const date = new Date(fakeNow - 2 * 60 * 1000).toISOString();
    expect(timeAgo(date)).toBe('acum 2 min');
  });
});
