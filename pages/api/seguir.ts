import {
  criarEndpoint,
  ErroHttp,
  RequisicaoAutenticada,
  validar,
} from '../../lib/endpoint';
import { rotaAutenticada } from '../../lib/rotas';
import { SeguidorModel } from '../../models/SeguidorModel';
import { UsuarioModel } from '../../models/UsuarioModel';
import { idQuerySchema } from '../../schemas/comum';
import { seguirQuerySchema } from '../../schemas/publicacao';
import { CAMPOS_PUBLICOS } from '../../schemas/usuario';

type Relacao = { usuarioId: string; usuarioSeguidoId: string };

// Lista os usuários de uma relação (seguidores ou seguindo) e, na mesma ordem,
// se o usuário logado segue cada um: [id] quando segue, [] quando não.
async function listarRelacao(usuarioLogadoId: string, ids: string[]) {
  const [usuarios, sigo] = await Promise.all([
    UsuarioModel.find({ _id: { $in: ids } }).select(CAMPOS_PUBLICOS),
    SeguidorModel.find({
      usuarioId: usuarioLogadoId,
      usuarioSeguidoId: { $in: ids },
    }).lean<Relacao[]>(),
  ]);
  const idsQueSigo = new Set(sigo.map((s) => s.usuarioSeguidoId));
  const listaDeSeguindoOuNao = usuarios.map((usuario) =>
    idsQueSigo.has(String(usuario._id)) ? [String(usuario._id)] : [],
  );
  return { usuarios, listaDeSeguindoOuNao };
}

const endpointSeguir = criarEndpoint<RequisicaoAutenticada>({
  // Alterna: segue se ainda não segue, deixa de seguir se já segue.
  PUT: async (req, res) => {
    const { id } = validar(idQuerySchema, req.query);

    if (id === req.usuarioId) {
      throw new ErroHttp(400, 'Você não pode seguir a si mesmo');
    }
    if (!(await UsuarioModel.exists({ _id: id }))) {
      throw new ErroHttp(400, 'Usuário a ser seguido não encontrado');
    }

    const relacao = { usuarioId: req.usuarioId, usuarioSeguidoId: id };
    const removidas = await SeguidorModel.deleteMany(relacao);
    const passo = removidas.deletedCount > 0 ? -1 : 1;
    if (passo === 1) {
      await SeguidorModel.create(relacao);
    }

    await UsuarioModel.updateOne(
      { _id: req.usuarioId },
      { $inc: { seguindo: passo } },
    );
    await UsuarioModel.updateOne({ _id: id }, { $inc: { seguidores: passo } });
    return res.status(200).json({
      msg:
        passo === 1
          ? 'Usuário seguido com sucesso'
          : 'Deixou de seguir o usuário com sucesso',
    });
  },

  GET: async (req, res) => {
    const { id, seguidores, seguindo } = validar(seguirQuerySchema, req.query);
    const alvo = id ?? req.usuarioId;

    if (seguindo) {
      const relacoes = await SeguidorModel.find({ usuarioId: alvo }).lean<
        Relacao[]
      >();
      const { usuarios, listaDeSeguindoOuNao } = await listarRelacao(
        req.usuarioId,
        relacoes.map((r) => r.usuarioSeguidoId),
      );
      return res
        .status(200)
        .json({ listaSeguindo: usuarios, listaDeSeguindoOuNao });
    }

    if (seguidores) {
      const relacoes = await SeguidorModel.find({
        usuarioSeguidoId: alvo,
      }).lean<Relacao[]>();
      const { usuarios, listaDeSeguindoOuNao } = await listarRelacao(
        req.usuarioId,
        relacoes.map((r) => r.usuarioId),
      );
      return res
        .status(200)
        .json({ listaDeSeguidores: usuarios, listaDeSeguindoOuNao });
    }

    if (!id) {
      throw new ErroHttp(400, 'Informe id, seguidores ou seguindo');
    }
    // Só o id: diz se o usuário logado segue esse usuário ([id] ou []).
    const sigo = await SeguidorModel.exists({
      usuarioId: req.usuarioId,
      usuarioSeguidoId: id,
    });
    return res.status(200).json(sigo ? [id] : []);
  },
});

export default rotaAutenticada(endpointSeguir);
