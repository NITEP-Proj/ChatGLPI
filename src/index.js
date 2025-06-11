/* eslint-disable prettier/prettier */
const wppconnect = require('@wppconnect-team/wppconnect'); // Importando o modulo responsavel
const { default: axios } = require('axios');
const { title } = require('process');

const sessions = {}; // Controle das sessões ativas

const bloqueados = ['+559833015554@c.us']; // Número bloqueado (AT HAND)

const url = 'http://localhost:8000/chamado'; // URL

wppconnect
  .create({
    session: 'projeta', // Nome sessão

    catchQR: (base64Qrimg, asciiQR) => {
      console.log('Escaneie o QR abaixo: ');
      console.log(asciiQR);
    },

    statusFind: (statusSession, session) => {
      console.log('Sessão: ', session); // Nome sessão
      console.log('Status: ', statusSession); // Status sessão
    },
  })

  .then((client) => start(client))
  .catch((error) => console.log(error)); // Tratamento de error

function start(client) {
  // Inicio ciclo do BOT

  client.onMessage(async (message) => {
    const number = message.from; // Número
    const name = message.sender?.pushname || message.sender?.name; // Nome
    const msg = message.body.trim().toLowerCase(); // Mensagem

    if (!number.endsWith('@c.us') || number == 'status@broadcast' || !msg)
      return; // Eliminando grupos, status e mensagens vazias

    // Evitando números bloqueados
    if (bloqueados.includes(number)) {
      console.log('Mensagem bloqueadas');
      return;
    }

    // Checando sessões não ativas
    if (!sessions[number]) {
      // Ativando a sessão através da palavra suporte
      if (msg.toLowerCase().includes('suporte')) {
        sessions[number] = { step: 'aguardandoOpcao' }; // Leva até as opções

        await client.sendText(
          number,
          `👋 Olá! ${name}, Bem vindo ao suporte Projeta`
        ); // Saudação
        await client.sendText(
          number,
          `Escolha uma opção:
1️⃣ Abrir chamado
2️⃣ Consultar chamado
3️⃣ Falar com atendente`
        );

        return;
      } else {
        // Sessão não ativada pela palavra, não faz nada por enquanto
        return;
      }
    }

    const session = sessions[number]; // Sessão ativa do usuário identificando pelo número

    // Menu de opçoes
    if (session.step == 'aguardandoOpcao') {
      if (msg == '1') {
        await client.sendText(number, '📝 Por favor, descreva o problema.');
        session.step = 'abrindo_chamado';
      } else if (msg == '2') {
        await client.sendText(
          number,
          '🔍 Informe o número do chamado para consulta.'
        );
        session.step = 'consultando';
      } else if (msg == '3') {
        await client.sendText(number, '🤝 Encaminhando para um atendente...');
        delete sessions[number];
      } else {
        await client.sendText(number, 'Opção inválida. Digite 1, 2 ou 3.');
      }
    }

    if (session.step == 'abrindo_chamado') {
      await axios
        .post(url, {
          phone: number.replace('@c.us', ''),
          message: msg,
        })
        .then(async (res) => {
          const ticketID = res.data?.dados?.id || 'Desconhecido';
          await client.sendText(
            number,
            `✅ Chamado criado com ID: ${ticketID}`
          );

          console.log('Resposta do backend:', res.data);

          // Encerando a sessão
          session.step = 'fim';
          await client.sendText(
            number,
            'Se precisar de mais alguma coisa, digite *suporte*.'
          );
          delete sessions[number];
        })
        .catch(async (err) => {
          console.error('Erro ao criar chamado: ', err);
          await client.sendText(number, '❌ Erro ao abrir chamado no sistema.');

          session.step = 'aguardandoOpcao';
        });
    }
    // Consultando chamado
    else if (session.step == 'consultando') {
      // Consulta à API do GLPI pelo ID fornecido
      await client.sendText(
        number,
        `📄 Status do chamado ${msg}: Em andamento.`
      );

      // Encerrando a sessão
      session.step = 'fim';
      await client.sendText(
        number,
        'Se precisar de mais alguma coisa, digite *suporte*.'
      );
      delete sessions[number];
    }
  });
}
