import {
  criarEndpoint,
  ErroHttp,
  RequisicaoAutenticada,
  validar,
} from '../../lib/endpoint';
import { rotaAutenticada } from '../../lib/rotas';
import { TarefaModel } from '../../models/TarefaModel';
import { idQuerySchema } from '../../schemas/comum';
import {
  atualizarTarefaSchema,
  cadastroTarefaSchema,
  listarTarefasQuerySchema,
  montarFiltroDeTarefas,
} from '../../schemas/tarefa';

// Toda consulta leva o dono junto: a tarefa de outra pessoa responde como
// "não encontrada", sem revelar que existe.
const daTarefa = (req: RequisicaoAutenticada) => ({
  _id: validar(idQuerySchema, req.query).id,
  idUsuario: req.usuarioId,
});

const endpointTarefa = criarEndpoint<RequisicaoAutenticada>({
  GET: async (req, res) => {
    const filtros = validar(listarTarefasQuerySchema, req.query);

    if (filtros.id) {
      const tarefa = await TarefaModel.findOne(daTarefa(req));
      if (!tarefa) {
        throw new ErroHttp(400, 'Tarefa não encontrada');
      }
      return res.status(200).json(tarefa);
    }

    const tarefas = await TarefaModel.find(
      montarFiltroDeTarefas(req.usuarioId, filtros),
    );
    return res.status(200).json(tarefas);
  },

  POST: async (req, res) => {
    const tarefa = validar(cadastroTarefaSchema, req.body);

    await TarefaModel.create({
      ...tarefa,
      dataConclusao: tarefa.dataConclusao ?? null,
      idUsuario: req.usuarioId,
    });
    return res.status(200).json({ msg: 'Tarefa cadastrada com sucesso' });
  },

  PUT: async (req, res) => {
    const dados = validar(atualizarTarefaSchema, req.body);

    const tarefa = await TarefaModel.findOneAndUpdate(daTarefa(req), {
      $set: dados,
    });
    if (!tarefa) {
      throw new ErroHttp(400, 'Tarefa não encontrada');
    }
    return res.status(200).json({ msg: 'Tarefa alterada com sucesso' });
  },

  DELETE: async (req, res) => {
    const tarefa = await TarefaModel.findOneAndDelete(daTarefa(req));
    if (!tarefa) {
      throw new ErroHttp(400, 'Tarefa não encontrada');
    }
    return res.status(200).json({ msg: 'Tarefa deletada com sucesso' });
  },
});

export default rotaAutenticada(endpointTarefa);
