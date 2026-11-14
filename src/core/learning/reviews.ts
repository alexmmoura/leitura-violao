import { KIND_INFO, type ModuleKey } from './kinds';
import type { ItemState, LearningModel } from './model';

/**
 * Revisões vencidas por módulo — especificação §10.6 ("revisões automáticas de
 * conteúdos anteriores, mesmo quando o estudante avança para módulos novos").
 * As notas são revisadas pelo agendador de "Meu treinamento"; os demais módulos
 * recebem a fila de itens vencidos e a percorrem no próprio exercício.
 */
export function dueByModule(model: LearningModel, now: number, limitPerModule = 15): Map<ModuleKey, ItemState[]> {
  const out = new Map<ModuleKey, { it: ItemState; r: number }[]>();
  for (const it of model.items.values()) {
    if (!model.isDue(it, now)) continue;
    const mod = KIND_INFO[it.kind].module;
    const list = out.get(mod) ?? [];
    list.push({ it, r: model.retrievability(it, now) ?? 0 });
    out.set(mod, list);
  }
  const result = new Map<ModuleKey, ItemState[]>();
  for (const [mod, list] of out) {
    result.set(
      mod,
      list
        .sort((a, b) => a.r - b.r)
        .slice(0, limitPerModule)
        .map((x) => x.it),
    );
  }
  return result;
}
