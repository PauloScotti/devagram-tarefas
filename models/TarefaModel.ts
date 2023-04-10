import mongoose, { Schema } from "mongoose";

const TarefaSchema = new Schema({
    nome: {
        type: String,
        required: true
    },
    idUsuario: {
        type: String,
        required: true
    },
    dataPrevistaConclusao: {
        type: Date,
        required: true
    },
    dataConclusao: {
        type: Date,
        required: false
    }
});

export const TarefaModel = (mongoose.models.tarefas || mongoose.model('tarefas', TarefaSchema));