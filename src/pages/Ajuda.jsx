import { motion } from 'framer-motion'
import { HelpCircle, Send, User, Building2, FileText, BookOpen,
         ArrowRight, CheckCircle2, AlertTriangle, Server, Search } from 'lucide-react'
import styles from './Ajuda.module.css'

const PAGE = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0 },
  transition: { duration: 0.22 },
}

const EVENTOS = [
  {
    id: 'R-4010',
    icon: User,
    color: '#E97320',
    titulo: 'Pagamentos a Pessoas Físicas',
    desc: 'Declare rendimentos pagos a pessoas físicas: salários, pró-labore, aluguéis, honorários e outros pagamentos com retenção de IR ou INSS.',
    exemplos: 'Sócios, prestadores autônomos, profissionais liberais',
  },
  {
    id: 'R-4020',
    icon: Building2,
    color: '#a78bfa',
    titulo: 'Pagamentos a Pessoas Jurídicas',
    desc: 'Declare rendimentos pagos a empresas (CNPJ): serviços contratados com retenção de IR na fonte.',
    exemplos: 'Empresas de TI, consultorias, fornecedores de serviços',
  },
  {
    id: 'R-2010',
    icon: FileText,
    color: '#22c55e',
    titulo: 'Retenções na Contratação de Serviços',
    desc: 'Declare retenções de INSS/CPRB em serviços com cessão de mão de obra. A alíquota é calculada automaticamente pelo sistema conforme o regime tributário.',
    exemplos: 'Empresas de limpeza, segurança, construção civil',
  },
  {
    id: 'R-1000',
    icon: BookOpen,
    color: '#5b8ff9',
    titulo: 'Informações do Contribuinte',
    desc: 'Evento de cadastro que identifica o contribuinte na Receita Federal. Deve ser enviado antes dos demais eventos ou quando houver alteração cadastral.',
    exemplos: 'Primeiro envio, mudança de regime tributário',
  },
]

const STEPS_WIZARD = [
  {
    num: 1,
    titulo: 'Configuração',
    desc: 'Informe o CNPJ do contribuinte, o período de apuração, selecione o certificado digital e o tipo de evento.',
    dica: 'Escolha "Homologação" para testes sem efeito real na Receita Federal.',
  },
  {
    num: 2,
    titulo: 'Dados',
    desc: 'Preencha a planilha com os dados dos pagamentos, ou faça upload de uma planilha .xlsx no modelo MLEGATE.',
    dica: 'Erros são destacados em vermelho em tempo real. Corrija antes de avançar.',
  },
  {
    num: 3,
    titulo: 'Revisão',
    desc: 'Confira o resumo do envio: evento, CNPJ, período, número de linhas e certificado selecionado.',
    dica: 'Verifique o total de inclusões, alterações e exclusões antes de prosseguir.',
  },
  {
    num: 4,
    titulo: 'Verificação Prévia',
    desc: 'O sistema valida todos os dados no servidor antes de gerar o XML. Erros de CNPJ, CPF, valores e consistência são detectados aqui — antes de qualquer envio.',
    dica: 'Se houver erros, baixe o relatório para identificar as linhas problemáticas.',
  },
  {
    num: 5,
    titulo: 'Envio',
    desc: 'O XML é assinado digitalmente e transmitido à Receita Federal. O sistema aguarda e exibe o resultado de cada evento individualmente.',
    dica: 'Não feche o navegador durante o envio. O processo pode levar alguns minutos em lotes grandes.',
  },
]

const FAQ = [
  {
    q: 'E se der erro na verificação prévia?',
    a: 'Nenhum dado é enviado à Receita Federal. Corrija os erros indicados na planilha e tente novamente. Use o botão "Baixar relatório de erros" para ver todas as inconsistências de uma vez.',
  },
  {
    q: 'Posso reenviar um evento que já foi enviado?',
    a: 'Sim. Acesse o Histórico, localize o envio e clique em "Retificar" no evento desejado. O sistema preenche automaticamente o número do recibo original.',
  },
  {
    q: 'Qual a diferença entre Homologação e Produção?',
    a: 'Homologação é o ambiente de testes — nenhum dado vai de verdade para a Receita Federal. Produção é o envio real, com efeito fiscal imediato. Use Homologação para testar antes de enviar dados reais.',
  },
  {
    q: 'Meu envio chegou na Receita Federal?',
    a: 'Acesse o Histórico e verifique o status do lote. Um lote com status "Processado" foi aceito pela RF. Você também pode consultar pelo protocolo na página Consulta.',
  },
  {
    q: 'O que é retificação?',
    a: 'É a correção de um evento já enviado. Você informa o número do recibo original, corrige os dados e reenvia com o indicador de retificação. O sistema faz isso automaticamente quando você clica em "Retificar" no Histórico.',
  },
  {
    q: 'O que são "Inclusões Passadas"?',
    a: 'São envios referentes a períodos de apuração antigos (ex: um ano atrás). Eles funcionam igual a um envio normal — a Verificação Prévia (passo 4) vai checar todos os dados antes de enviar, mostrando o número exato de cada linha com problema.',
  },
]

export default function Ajuda() {
  return (
    <motion.div className={styles.page} {...PAGE}>

      {/* Cabeçalho */}
      <div className={styles.pageHeader}>
        <HelpCircle size={22} className={styles.pageHeaderIcon} />
        <div>
          <h1 className={styles.pageTitle}>Central de Ajuda</h1>
          <p className={styles.pageSub}>Como usar a Plataforma REINF — MLEGATE</p>
        </div>
      </div>

      <div className={styles.content}>

        {/* Seção 1 — O que é */}
        <section className={styles.section}>
          <div className={`${styles.sectionHeader} ${styles.orange}`}>
            <Send size={14} />
            <span>O que é esta plataforma</span>
          </div>
          <div className={styles.sectionBody}>
            <p>
              A <strong>Plataforma REINF</strong> é uma ferramenta interna da MLEGATE para transmissão de eventos
              EFD-REINF à Receita Federal do Brasil.
            </p>
            <p>
              Você preenche uma planilha com os dados dos pagamentos, o sistema valida tudo, gera e assina
              o XML automaticamente e transmite para a RF — tudo em um único fluxo guiado passo a passo.
              Não é necessário acessar o e-CAC manualmente.
            </p>
          </div>
        </section>

        {/* Seção 2 — Eventos */}
        <section className={styles.section}>
          <div className={`${styles.sectionHeader} ${styles.blue}`}>
            <FileText size={14} />
            <span>Eventos suportados</span>
          </div>
          <div className={styles.sectionBody}>
            <div className={styles.eventoGrid}>
              {EVENTOS.map(ev => {
                const Icon = ev.icon
                return (
                  <div key={ev.id} className={styles.eventoCard}>
                    <div className={styles.eventoTop}>
                      <Icon size={15} style={{ color: ev.color, flexShrink: 0 }} />
                      <span className={styles.eventoId} style={{ color: ev.color }}>{ev.id}</span>
                      <span className={styles.eventoTitulo}>{ev.titulo}</span>
                    </div>
                    <p className={styles.eventoDesc}>{ev.desc}</p>
                    <p className={styles.eventoEx}><strong>Exemplos:</strong> {ev.exemplos}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* Seção 3 — Passo a passo */}
        <section className={styles.section}>
          <div className={`${styles.sectionHeader} ${styles.green}`}>
            <CheckCircle2 size={14} />
            <span>Como fazer um envio — passo a passo</span>
          </div>
          <div className={styles.sectionBody}>
            <div className={styles.stepsList}>
              {STEPS_WIZARD.map((s, i) => (
                <div key={s.num} className={styles.stepRow}>
                  <div className={styles.stepLeft}>
                    <div className={styles.stepNum}>{s.num}</div>
                    {i < STEPS_WIZARD.length - 1 && <div className={styles.stepLine} />}
                  </div>
                  <div className={styles.stepBody}>
                    <p className={styles.stepTitulo}>{s.titulo}</p>
                    <p className={styles.stepDesc}>{s.desc}</p>
                    <p className={styles.stepDica}>💡 {s.dica}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Seção 4 — Ambientes */}
        <section className={styles.section}>
          <div className={`${styles.sectionHeader} ${styles.yellow}`}>
            <Server size={14} />
            <span>Ambientes — Homologação e Produção</span>
          </div>
          <div className={styles.sectionBody}>
            <div className={styles.ambGrid}>
              <div className={styles.ambCard}>
                <p className={styles.ambTitulo} style={{ color: '#22c55e' }}>
                  <CheckCircle2 size={14} /> Homologação
                </p>
                <p className={styles.ambDesc}>
                  Ambiente de <strong>testes</strong>. Os dados são enviados para servidores de teste da Receita Federal —
                  nenhum efeito fiscal real. Use sempre antes de enviar dados reais.
                </p>
                <ul className={styles.ambList}>
                  <li>Ideal para testar preenchimentos novos</li>
                  <li>Erros não geram consequências fiscais</li>
                  <li>Resposta geralmente mais rápida que Produção</li>
                </ul>
              </div>
              <div className={`${styles.ambCard} ${styles.ambCardProd}`}>
                <p className={styles.ambTitulo} style={{ color: '#ef4444' }}>
                  <AlertTriangle size={14} /> Produção
                </p>
                <p className={styles.ambDesc}>
                  Ambiente <strong>real</strong>. Os dados são transmitidos oficialmente à Receita Federal com efeito
                  fiscal imediato. O sistema pede confirmação extra antes de enviar.
                </p>
                <ul className={styles.ambList}>
                  <li>Use somente após testar em Homologação</li>
                  <li>O envio gera obrigação fiscal</li>
                  <li>Retificações são possíveis pelo Histórico</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Seção 5 — FAQ */}
        <section className={styles.section}>
          <div className={`${styles.sectionHeader} ${styles.muted}`}>
            <Search size={14} />
            <span>Dúvidas frequentes</span>
          </div>
          <div className={styles.sectionBody}>
            <div className={styles.faqList}>
              {FAQ.map((item, i) => (
                <div key={i} className={styles.faqItem}>
                  <p className={styles.faqQ}>
                    <ArrowRight size={12} className={styles.faqArrow} />
                    {item.q}
                  </p>
                  <p className={styles.faqA}>{item.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

      </div>
    </motion.div>
  )
}
