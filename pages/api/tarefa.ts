import type { NextApiRequest, NextApiResponse } from "next";
import { conectarMongoDB } from "../../middlewares/conectarMongoDB";
import { politicaCors } from "../../middlewares/politicaCors";
import { validarTokeJWT } from "../../middlewares/validarTokenJWT";
import { TarefaModel } from "../../models/TarefaModel";
import { TarefaRequisicao } from "../../types/TarefaRequisicao";
import { UsuarioModel } from "../../models/UsuarioModel";
import type { RespostaPadraoMsg } from '../../types/RespostaPadraoMsg';
import nc from 'next-connect';

const handler = nc()
    .post(async (req: NextApiRequest, res: NextApiResponse<RespostaPadraoMsg>) => {

        try {
            const { userId } = req.query;
            const usuarioLogado = await UsuarioModel.findById(userId);
            if (!usuarioLogado) {
                return res.status(400).json({ erro: 'Usuário nao encontrado' });
            }

            if (!req.body) {
                return res.status(400).json({ erro: 'Favor enviar os dados para cadastro da tarefa' });
            } else {
                if (!req.body.nome || !req.body.nome.trim()) {
                    return res.status(400).json({ erro: 'Nome da tarefa é obrigatório' });
                } else if (req.body.nome.length < 4) {
                    return res.status(400).json({ erro: 'Nome da tarefa precisa de pelo menos 4 caracteres' });
                }

                if (!req.body.dataPrevistaConclusao || !req.body.dataPrevistaConclusao.trim()) {
                    return res.status(400).json({ erro: 'Data prevista de conclusão é obrigatória' });
                }
            }

            const dataPrevistaConclusao = new Date(req.body.dataPrevistaConclusao);
            // faz o if ternário para determinar a dataConclusao
            const dataConclusao = req.body.dataConclusao // verifica se a data de conclusão foi informada
                ? new Date(req.body.dataConclusao) // caso positivo, converte para data do js
                : null; // caso negativo retorna null

            const tarefa = {
                idUsuario: usuarioLogado._id,
                nome: req.body.nome,
                dataPrevistaConclusao,
                dataConclusao
            }

            await TarefaModel.create(tarefa);
            return res.status(200).json({ msg: 'Tarefa cadastrada com sucesso' });

        } catch (e) {
            console.log(e);
            return res.status(500).json({ erro: 'Ocorreu cadastrar tarefa' });
        }
    })

    .put(async (req: NextApiRequest, res: NextApiResponse<RespostaPadraoMsg | any>) => {
        try {
            const { userId } = req.query;
            const usuarioLogado = await UsuarioModel.findById(userId);
            if (!usuarioLogado) {
                return res.status(400).json({ erro: 'Usuário nao encontrado' });
            }

            if (!req?.query?.id) {
                return res.status(400).json({ erro: 'ID da tarefa é obrigatório' });
            }

            const tarefaEncontrada = await TarefaModel.findById(req?.query?.id);

            if (!tarefaEncontrada) {
                return res.status(400).json({ erro: 'Tarefa não encontrada' });
            }

            const tarefa = req.body as TarefaRequisicao;

            if (tarefa.nome) {
                if (tarefa.nome.length < 4) {
                    return res.status(400).json({ erro: 'Nome da tarefa precisa de pelo menos 4 caracteres' });
                }
            }

            if (tarefa.dataPrevistaConclusao) {
                if (!tarefa.dataPrevistaConclusao || !tarefa.dataPrevistaConclusao.trim()) {
                    return res.status(400).json({ erro: 'Data prevista de conclusão é obrigatória' });
                }
            }

            var dataPrevistaConclusao = new Date(tarefa.dataPrevistaConclusao);

            if (tarefa.dataConclusao) {
                if (!tarefa.dataConclusao || !tarefa.dataConclusao.trim()) {
                    return res.status(400).json({ erro: 'Data de conclusão é obrigatória' });
                }
            }

            var dataConclusao = tarefa.dataConclusao
                ? new Date(tarefa.dataConclusao)
                : null;

            const tarefaEditada = {
                nome: tarefa.nome,
                dataPrevistaConclusao,
                dataConclusao
            }

            await TarefaModel.findByIdAndUpdate({ _id: req?.query?.id }, tarefaEditada);
            return res.status(200).json({ msg: 'Tarefa alterada com sucesos' });

        } catch (e) {
            console.log(e);
            return res.status(400).json({ erro: 'Nao foi possivel atualizar a tarefa:' + e });
        }
    })
    .get(async (req: NextApiRequest, res: NextApiResponse<RespostaPadraoMsg | any>) => {
        try {
            const { userId } = req.query;
            const usuarioLogado = await UsuarioModel.findById(userId);
            if (!usuarioLogado) {
                return res.status(400).json({ erro: 'Usuário nao encontrado' });
            }

            if (req?.query?.id) {
                const tarefaBD = await TarefaModel.findById(req?.query?.id);
                return res.status(200).json(tarefaBD);
            }

            // const tarefa = req.query as TarefaRequisicao;
            const { periodoDe, periodoAte, status } = req.query;

            var query = {}

            query = {
                idUsuario: userId
            }

            if (periodoDe) {
                query = {
                    idUsuario: userId,
                    dataPrevistaConclusao: { $gte: periodoDe }
                }
            }

            if (periodoAte) {
                query = {
                    idUsuario: userId,
                    dataPrevistaConclusao: { $lte: periodoAte }
                }
            }

            if (periodoDe && periodoAte) {
                query = {
                    idUsuario: userId,
                    dataPrevistaConclusao: { $gte: periodoDe } && { $lte: periodoAte }
                }
            }

            if (status) {
                const statusInt = Number(status);
                statusInt === 1 ?
                    query = {
                        idUsuario: userId,
                        dataConclusao: null
                    }
                    :
                    // diz para o filtro pegar todas as tarefas com dataConclusão != null
                    query = {
                        idUsuario: userId,
                        dataConclusao: { $ne: null }
                    }
            }

            if (status && periodoDe) {
                const statusInt = Number(status);
                statusInt === 1 ?
                    query = {
                        idUsuario: userId,
                        dataConclusao: null,
                        dataPrevistaConclusao: { $gte: periodoDe }
                    }
                    :
                    // diz para o filtro pegar todas as tarefas com dataConclusão != null
                    query = {
                        idUsuario: userId,
                        dataConclusao: { $ne: null },
                        dataPrevistaConclusao: { $gte: periodoDe }
                    }
            }

            if (status && periodoAte) {
                const statusInt = Number(status);
                statusInt === 1 ?
                    query = {
                        idUsuario: userId,
                        dataConclusao: null,
                        dataPrevistaConclusao: { $lte: periodoAte }
                    }
                    :
                    // diz para o filtro pegar todas as tarefas com dataConclusão != null
                    query = {
                        idUsuario: userId,
                        dataConclusao: { $ne: null },
                        dataPrevistaConclusao: { $lte: periodoAte }
                    }
            }

            if (status && periodoDe && periodoAte) {
                const statusInt = Number(status);
                statusInt === 1 ?
                    query = {
                        idUsuario: userId,
                        dataConclusao: null,
                        dataPrevistaConclusao: { $gte: periodoDe } && { $lte: periodoAte }
                    }
                    :
                    // diz para o filtro pegar todas as tarefas com dataConclusão != null
                    query = {
                        idUsuario: userId,
                        dataConclusao: { $ne: null },
                        dataPrevistaConclusao: { $gte: periodoDe } && { $lte: periodoAte }
                    }
            }

            const tarefaEncontrada = await TarefaModel.find(query);
            return res.status(200).json(tarefaEncontrada);
        } catch (e) {
            console.log(e);
        }

        return res.status(400).json({ erro: 'Nao foi possivel obter dados da tarefa' })
    });

export default politicaCors(validarTokeJWT(conectarMongoDB(handler)));