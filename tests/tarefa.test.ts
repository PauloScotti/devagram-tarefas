import { describe, expect, it } from 'vitest';
import {
  atualizarTarefaSchema,
  cadastroTarefaSchema,
  listarTarefasQuerySchema,
  montarFiltroDeTarefas,
} from '../schemas/tarefa';

const DONO = '65a1f0c2e4b0a1b2c3d4e5f6';
const filtro = (query: Record<string, unknown>) =>
  montarFiltroDeTarefas(DONO, listarTarefasQuerySchema.parse(query));

describe('schemas de tarefa', () => {
  it('converte as datas e ignora o dono enviado no corpo', () => {
    const tarefa = cadastroTarefaSchema.parse({
      nome: 'Estudar zod',
      dataPrevistaConclusao: '2026-03-10',
      idUsuario: 'outro-usuario',
    });

    expect(tarefa.dataPrevistaConclusao).toBeInstanceOf(Date);
    expect(tarefa).not.toHaveProperty('idUsuario');
  });

  it('rejeita nome curto e data inválida', () => {
    expect(
      cadastroTarefaSchema.safeParse({
        nome: 'abc',
        dataPrevistaConclusao: '2026-03-10',
      }).success,
    ).toBe(false);
    expect(
      cadastroTarefaSchema.safeParse({
        nome: 'Estudar zod',
        dataPrevistaConclusao: 'amanhã',
      }).success,
    ).toBe(false);
  });

  it('edição: data de conclusão nula ou vazia reabre; ausente não mexe', () => {
    expect(atualizarTarefaSchema.parse({ dataConclusao: null })).toEqual({
      dataConclusao: null,
    });
    expect(atualizarTarefaSchema.parse({ dataConclusao: '' })).toEqual({
      dataConclusao: null,
    });
    expect(atualizarTarefaSchema.parse({ nome: 'Novo nome' })).toEqual({
      nome: 'Novo nome',
    });
  });
});

describe('montarFiltroDeTarefas', () => {
  it('sem filtros, lista só as tarefas do dono', () => {
    expect(filtro({})).toEqual({ idUsuario: DONO });
  });

  it('o dono vem do token: idUsuario na query é ignorado', () => {
    expect(filtro({ idUsuario: 'outro' })).toEqual({ idUsuario: DONO });
  });

  it('aplica início e fim do período juntos (antes só o fim valia)', () => {
    const resultado = filtro({
      periodoDe: '2026-03-01',
      periodoAte: '2026-03-31',
    });

    expect(resultado.dataPrevistaConclusao).toEqual({
      $gte: new Date('2026-03-01'),
      $lte: new Date('2026-03-31'),
    });
  });

  it('status 1 traz pendentes; outro valor traz concluídas', () => {
    expect(filtro({ status: '1' })).toEqual({
      idUsuario: DONO,
      dataConclusao: null,
    });
    expect(filtro({ status: '2' })).toEqual({
      idUsuario: DONO,
      dataConclusao: { $ne: null },
    });
  });

  it('combina status e período', () => {
    expect(filtro({ status: '1', periodoDe: '2026-03-01' })).toEqual({
      idUsuario: DONO,
      dataConclusao: null,
      dataPrevistaConclusao: { $gte: new Date('2026-03-01') },
    });
  });

  it('rejeita período que não é data e operador no lugar de valor', () => {
    expect(
      listarTarefasQuerySchema.safeParse({ periodoDe: 'ontem' }).success,
    ).toBe(false);
    expect(
      listarTarefasQuerySchema.safeParse({ status: { $ne: 1 } }).success,
    ).toBe(false);
  });
});
