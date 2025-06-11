/* eslint-disable prettier/prettier */
const wppconnect = require('@wppconnect-team/wppconnect');
const { default: axios } = require('axios');
const { title } = require('process');

const sessions = {};
const bloqueados = ['+559833015554@c.us'];
const url = 'http://localhost:8000/chamado';

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

function start(client) {
  client.onMessage(async (message) => {
    const number = message.from;
    const name = message.sender?.pushname || message.sender?.name;
    const msg = message.body.trim();

    if (!number.endsWith('@c.us') || number === 'status@broadcast' || !msg) return;
    if (bloqueados.includes(number)) return;

    if (!sessions[number]) {
      if (msg.toLowerCase().includes('suporte')) {
        sessions[number] = { step: 'aguardandoOpcao' };
        await client.sendText(number, `👋 Olá ${name}, bem-vindo ao suporte Projeta.`);
        await client.sendText(
          number,
          `Escolha uma opção:
1️⃣ Abrir chamado
2️⃣ Consultar chamado
3️⃣ Falar com atendente`
        );
        return;
      } else {
        return;
      }
    }

    const session = sessions[number];

    // Escolha de opção
    if (session.step === 'aguardandoOpcao') {
      if (msg === '1') {
        await client.sendText(number, '📝 Por favor, descreva o problema.');
        session.step = 'aguardandoDescricao';
      } else if (msg === '2') {
        await client.sendText(number, '🔍 Informe o número do chamado para consulta.');
        session.step = 'consultando';
      } else if (msg === '3') {
        await client.sendText(number, '🤝 Encaminhando para um atendente...');
        delete sessions[number];
      } else {
        await client.sendText(number, 'Opção inválida. Digite 1, 2 ou 3.');
      }
    }

    // Enviando a descrição do problema (chamado real)
    else if (session.step === 'aguardandoDescricao') {
      try {
        const response = await axios.post(url, {
          phone: number.replace('@c.us', ''),
          message: msg,
        });

        const ticketID = response.data?.dados?.id || 'Desconhecido';
        await client.sendText(number, `✅ Chamado criado com ID: ${ticketID}`);
        console.log('Resposta do backend:', response.data);
      } catch (err) {
        console.error('Erro ao criar chamado:', err);
        await client.sendText(number, '❌ Erro ao abrir chamado no sistema.');
      }

      session.step = 'fim';
      await client.sendText(number, 'Se precisar de mais alguma coisa, digite *suporte*.');
      delete sessions[number];
    }

    // Consulta de chamado
    else if (session.step === 'consultando') {
      await client.sendText(number, `📄 Status do chamado ${msg}: Em andamento.`);
      session.step = 'fim';
      await client.sendText(number, 'Se precisar de mais alguma coisa, digite *suporte*.');
      delete sessions[number];
    }
  });
}
