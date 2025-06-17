/* eslint-disable prettier/prettier */
const wppconnect = require('@wppconnect-team/wppconnect');
const { default: axios } = require('axios');

const sessions = {};
const bloqueados = ['+559833015554@c.us'];
const API_URL = 'http://localhost:8000';

const atendimentoManual = new Set();

wppconnect
  .create({
    session: 'projetaBOTT',
    statusFind: (statusSession, session) => {
      console.log('Sessão: ', session);
      console.log('Status: ', statusSession);
    },
  })
  .then((client) => start(client))
  .catch((error) => console.log(error));

function start(client) {
  for (const numero in sessions) {
    delete sessions[numero];
  }

  client.onMessage(async (message) => {
    const number = message.from;
    const name = message.sender?.pushname || message.sender?.name;
    const msg = message.body.trim().toLowerCase();
    const msgLimpa = msg.replace(/[^a-zA-Z0-9]/g, '').trim();

    if (!msgLimpa || !number.endsWith('@c.us') || number === 'status@broadcast') return;
    if (bloqueados.includes(number)) return;

    const session = sessions[number];

    function mensagemMenu(name) {
      return `Olá, ${name}! 👋\n\n` +
        'Como posso ajudar você hoje? Escolha uma opção:\n' +
        '1️⃣ Abrir chamado\n' +
        '2️⃣ Consultar chamado\n' +
        '3️⃣ Falar com um atendente\n\n' +
        'Digite o número da opção desejada.';
    }

    // 🔒 Atendimento manual: só responde se digitar "suporte"
    if (atendimentoManual.has(number)) {
      if (msg.includes('suporte')) {
        atendimentoManual.delete(number);
        sessions[number] = { step: 'aguardandoOpcao' };
      }
      return;
    }

    // 👋 Início do atendimento
    if (!session) {
      await client.sendText(
        number,
        `💬 Olá! Seja bem-vindo ao atendimento automático da Projeta.
Digite *suporte* para começar.`
      );
      sessions[number] = { step: 'aguardandoSuporte' };
      return;
    }

    // 🔁 Aguardando o usuário digitar "suporte"
    if (session.step === 'aguardandoSuporte') {
      if (msg.includes('suporte')) {
        sessions[number] = { step: 'aguardandoOpcao' };
      } else {
        await client.sendText(number, `ℹ️ Para iniciar o atendimento, digite *suporte*.`);
      }
      return;
    }

    // ▶️ Menu principal
    if (session.step === 'aguardandoOpcao') {
      if (['1', '2', '3'].includes(msg)) {
        if (msg === '1') {
          session.step = 'aguardandoDescricao';
          await client.sendText(number, '📝 Por favor, descreva o problema.');
        } else if (msg === '2') {
          session.step = 'consultando';
          await client.sendText(number, '🔍 Informe o número do chamado para consulta.');
        } else if (msg === '3') {
          await client.sendText(number, '🤝 Encaminhando para um atendente...');
          await client.sendText(number, '⚠️ Atendimento automático encerrado. Digite *suporte* para reiniciar.');
          atendimentoManual.add(number);
          delete sessions[number];
        }
      } else {
        await client.sendText(number, '❌ Opção inválida. Digite *1*, *2* ou *3*.');
      }
      return;
    }

    // 📝 Abertura de chamado
    if (session.step === 'aguardandoDescricao') {
      try {
        await axios.post(`${API_URL}/chamado`, {
          phone: number.replace('@c.us', ''),
          name: name,
          message: msg,
        });

        const { data } = await axios.get(`${API_URL}/chamado/ultimo`);
        const ticketId = data?.dados?.id ?? 'Indisponível';

        await client.sendText(number, `✅ Chamado aberto com sucesso!\nNúmero do chamado: *#${ticketId}*`);
        await client.sendText(number, `👨‍💻 Atendimento automático encerrado.\n\nDigite ** para iniciar novamente.`);
        delete sessions[number];
      } catch (err) {
        console.error('Erro ao criar chamado:', err);
        await client.sendText(number, `⚠️ Erro ao abrir o chamado. Tente novamente mais tarde.`);
        delete sessions[number];
      }
      return;
    }

    // 🔍 Consulta de chamado
    if (session.step === 'consultando') {
      try {
        const res = await axios.get(`${API_URL}/chamado/${msg}`);
        const dados = res.data.dados;
        const mensagem = montarMensagemChamado(dados);

        await client.sendText(number, mensagem);
        await client.sendText(number, `📄 Consulta concluída.\n\nDigite *suporte* para nova ação.`);
        delete sessions[number];
      } catch (err) {
        console.error('Erro ao consultar chamado:', err?.response?.data || err);
        await client.sendText(number, `❌ Erro ao consultar o chamado. Verifique o número.`);
        await client.sendText(number, `⚠️ Digite *suporte* para tentar novamente.`);
        delete sessions[number];
      }
      return;
    }
  });
}

function interpretarStatus(status) {
  const map = {
    '1': 'Novo',
    '2': 'Em andamento',
    '3': 'Aguardando',
    '4': 'Aguardando aprovação',
    '5': 'Resolvido',
    '6': 'Fechado'
  };
  return map[status?.toString()] || `Desconhecido (${status})`;
}

function montarMensagemChamado(dados) {
  const titulo = dados.titulo || 'Sem título';
  const data = new Date(dados.data_abertura).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

  const status = interpretarStatus(dados.status_chamado);
  const descricao = dados.descricao?.trim() || 'Sem descrição';

  return `✅ *Detalhes do Chamado*\n\n` +
         `📄 *Título*: ${titulo}\n` +
         `📅 *Abertura*: ${data}\n` +
         `🏷️ *Status*: ${status}\n\n` +
         `📝 *Descrição*:\n${descricao}`;
}
