import type { NextApiRequest, NextApiResponse } from "next";
import { conectarMongoDB } from "../../middlewares/conectarMongoDB";
import { politicaCors } from "../../middlewares/politicaCors";
import { validarTokeJWT } from "../../middlewares/validarTokenJWT";
import { UsuarioModel } from "../../models/UsuarioModel";
import type { RespostaPadraoMsg } from '../../types/RespostaPadraoMsg';
import { SeguidorModel } from "../../models/SeguidorModel";

const endpointSeguir = async (req: NextApiRequest, res: NextApiResponse<RespostaPadraoMsg | any>) => {
    try {
        if (req.method === 'PUT') {

            const { userId, id } = req?.query;

            // usuario logado/autenticado = quem esta fazendo as acoes
            const usuarioLogado = await UsuarioModel.findById(userId);
            if (!usuarioLogado) {
                return res.status(400).json({ erro: 'Usuário logado não encontrado' });
            }

            // id do usuario e ser seguidor - query
            const usuarioASerSeguido = await UsuarioModel.findById(id);
            if (!usuarioASerSeguido) {
                return res.status(400).json({ erro: 'Usuário a ser seguido não encontrado' });
            }

            // buscar se EU LOGADO sigo ou nao esse usuario
            const euJaSigoEsseUsuario = await SeguidorModel
                .find({ usuarioId: usuarioLogado._id, usuarioSeguidoId: usuarioASerSeguido._id });
            if (euJaSigoEsseUsuario && euJaSigoEsseUsuario.length > 0) {
                // sinal que eu ja sigo esse usuario
                euJaSigoEsseUsuario.forEach(async (e: any) =>
                    await SeguidorModel.findByIdAndDelete({ _id: e._id }));

                usuarioLogado.seguindo--;
                await UsuarioModel.findByIdAndUpdate({ _id: usuarioLogado._id }, usuarioLogado);
                usuarioASerSeguido.seguidores--;
                await UsuarioModel.findByIdAndUpdate({ _id: usuarioASerSeguido._id }, usuarioASerSeguido);

                return res.status(200).json({ msg: 'Deixou de seguir o usuário com sucesso' });
            } else {
                // sinal q eu nao sigo esse usuario
                const seguidor = {
                    usuarioId: usuarioLogado._id,
                    usuarioSeguidoId: usuarioASerSeguido._id
                };
                await SeguidorModel.create(seguidor);

                // adicionar um seguindo no usuario logado
                usuarioLogado.seguindo++;
                await UsuarioModel.findByIdAndUpdate({ _id: usuarioLogado._id }, usuarioLogado);

                // adicionar um seguidor no usuario seguido
                usuarioASerSeguido.seguidores++;
                await UsuarioModel.findByIdAndUpdate({ _id: usuarioASerSeguido._id }, usuarioASerSeguido);

                return res.status(200).json({ msg: 'Usuário seguido com sucesso' });
            }
        }

        if (req.method == 'GET') {
            const { userId, seguidores, seguindo } = req?.query;

            const usuarioLogado = await UsuarioModel.findById(userId);
            if (!usuarioLogado) {
                return res.status(400).json({ erro: 'Usuário logado não encontrado' });
            }

            if (seguidores) {
                const seguidoresUsuarioLogado = await SeguidorModel.find({ usuarioId: usuarioLogado._id });

                var listaDeSeguidores = [];

                for (let i = 0; i < seguidoresUsuarioLogado.length; i++) {
                    listaDeSeguidores.push(await UsuarioModel.findById({ _id: seguidoresUsuarioLogado[i].usuarioSeguidoId }));
                }

                return res.status(200).json(listaDeSeguidores);
            }

            if (seguindo) {
                const seguidoresUsuarioLogado = await SeguidorModel.find({ usuarioSeguidoId: usuarioLogado._id });

                var listaSeguindo = [];

                for (let i = 0; i < seguidoresUsuarioLogado.length; i++) {
                    listaSeguindo.push(await UsuarioModel.findById({ _id: seguidoresUsuarioLogado[i].usuarioId }));
                }

                return res.status(200).json(listaSeguindo);
            }
        }

        return res.status(405).json({ erro: 'Método informado não é válido' });
    } catch (e) {
        console.log(e);
        return res.status(500).json({ erro: 'Não foi possível seguir/deseguir o usuário informado' });
    }
}

export default politicaCors(validarTokeJWT(conectarMongoDB(endpointSeguir)));
