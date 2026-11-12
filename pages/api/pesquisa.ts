import { criarEndpoint, ErroHttp, validar } from '../../lib/endpoint';
import { rotaAutenticada } from '../../lib/rotas';
import { UsuarioModel } from '../../models/UsuarioModel';
import { escaparRegex } from '../../schemas/comum';
import { CAMPOS_PUBLICOS, pesquisaQuerySchema } from '../../schemas/usuario';

const LIMITE_DE_RESULTADOS = 50;

const endpointPesquisa = criarEndpoint({
  GET: async (req, res) => {
    const { id, filtro } = validar(pesquisaQuerySchema, req.query);

    if (id) {
      const usuario = await UsuarioModel.findById(id).select(CAMPOS_PUBLICOS);
      if (!usuario) {
        throw new ErroHttp(400, 'Usuário não encontrado');
      }
      return res.status(200).json(usuario);
    }

    if (!filtro) {
      throw new ErroHttp(
        400,
        'Favor informar pelo menos 2 caracteres para a busca',
      );
    }
    const padrao = { $regex: escaparRegex(filtro), $options: 'i' };
    const usuarios = await UsuarioModel.find({
      $or: [{ nome: padrao }, { email: padrao }],
    })
      .select(CAMPOS_PUBLICOS)
      .limit(LIMITE_DE_RESULTADOS);
    return res.status(200).json(usuarios);
  },
});

export default rotaAutenticada(endpointPesquisa);
