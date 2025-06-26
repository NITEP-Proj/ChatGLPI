/* eslint-disable prettier/prettier */
const wppconnect = require('@wppconnect-team/wppconnect');
const { default: axios } = require('axios');

const sessions = {};
const bloqueados = ['+559833015554@c.us'];
const API_URL = 'http://localhost:8000';
const atendimentoManual = new Set();

/* ---------- CONTROLE DE EXPIRAÇÃO ---------------- */
const SESSAO_TTL_MIN = 30; // expira após 30 min sem interação

function tocarSessao(numero) {
  if (sessions[numero]) sessions[numero].lastSeen = Date.now();
}

setInterval(() => {
  const agora = Date.now();
  for (const num in sessions) {
    if (agora - sessions[num].lastSeen > SESSAO_TTL_MIN * 60_000) {
      delete sessions[num];
      atendimentoManual.delete(num);
      console.log(`🕒 Sessão ${num} expirada por inatividade`);
    }
  }
}, 60_000);

/* -------------------------------------------------------
 * Mensagem de menu principal
 * ----------------------------------------------------- */
function mensagemMenu(name) {
  return (
    `Olá, ${name}! 👋\n\n` +
    'Como posso ajudar você hoje?\n' +
    '1️⃣ Abrir chamado\n' +
    '2️⃣ Consultar chamado\n' +
    '3️⃣ Falar com um atendente\n\n' +
    'Digite o número da opção desejada.'
  );
}

/* ---------- CRIAÇÃO DA SESSÃO WPPCONNECT -------- */
wppconnect
  .create({
    session: 'projeta',

    /* 1. MOSTRAR O QR ------------------------------------------ */
    catchQR: (base64, asciiQR, attempts, urlCode) => {
      console.clear();
      console.log(`\n📲  Escaneie o QR (tentativa ${attempts})\n`);
      qrcode.generate(urlCode, { small: true });      // QR em texto
      // se preferir abrir imagem:
      // require('fs').writeFileSync('qr.png', Buffer.from(base64.split(',')[1], 'base64'));
  },
    /* 2. DEIXAR O NAVEGADOR VISÍVEL ---------------------------- */
    headless: false, // abre a janela do Chrome
    autoClose: 0, // Não fecha automaticamente

    // Status da sessão
    statusFind: (statusSession, session) => {
      console.log('Sessão:', session);
      console.log('Status:', statusSession);
    },
  })
  .then(start)
  .catch(console.error);

/* =======================================================
 * Função principal
 * ===================================================== */
function start(client) {
  /* Limpa sessões residuais em cada restart do processo
  for (const numero in sessions) {
    delete sessions[numero];
  }*/

  client.onMessage(async (message) => {
    const number = message.from;

    /* atualiza lastSeen logo no início */
    tocarSessao(number);

    // Ignora grupos/broadcast e números bloqueados
    if (
      !number.endsWith('@c.us') ||
      number === 'status@broadcast' ||
      bloqueados.includes(number)
    ) {
      return;
    }

    // Canoniza mensagens
    const msgOriginal = message.body.trim();
    const msg = msgOriginal.toLowerCase();
    const name = message.sender?.pushname || message.sender?.name;

    const session = sessions[number];

    /* -----------------------------------------------
     * Fluxo: atendimento manual
     * --------------------------------------------- */

    if (atendimentoManual.has(number)) {
      if (msg.trim().toLowerCase() !== 'suporte') {
        sessions[number] = { step: 'aguardandoSuporte', lastSeen: Date.now() };
        return;
      }
    }

    /* -----------------------------------------------
     * Fluxo: início (sem sessão)
     * --------------------------------------------- */
    if (!session) {
      await client.sendText(
        number,
        `👋 Olá! Que bom ter você por aqui 😊
Sou o assistente virtual da *Projeta*.
Digite *suporte* para iniciar o atendimento.`
      );
      sessions[number] = { step: 'aguardandoSuporte', lastSeen: Date.now() };
      return;
    }

    /* -----------------------------------------------
     * Fluxo: aguardando "suporte"
     * --------------------------------------------- */
    if (session.step === 'aguardandoSuporte') {
      if (msg.trim().toLowerCase() === 'suporte') {

        if (atendimentoManual.has(number)) {
          atendimentoManual.delete(number);
        }

        await client.sendText(number, mensagemMenu(name));
        sessions[number] = { step: 'aguardandoOpcao', lastSeen: Date.now() };
      }
      return;
    }

    /* -----------------------------------------------
     * Fluxo: menu principal
     * --------------------------------------------- */
    if (session.step === 'aguardandoOpcao') {
      if (msg === '1') {
        session.step = 'aguardandoDescricao';
        session.lastSeen = Date.now();
        await client.sendText(number, '📝 Por favor, descreva o problema.');
        return;
      }

      if (msg === '2') {
        session.step = 'consultando';
        session.lastSeen = Date.now();
        await client.sendText(number, '🔍 Informe o número do chamado para consulta.');
        return;
      }

      if (msg === '3') {
        await client.sendText(number, '🤝 Encaminhando para um atendente...');
        await client.sendText(
          number,
          '⚠️ Atendimento automático encerrado.\nDigite *suporte* para reiniciar.'
        );
        atendimentoManual.add(number);
        delete sessions[number];
        return;
      }

      await client.sendText(number,'❌ Opção inválida. Digite *1*, *2* ou *3*.\n\n' + mensagemMenu(name));
      return;
    }

    /* -----------------------------------------------
     * Fluxo: abertura de chamado
     * --------------------------------------------- */
    if (session.step === 'aguardandoDescricao') {
      try {
        await axios.post(`${API_URL}/chamado`, {
          phone: number.replace('@c.us', ''),
          name,
          message: msgOriginal,
        });

        const { data } = await axios.get(`${API_URL}/chamado/ultimo`);
        const ticketId = data?.dados?.id ?? 'Indisponível';

        await client.sendText(
          number,
          `✅ Chamado aberto com sucesso!\nNúmero do chamado: *${ticketId}*`
        );
        await client.sendText(
          number,
          '👨‍💻 Atendimento encerrado.\nEnvie uma nova mensagem se precisar de ajuda novamente.'
        );
        delete sessions[number];
      } catch (err) {
        console.error('Erro ao criar chamado:', err);
        await client.sendText(
          number,
          '⚠️ Ocorreu um erro ao tentar abrir seu chamado.\nPor favor, tente novamente em alguns minutos.\nSe o problema persistir, entre em contato com nossa equipe de suporte.'
        );
        delete sessions[number];
      }
      return;
    }

    /* -----------------------------------------------
     * Fluxo: consulta de chamado
     * --------------------------------------------- */
    if (session.step === 'consultando') {
      try {
        const res = await axios.get(`${API_URL}/chamado/${encodeURIComponent(msgOriginal)}`);
        const dados = res.data.dados;
        const mensagem = montarMensagemChamado(dados);

        await client.sendText(number, mensagem);
        await client.sendText(
          number,
          '📄 Consulta concluída com sucesso.\nEste atendimento foi finalizado. Estamos à disposição caso precise novamente.'
        );
        delete sessions[number];
      } catch (err) {
        console.error('Erro ao consultar chamado:', err?.response?.data || err);
        await client.sendText(
          number,
          '❌ Não conseguimos localizar o chamado informado.\nConfira se o número está correto e, se o erro continuar, fale com nosso time de suporte.'
        );
        delete sessions[number];
      }
    }
  });
}

/* ---------------------------------------------------------
 * Funções auxiliares
 * ------------------------------------------------------- */
function interpretarStatus(status) {
  const map = {
    1: 'Novo',
    2: 'Em andamento',
    3: 'Aguardando',
    4: 'Aguardando aprovação',
    5: 'Resolvido',
    6: 'Fechado',
  };
  return map[status?.toString()] || `Desconhecido (${status})`;
}

function montarMensagemChamado(dados) {
  const titulo = dados.titulo || 'Sem título';
  const dataAbertura = new Date(dados.data_abertura).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const status = interpretarStatus(dados.status_chamado);
  const descricao = dados.descricao?.trim() || 'Sem descrição';

  return (
    `✅ *Detalhes do Chamado*\n\n` +
    `📄 *Título*: ${titulo}\n` +
    `📅 *Abertura*: ${dataAbertura}\n` +
    `🏷️ *Status*: ${status}\n\n` +
    `📝 *Descrição*:\n${descricao}`
  );
}
