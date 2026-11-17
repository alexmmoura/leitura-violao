import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { STANDARD_GUITAR } from '../core/instrument/instrument';
import { fixedPosition } from '../core/instrument/position';
import { generateMelody, type MelodyConfig } from '../core/melody/melody';
import { DEFAULT_SETTINGS } from '../data/settings';
import Fretboard from './Fretboard';
import GuidePage from './GuidePage';
import ReadingSession from './ReadingSession';

/**
 * Testes das TELAS: desenham o componente como HTML e conferem que o que importa
 * aparece. Servem de rede de segurança para mudanças visuais (não substituem olhar
 * a tela, mas avisam se algo que funcionava sumir).
 */
const g = STANDARD_GUITAR;
const html = (el: React.ReactElement) => renderToStaticMarkup(el);
const count = (s: string, sub: string) => s.split(sub).length - 1;

describe('braço do violão', () => {
  it('desenha 6 cordas numeradas e as casas', () => {
    const out = html(<Fretboard inst={g} settings={DEFAULT_SETTINGS} />);
    expect(count(out, 'class="fb-string"')).toBe(6);
    expect(count(out, 'class="fb-nut"')).toBe(1);
    expect(out).toContain('aria-label="Braço do violão"');
  });

  it('bolinhas de resposta mostram o nome da nota (certa e marcada)', () => {
    const out = html(
      <Fretboard
        inst={g}
        settings={DEFAULT_SETTINGS}
        marks={[
          { loc: { string: 6, fret: 1 }, kind: 'wrong', label: 'Fá' },
          { loc: { string: 5, fret: 3 }, kind: 'valid', label: 'Dó' },
        ]}
      />,
    );
    expect(out).toContain('fb-mark is-wrong');
    expect(out).toContain('>Fá</text>');
    expect(out).toContain('fb-mark is-valid');
    expect(out).toContain('>Dó</text>');
    // nome de 2 letras ganha bolinha maior para caber
    expect(out).toContain('r="16"');
  });

  it('com clique ligado, cada corda × casa vira área clicável; sem clique, nenhuma', () => {
    const clicavel = html(<Fretboard inst={g} settings={DEFAULT_SETTINGS} onCellClick={() => {}} />);
    expect(count(clicavel, 'class="fb-cell"')).toBe(6 * (g.frets + 1));
    expect(clicavel).toContain('aria-label="corda 6 solta"');
    expect(html(<Fretboard inst={g} settings={DEFAULT_SETTINGS} />)).not.toContain('fb-cell');
  });

  it('não voltaram os balões flutuantes', () => {
    const out = html(<Fretboard inst={g} settings={DEFAULT_SETTINGS} marks={[{ loc: { string: 1, fret: 0 }, kind: 'correct', label: 'Mi' }]} />);
    expect(out).not.toContain('fb-tip');
  });
});

describe('guia "Como estudar"', () => {
  it('tem a seção das posições aberta e o demonstrativo de posições', () => {
    const out = html(<GuidePage go={() => {}} settings={DEFAULT_SETTINGS} />);
    expect(out).toContain('Posições no braço');
    expect(out).toContain('id="g-posicoes"');
    expect(out).toContain('pos-strip');
  });
});

describe('sessão de leitura de frase', () => {
  const cfg: MelodyConfig = { fifths: 0, region: fixedPosition(5), strings: [1, 2, 3, 4, 5, 6], measures: 4, beats: 4, rhythmLevel: 0, maxLeap: 2, chromatic: false };
  const melody = generateMelody(cfg, g, 12345);

  it('mostra a pauta, o braço clicável e o botão 👀 do nome da nota', () => {
    const out = html(<ReadingSession melody={melody} mode="static" bpm={60} inst={g} settings={DEFAULT_SETTINGS} module="D" onDone={() => {}} />);
    expect(out).toContain('melody-host');
    expect(out).toContain('class="fb-cell"');
    expect(out).toContain('👀 Mostrar nome da nota');
    expect(out).toContain('V posição');
  });
});
