const wppconnect = require('@wppconnect-team/wppconnect'); // Importando o modulo responsavel
const { default: axios } = require('axios');
const { title } = require('process');

const sessions = {}; // Controle das sessões ativas

const bloqueados = ['+559833015554@c.us']; // Número bloqueado (AT HAND)

const url = 'http://localhost:8000/chamado'; // URL

// Bloqueador de números
function bloqueador(number, msg) {
  if (!number.endsWith('@c.us') || number === 'status@broadcast' || !msg)
    return true;

  if (bloqueados.includes(number)) {
    console.log('Mensagem bloqueada de:', number);
    return true; // Bloqueia
  }
  return false; // Pode continuar
}

// Inicio das sessões
async function iniciarSessao(number, msg, name, client) {
  if (!sessions[number] && msg.toLowerCase().includes('suporte')) {
    sessions[number] = { step: 'aguardandoOpcao' };

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

    return true; // Sessão foi iniciada
  }

  return false; // Sessão não inicada ou já ativa
}

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
    const number = message.from;
    const name = message?.notifyName || message.sender?.name || 'Usuário';
    const msg = message.body.trim().toLowerCase();

    // Verificação de bloqueio
    if (bloqueador(number, msg)) return;

    // Início da sessão se ainda não existir
    const sessaoIniciada = await iniciarSessao(number, msg, name, client);
    if (sessaoIniciada) return;

    const session = sessions[number];
    if (!session) return;

    // Opções do menu
    if (session.step === 'aguardandoOpcao') {
      if (msg === '1') {
        await client.sendText(number, '📝 Por favor, descreva o problema.');
        session.step = 'abrindo_chamado';
        return;
      }

      if (msg === '2') {
        await client.sendText(
          number,
          '🔍 Informe o número do chamado para consulta.'
        );
        session.step = 'consultando';
        return;
      }

      if (msg === '3') {
        await client.sendText(number, '🤝 Encaminhando para um atendente...');
        delete sessions[number];
        return;
      }

      await client.sendText(number, '❌ Opção inválida. Digite 1, 2 ou 3.');
      return;
    }

    // Recebendo descrição do problema
    if (session.step === 'abrindo_chamado') {
      const payload = {
        name: name,
        phone: number.replace('@c.us', ''),
        message: msg, // agora msg é a descrição real
      };
      console.log(`🔄 Enviando POST para /chamado com os dados:`, payload);

      await axios
        .post(url, {
          phone: number.replace('@c.us', ''),
          message: msg, // agora msg é a descrição real
        })
        .then(async (res) => {
          const ticketID = res.data.chamado_id;
          await client.sendText(
            number,
            `✅ Chamado criado com ID: ${ticketID}`
          );
          await client.sendText(
            number,
            'Se precisar de mais alguma coisa, digite *suporte*.'
          );
          delete sessions[number];
        })
        .catch(async (err) => {
          console.error('Erro ao criar chamado: ', err);
          await client.sendText(
            number,
            '❌ Erro ao abrir chamado no sistema. Tente novamente.'
          );
          await client.sendText(
            number,
            '🔁 Por favor, digite *suporte* e tente abrir o chamado novamente.'
          );

          // Resetando completamente a sessão
          delete sessions[number];
        });

      return;
    }

    // Recebendo número do chamado para consulta
    if (session.step === 'consultando') {
      // Aqui você pode fazer uma consulta real à API
      await client.sendText(
        number,
        `📄 Status do chamado ${msg}: Em andamento.`
      );
      await client.sendText(
        number,
        'Se precisar de mais alguma coisa, digite *suporte*.'
      );

      delete sessions[number];
      return;
    }
  });
}
