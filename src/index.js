/* eslint-disable prettier/prettier */
const wppconnect = require('@wppconnect-team/wppconnect');
const { default: axios } = require('axios');

const sessions = {};
const bloqueados = ['+559833015554@c.us'];
const API_URL = 'http://localhost:8000';

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

    // Início da sessão
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

    // Etapa 1: Seleção da opção
    if (session.step === 'aguardandoOpcao') {
      if (msg === '1') {
        session.step = 'aguardandoDescricao';
        await client.sendText(number, '📝 Por favor, descreva o problema.');
      } else if (msg === '2') {
        session.step = 'consultando';
        await client.sendText(number, '🔍 Informe o número do chamado para consulta.');
      } else if (msg === '3') {
        delete sessions[number];
        await client.sendText(number, '🤝 Encaminhando para um atendente...');
      } else {
        await client.sendText(number, '❌ Opção inválida. Digite 1, 2 ou 3.');
      }
      return;
    }

    // Etapa 2: Abertura do chamado
    if (session.step === 'aguardandoDescricao') {
      const descricao = msg;
      try {
        const response = await axios.post(`${API_URL}/chamado`, {
          phone: number.replace('@c.us', ''),
          message: descricao,
        });

        // 2. Busca o ID do ticket mais recente
        const { data } = await axios.get(`${API_URL}/chamado/ultimo`);
        const ticketId = data?.dados?.id ?? 'Indisponível';
        await client.sendText(
          number,
          `✅ Chamado aberto com sucesso!\nNúmero do chamado: *#${ticketId}*`
        );
        await client.sendText(
          number,
          'Se precisar de mais alguma coisa, digite *suporte*.'
        );
        delete sessions[number];
      } catch (err) {
        console.error('Erro ao criar chamado:', err);
        await client.sendText(
          number,
          '🔁 Estamos com uma instabilidade no momento. Por favor, tente abrir seu chamado novamente em alguns minutos.'
        );
        await client.sendText(
          number,
          'Se precisar de mais alguma coisa, digite *suporte*.'
        );
      }
      delete sessions[number];
      return;
    }

    // Etapa 3: Consulta do chamado
    if (session.step === 'consultando') {
      const idChamado = msg;
      try {
        const res = await axios.get(`${API_URL}/${idChamado}`);
        const dados = res.data.dados;

        await client.sendText(
          number,
          `📄 *Status do chamado #${idChamado}:*\n\n` +
          `📌 *Título:* ${dados.titulo}\n` +
          `📝 *Descrição:* ${dados.descricao}\n` +
          `📅 *Aberto em:* ${dados.data_abertura}\n` +
          `📊 *Status:* ${interpretarStatus(dados.status_chamado)}`
        );
      } catch (err) {
        console.error('Erro ao consultar chamado:', err?.response?.data || err);
        await client.sendText(number, '❌ Erro ao consultar o chamado. Verifique o número e tente novamente.');
      }

      await client.sendText(number, 'Se precisar de mais alguma coisa, digite *suporte*.');
      delete sessions[number];
      return;
    }
  });
}

function interpretarStatus(status) {
  const map = {
    1: 'Novo',
    2: 'Em andamento',
    3: 'Aguardando',
    4: 'Aguardando aprovação',
    5: 'Resolvido',
    6: 'Fechado'
  };
  return map[status] || `Desconhecido (${status})`;
}
