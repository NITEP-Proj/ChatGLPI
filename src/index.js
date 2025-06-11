/* eslint-disable prettier/prettier */
const wppconnect = require('@wppconnect-team/wppconnect');
const { default: axios } = require('axios');
const { title } = require('process');

const sessions = {}; // Controle das sessões ativas
const bloqueados = ['+559833015554@c.us']; // Números bloqueados
const url = 'http://localhost:8000/chamado'; // URL da API do backend

// Criação da sessão do WhatsApp
wppconnect
  .create({
    session: 'projeta',
    catchQR: (base64Qrimg, asciiQR) => {
      console.log('Escaneie o QR abaixo:');
      console.log(asciiQR);
    },
    statusFind: (statusSession, session) => {
      console.log('Sessão: ', session);
      console.log('Status: ', statusSession);
    },
  })
  .then((client) => start(client))
  .catch((error) => console.log(error));

// Início do ciclo do bot
function start(client) {
  client.onMessage(async (message) => {
    const number = message.from;
    const name = message.sender?.pushname || message.sender?.name;
    const msg = message.body.trim().toLowerCase();

    if (!number.endsWith('@c.us') || number === 'status@broadcast' || !msg) return;
    if (bloqueados.includes(number)) return;

    // Ativando sessão via palavra-chave
    if (!sessions[number]) {
      if (msg.includes('suporte')) {
        sessions[number] = { step: 'aguardandoOpcao' };
        await client.sendText(number, `👋 Olá ${name}, bem-vindo ao suporte Projeta.`);
        await client.sendText(
          number,
          `Escolha uma opção:\n1️⃣ Abrir chamado\n2️⃣ Consultar chamado\n3️⃣ Falar com atendente`
        );
        return;
      } else {
        return;
      }
    }

    const session = sessions[number];

    // Menu de opções
    if (session.step === 'aguardandoOpcao') {
      if (msg === '1') {
        await client.sendText(number, '📝 Por favor, descreva o problema.');
        session.step = 'esperando_descricao';
        return;
      } else if (msg === '2') {
        await client.sendText(number, '🔍 Informe o número do chamado para consulta.');
        session.step = 'consultando';
        return;
      } else if (msg === '3') {
        await client.sendText(number, '🤝 Encaminhando para um atendente...');
        delete sessions[number];
        return;
      } else {
        await client.sendText(number, 'Opção inválida. Digite 1, 2 ou 3.');
        return;
      }
    }

    // Aguardando a descrição do chamado
    if (session.step === 'esperando_descricao') {
      await axios
        .post(url, {
          phone: number.replace('@c.us', ''),
          message: msg,
        })
        .then(async (res) => {
          const ticketID = res.data?.chamado_id || 'Desconhecido';
          await client.sendText(number, `✅ Chamado criado com ID: ${ticketID}`);
          console.log('Resposta do backend:', res.data);

          session.step = 'fim';
          await client.sendText(number, 'Se precisar de mais alguma coisa, digite *suporte*.');
          delete sessions[number];
        })
        .catch(async (err) => {
          console.error('Erro ao criar chamado:', err);
          await client.sendText(number, '❌ Erro ao abrir chamado no sistema.');
          session.step = 'aguardandoOpcao';
        });

      return;
    }

    // Consultar chamado
    if (session.step === 'consultando') {
      await client.sendText(number, `📄 Status do chamado ${msg}: Em andamento.`);

      session.step = 'fim';
      await client.sendText(number, 'Se precisar de mais alguma coisa, digite *suporte*.');
      delete sessions[number];
      return;
    }
  });
}
