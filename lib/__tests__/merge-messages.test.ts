import { describe, expect, it } from 'vitest';
import { mergeMessages } from '@/lib/merge-messages';

const m = (id: string, created_at: string, body = '') => ({ id, created_at, body });

describe('mergeMessages', () => {
  it('ajoute un nouveau message à la suite', () => {
    const out = mergeMessages([m('a', '2026-09-14T01:00:00Z')], [m('b', '2026-09-14T01:00:05Z')]);
    expect(out.map((x) => x.id)).toEqual(['a', 'b']);
  });

  it('ne duplique pas un message livré deux fois', () => {
    // Le cas réel : l'envoi le renvoie, puis le temps réel le renvoie aussi.
    const envoye = m('a', '2026-09-14T01:00:00Z');
    const out = mergeMessages([envoye], [envoye]);
    expect(out).toHaveLength(1);
  });

  it('remet dans l’ordre un message arrivé en retard', () => {
    const out = mergeMessages(
      [m('b', '2026-09-14T01:00:05Z')],
      [m('a', '2026-09-14T01:00:00Z')],
    );
    expect(out.map((x) => x.id)).toEqual(['a', 'b']);
  });

  it('laisse la relecture faire autorité sur l’affichage optimiste', () => {
    const optimiste = m('a', '2026-09-14T01:00:00Z', 'brouillon');
    const relu = m('a', '2026-09-14T01:00:00Z', 'texte définitif');
    expect(mergeMessages([optimiste], [relu])[0].body).toBe('texte définitif');
  });

  it('garde un ordre stable quand deux messages partagent la même date', () => {
    // Sept envois en sept secondes : plusieurs tombent à la même milliseconde.
    const meme = '2026-09-14T01:50:13Z';
    const a = mergeMessages([], [m('x2', meme), m('x1', meme)]);
    const b = mergeMessages([], [m('x1', meme), m('x2', meme)]);
    expect(a.map((x) => x.id)).toEqual(b.map((x) => x.id));
  });

  it('ne touche à rien quand il n’y a aucune nouveauté', () => {
    const liste = [m('a', '2026-09-14T01:00:00Z')];
    expect(mergeMessages(liste, [])).toBe(liste);
  });

  it('survit à une date illisible plutôt que de tout désordonner', () => {
    const out = mergeMessages([], [m('a', 'pas une date'), m('b', '2026-09-14T01:00:00Z')]);
    expect(out).toHaveLength(2);
  });
});
