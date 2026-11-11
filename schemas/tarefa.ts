import { z } from './zod';
import { idSchema } from './comum';

const nomeSchema = z
  .string({ error: 'Nome da tarefa é obrigatório' })
  .trim()
  .min(4, 'Nome da tarefa precisa de pelo menos 4 caracteres')
  .max(200, 'Nome da tarefa não é válido');

const data = (mensagem: string) =>
  z.coerce
    .date({ error: mensagem })
    .openapi({ type: 'string', format: 'date-time' });

const dataPrevistaSchema = data('Data prevista de conclusão não é válida');

// null (ou vazio) reabre a tarefa.
const dataConclusaoSchema = z
  .preprocess(
    (valor) => (valor === '' ? null : valor),
    data('Data de conclusão não é válida').nullable(),
  )
  .openapi({ type: ['string', 'null'], format: 'date-time' });

export const cadastroTarefaSchema = z
  .object({
    nome: nomeSchema,
    dataPrevistaConclusao: dataPrevistaSchema,
    dataConclusao: dataConclusaoSchema.optional(),
  })
  .openapi('CadastroTarefa');

export const atualizarTarefaSchema = z
  .object({
    nome: nomeSchema.optional(),
    dataPrevistaConclusao: dataPrevistaSchema.optional(),
    dataConclusao: dataConclusaoSchema.optional(),
  })
  .openapi('AtualizarTarefa');

export const STATUS_PENDENTE = 1;

export const listarTarefasQuerySchema = z.object({
  id: idSchema.optional(),
  periodoDe: data('Período não é válido').optional(),
  periodoAte: data('Período não é válido').optional(),
  status: z.coerce
    .number({ error: 'Status não é válido' })
    .int('Status não é válido')
    .optional()
    .openapi({
      type: 'integer',
      description: '1 = pendentes; qualquer outro valor = concluídas',
    }),
});

export const tarefaSchema = z
  .object({
    _id: z.string(),
    nome: z.string(),
    idUsuario: z.string(),
    dataPrevistaConclusao: z.string().openapi({ format: 'date-time' }),
    dataConclusao: z.string().nullable().openapi({ format: 'date-time' }),
  })
  .openapi('Tarefa');

type Filtros = z.infer<typeof listarTarefasQuerySchema>;

// Monta a consulta de listagem. O dono vem sempre do token, nunca da requisição.
export function montarFiltroDeTarefas(idUsuario: string, filtros: Filtros) {
  const { periodoDe, periodoAte, status } = filtros;
  return {
    idUsuario,
    ...((periodoDe || periodoAte) && {
      dataPrevistaConclusao: {
        ...(periodoDe && { $gte: periodoDe }),
        ...(periodoAte && { $lte: periodoAte }),
      },
    }),
    ...(status !== undefined && {
      dataConclusao: status === STATUS_PENDENTE ? null : { $ne: null },
    }),
  };
}
