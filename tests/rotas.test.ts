import { createHash } from 'crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { gerarHash } from '../lib/senha';
import { assinarToken } from '../lib/token';
import { chamar } from './ajuda';

const { UsuarioModel, TarefaModel, SeguidorModel, PublicacaoModel } = vi.hoisted(
  () => {
    const novo = () => ({
      findOne: vi.fn(),
      findById: vi.fn(),
      find: vi.fn(),
      exists: vi.fn(),
      create: vi.fn(),
      updateOne: vi.fn(),
      deleteMany: vi.fn(),
      findByIdAndUpdate: vi.fn(),
      findOneAndUpdate: vi.fn(),
      findOneAndDelete: vi.fn(),
    });
    return {
      UsuarioModel: novo(),
      TarefaModel: novo(),
      SeguidorModel: novo(),
      PublicacaoModel: novo(),
    };
  },
);

vi.mock('../models/UsuarioModel', () => ({ UsuarioModel }));
vi.mock('../models/TarefaModel', () => ({ TarefaModel }));
vi.mock('../models/SeguidorModel', () => ({ SeguidorModel }));
vi.mock('../models/PublicacaoModel', () => ({ PublicacaoModel }));
vi.mock('../middlewares/conectaMongoDB', () => ({
  conectaMongoDB: (handler: unknown) => handler,
}));
vi.mock('../lib/upload', () => ({
  lerFormulario: vi.fn(),
  enviarImagem: vi.fn(),
}));

import cadastro from '../pages/api/cadastro';
import likes from '../pages/api/likes';
import login from '../pages/api/login';
import pesquisa from '../pages/api/pesquisa';
import publicacao from '../pages/api/publicacao';
import seguir from '../pages/api/seguir';
import tarefa from '../pages/api/tarefa';
import usuario from '../pages/api/usuario';

const EU = '65a1f0c2e4b0a1b2c3d4e5f6';
const OUTRO = '65a1f0c2e4b0a1b2c3d4e5f7';
const ID_TAREFA = '65a1f0c2e4b0a1b2c3d4e5f8';
const bearer = () => ({ authorization: `Bearer ${assinarToken(EU)}` });

// As consultas são encadeadas com .select(), .lean(), .sort() e .limit().
const consulta = (dados: unknown) => {
  const resultado: any = Promise.resolve(dados);
  for (const metodo of ['select', 'lean', 'sort', 'limit']) {
    resultado[metodo] = vi.fn(() => resultado);
  }
  return resultado;
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.MINHA_CHAVE_JWT = 'chave-de-teste';
  UsuarioModel.exists.mockResolvedValue(null);
});

describe('POST /api/login', () => {
  const conta = (senha: string) => ({
    _id: EU,
    nome: 'Ana',
    email: 'ana@exemplo.com',
    senha,
  });
  const entrar = (senha: unknown, email: unknown = 'ana@exemplo.com') =>
    chamar(login, { method: 'POST', body: { login: email, senha } });

  it('entra com senha em argon2 e devolve token, sem a senha', async () => {
    UsuarioModel.findOne.mockResolvedValue(conta(await gerarHash('segredo')));

    const resposta = await entrar('segredo');

    expect(resposta.status).toBe(200);
    expect(Object.keys(resposta.corpo).sort()).toEqual(['email', 'nome', 'token']);
    expect(UsuarioModel.updateOne).not.toHaveBeenCalled();
  });

  it('conta antiga em MD5 entra e tem a senha regravada em argon2', async () => {
    UsuarioModel.findOne.mockResolvedValue(
      conta(createHash('md5').update('1234').digest('hex')),
    );

    expect((await entrar('1234')).status).toBe(200);
    const [, alteracao] = UsuarioModel.updateOne.mock.calls[0];
    expect(alteracao.senha).toMatch(/^\$argon2id\$/);
  });

  it('senha errada e e-mail inexistente recebem a mesma resposta', async () => {
    UsuarioModel.findOne.mockResolvedValue(conta(await gerarHash('segredo')));
    const senhaErrada = await entrar('errada');

    UsuarioModel.findOne.mockResolvedValue(null);
    const semConta = await entrar('segredo');

    expect(senhaErrada.status).toBe(400);
    expect(senhaErrada.corpo).toEqual(semConta.corpo);
  });

  it('não consulta o banco quando o login não é texto', async () => {
    const resposta = await entrar({ $ne: null }, { $ne: null });

    expect(resposta.status).toBe(400);
    expect(UsuarioModel.findOne).not.toHaveBeenCalled();
  });
});

describe('POST /api/cadastro', () => {
  const corpo = {
    nome: 'Ana',
    email: 'ana@exemplo.com',
    senha: 'segredo-forte',
    seguidores: 9999,
  };

  it('grava a senha com hash e só os campos do cadastro', async () => {
    const resposta = await chamar(cadastro, { method: 'POST', body: corpo });

    expect(resposta.status).toBe(200);
    const [gravado] = UsuarioModel.create.mock.calls[0];
    expect(gravado.senha).toMatch(/^\$argon2id\$/);
    expect(gravado).not.toHaveProperty('seguidores');
  });

  it('rejeita e-mail já cadastrado', async () => {
    UsuarioModel.exists.mockResolvedValue({ _id: EU });

    const resposta = await chamar(cadastro, { method: 'POST', body: corpo });

    expect(resposta.status).toBe(400);
    expect(UsuarioModel.create).not.toHaveBeenCalled();
  });
});

describe('dados de usuário', () => {
  it('rotas autenticadas exigem token', async () => {
    for (const handler of [usuario, pesquisa, tarefa, seguir]) {
      expect((await chamar(handler, { method: 'GET' })).status).toBe(401);
    }
  });

  it('busca nunca seleciona a senha e escapa o texto da expressão regular', async () => {
    const lista = consulta([]);
    UsuarioModel.find.mockReturnValue(lista);

    const resposta = await chamar(pesquisa, {
      method: 'GET',
      query: { filtro: '.*' },
      headers: bearer(),
    });

    expect(resposta.status).toBe(200);
    expect(lista.select.mock.calls[0][0]).not.toContain('senha');
    const [{ $or }] = UsuarioModel.find.mock.calls[0];
    expect($or[0].nome.$regex).toBe('\\.\\*');
  });

  it('atualiza só o próprio cadastro', async () => {
    UsuarioModel.findByIdAndUpdate.mockResolvedValue({ _id: EU });

    await chamar(usuario, {
      method: 'PUT',
      body: { nome: 'Ana Maria', seguidores: 1000 },
      headers: bearer(),
    });

    expect(UsuarioModel.findByIdAndUpdate).toHaveBeenCalledWith(EU, {
      nome: 'Ana Maria',
    });
  });
});

describe('/api/tarefa', () => {
  it('consulta, edição e exclusão sempre filtram pelo dono do token', async () => {
    TarefaModel.findOne.mockResolvedValue({ _id: ID_TAREFA });
    TarefaModel.findOneAndUpdate.mockResolvedValue({ _id: ID_TAREFA });
    TarefaModel.findOneAndDelete.mockResolvedValue({ _id: ID_TAREFA });
    const requisicao = { query: { id: ID_TAREFA }, headers: bearer() };
    const doDono = { _id: ID_TAREFA, idUsuario: EU };

    await chamar(tarefa, { method: 'GET', ...requisicao });
    await chamar(tarefa, { method: 'PUT', body: { nome: 'Novo nome' }, ...requisicao });
    await chamar(tarefa, { method: 'DELETE', ...requisicao });

    expect(TarefaModel.findOne).toHaveBeenCalledWith(doDono);
    expect(TarefaModel.findOneAndUpdate.mock.calls[0][0]).toEqual(doDono);
    expect(TarefaModel.findOneAndDelete).toHaveBeenCalledWith(doDono);
  });

  it('tarefa de outra pessoa responde como não encontrada', async () => {
    TarefaModel.findOneAndDelete.mockResolvedValue(null);

    const resposta = await chamar(tarefa, {
      method: 'DELETE',
      query: { id: ID_TAREFA },
      headers: bearer(),
    });

    expect(resposta).toMatchObject({
      status: 400,
      corpo: { erro: 'Tarefa não encontrada' },
    });
  });

  it('cadastro grava o dono do token, não o enviado no corpo', async () => {
    await chamar(tarefa, {
      method: 'POST',
      body: {
        nome: 'Estudar zod',
        dataPrevistaConclusao: '2026-03-10',
        idUsuario: OUTRO,
      },
      headers: bearer(),
    });

    expect(TarefaModel.create.mock.calls[0][0]).toMatchObject({
      idUsuario: EU,
      dataConclusao: null,
    });
  });
});

describe('seguir, curtir e publicar', () => {
  it('não deixa seguir a si mesmo', async () => {
    const resposta = await chamar(seguir, {
      method: 'PUT',
      query: { id: EU },
      headers: bearer(),
    });

    expect(resposta.status).toBe(400);
    expect(SeguidorModel.create).not.toHaveBeenCalled();
  });

  it('segue quando não seguia e deixa de seguir quando já seguia', async () => {
    UsuarioModel.exists.mockResolvedValue({ _id: OUTRO });
    const requisicao = { method: 'PUT', query: { id: OUTRO }, headers: bearer() };

    SeguidorModel.deleteMany.mockResolvedValue({ deletedCount: 0 });
    const seguiu = await chamar(seguir, requisicao);
    expect(seguiu.corpo.msg).toBe('Usuário seguido com sucesso');
    expect(SeguidorModel.create).toHaveBeenCalledWith({
      usuarioId: EU,
      usuarioSeguidoId: OUTRO,
    });
    expect(UsuarioModel.updateOne).toHaveBeenCalledWith(
      { _id: OUTRO },
      { $inc: { seguidores: 1 } },
    );

    vi.clearAllMocks();
    UsuarioModel.exists.mockResolvedValue({ _id: OUTRO });
    SeguidorModel.deleteMany.mockResolvedValue({ deletedCount: 1 });
    const deixou = await chamar(seguir, requisicao);
    expect(deixou.corpo.msg).toBe('Deixou de seguir o usuário com sucesso');
    expect(SeguidorModel.create).not.toHaveBeenCalled();
    expect(UsuarioModel.updateOne).toHaveBeenCalledWith(
      { _id: EU },
      { $inc: { seguindo: -1 } },
    );
  });

  it('curtida alterna entre curtir e descurtir', async () => {
    const requisicao = { method: 'PUT', query: { id: ID_TAREFA }, headers: bearer() };

    PublicacaoModel.findById.mockReturnValue(consulta({ likes: [] }));
    expect((await chamar(likes, requisicao)).corpo.msg).toBe(
      'Publicação curtida com sucesso',
    );
    expect(PublicacaoModel.updateOne.mock.calls[0][1]).toHaveProperty(
      '$addToSet',
    );

    PublicacaoModel.findById.mockReturnValue(consulta({ likes: [EU] }));
    expect((await chamar(likes, requisicao)).corpo.msg).toBe(
      'Publicação descurtida com sucesso',
    );
    expect(PublicacaoModel.updateOne.mock.calls[1][1]).toHaveProperty('$pull');
  });

  it('publicação sem imagem é rejeitada', async () => {
    const resposta = await chamar(publicacao, {
      method: 'POST',
      body: { descricao: 'Minha foto' },
      headers: bearer(),
    });

    expect(resposta).toMatchObject({
      status: 400,
      corpo: { erro: 'Imagem é obrigatória' },
    });
    expect(PublicacaoModel.create).not.toHaveBeenCalled();
  });
});
