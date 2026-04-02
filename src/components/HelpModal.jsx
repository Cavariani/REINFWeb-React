import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, HelpCircle, Send, ShieldCheck, History, User, Building2, FileText, BookOpen,
         ArrowRight, CheckCircle2, AlertTriangle, Server, RotateCcw, Search } from 'lucide-react'
import styles from './HelpModal.module.css'

const EVENTOS = [
  {
    id: 'R-4010',
    icon: User,
    color: '#E97320',
    titulo: 'R-4010 — Pagamentos a Pessoas Físicas',
    desc: 'Use para declarar rendimentos pagos a pessoas físicas: salários, pró-labore, aluguéis, honorários e outros pagamentos com retenção de IR ou INSS.',
    exemplos: 'Sócios, prestadores autônomos, profissionais liberais',
  },
  {
    id: 'R-4020',
    icon: Building2,
    color: '#a78bfa',
    titulo: 'R-4020 — Pagamentos a Pessoas Jurídicas',
    desc: 'Use para declarar rendimentos pagos a empresas (CNPJ): serviços contratados com retenção de IR na fonte.',
    exemplos: 'Empresas de TI, consultorias, fornecedores de serviços',
  },
  {
    id: 'R-2010',
    icon: FileText,
    color: '#22c55e',
    titulo: 'R-2010 — Retenções na Contratação de Serviços',
    desc: 'Use para declarar retenções de INSS/CPRB em serviços prestados mediante cessão de mão de obra. A alíquota é calculada automaticamente pelo sistema.',
    exemplos: 'Empresas de limpeza, segurança, construção civil',
  },
  {
    id: 'R-1000',
    icon: BookOpen,
    color: '#5b8ff9',
    titulo: 'R-1000 — Informações do Contribuinte',
    desc: 'Evento de cadastro que identifica o contribuinte na Receita Federal. Deve ser enviado antes dos demais eventos ou quando houver alteração cadastral.',
    exemplos: 'Primeiro envio, mudança de regime tributário',
  },
]

const STEPS_WIZARD = [
  {
    num: 1,
    titulo: 'Configuração',
    desc: 'Informe o CNPJ do contribuinte, o período de apuração, selecione o certificado digital e o tipo de evento.',
    dica: 'Dica: escolha "Homologação" para testes sem efeito real na Receita Federal.',
  },
  {
    num: 2,
    titulo: 'Dados',
    desc: 'Preencha a planilha com os dados dos pagamentos, ou faça upload de uma planilha .xlsx no modelo MLEGATE.',
    dica: 'Dica: erros são destacados em vermelho em tempo real. Corrija antes de avançar.',
  },
  {
    num: 3,
    titulo: 'Revisão',
    desc: 'Confira o resumo do envio: evento, CNPJ, período, número de linhas e certificado selecionado.',
    dica: 'Dica: verifique o total de inclusões, alterações e exclusões antes de prosseguir.',
  },
  {
    num: 4,
    titulo: 'Verificação Prévia',
    desc: 'O sistema valida todos os dados no servidor antes de gerar o XML. Erros de CNPJ, CPF, valores e consistência são detectados aqui.',
    dica: 'Dica: se houver erros, baixe o relatório para identificar as linhas problemáticas.',
  },
  {
    num: 5,
    titulo: 'Envio',
    desc: 'O XML é assinado e transmitido à Receita Federal. O sistema aguarda e exibe o resultado de cada evento individualmente.',
    dica: 'Dica: não feche o navegador durante o envio. O processo pode levar alguns minutos.',
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
    a: 'Homologação é o ambiente de testes — nenhum dado vai de verdade para a Receita Federal. Produção é o envio real, com efeito fiscal. Use Homologação para testar antes de enviar dados reais.',
  },
  {
    q: 'Meu envio chegou na Receita Federal?',
    a: 'Acesse o Histórico e verifique o status do lote. Um lote com status "Processado" foi aceito pela RF. Você também pode consultar pelo protocolo na página Consulta.',
  },
  {
    q: 'O que é retificação?',
    a: 'É a correção de um evento já enviado. Você informa o número do recibo original, corrige os dados e reenvia com o indicador de retificação. O sistema faz isso automaticamente quando você clica em "Retificar" no Histórico.',
  },
]

export default function HelpModal({ open, onClose }) {
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className={styles.overlay}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className={styles.modal}
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className={styles.header}>
              <div className={styles.headerLeft}>
                <HelpCircle size={20} className={styles.headerIcon} />
                <div>
                  <h2 className={styles.headerTitle}>Central de Ajuda</h2>
                  <p className={styles.headerSub}>Plataforma REINF — MLEGATE</p>
                </div>
              </div>
              <button className={styles.closeBtn} onClick={onClose}>
                <X size={16} />
              </button>
            </div>

            {/* Body com scroll */}
            <div className={styles.body}>

              {/* Seção 1 — O que é */}
              <section className={styles.section}>
                <div className={`${styles.sectionHeader} ${styles.sectionOrange}`}>
                  <Send size={15} />
                  <span>O que é esta plataforma</span>
                </div>
                <div className={styles.sectionContent}>
                  <p className={styles.paragraph}>
                    A <strong>Plataforma REINF</strong> é uma ferramenta interna da MLEGATE para transmissão de eventos
                    EFD-REINF à Receita Federal do Brasil. Substituiu o processo manual pelo e-CAC e a ferramenta
                    anterior em C#.
                  </p>
                  <p className={styles.paragraph}>
                    Com ela, você preenche uma planilha com os dados dos pagamentos, o sistema valida tudo, gera e assina
                    o XML automaticamente e transmite para a RF — tudo em um único fluxo guiado passo a passo.
                  </p>
                </div>
              </section>

              {/* Seção 2 — Eventos */}
              <section className={styles.section}>
                <div className={`${styles.sectionHeader} ${styles.sectionBlue}`}>
                  <FileText size={15} />
                  <span>Eventos suportados</span>
                </div>
                <div className={styles.sectionContent}>
                  <div className={styles.eventoGrid}>
                    {EVENTOS.map(ev => {
                      const Icon = ev.icon
                      return (
                        <div key={ev.id} className={styles.eventoCard} style={{ '--ev-color': ev.color }}>
                          <div className={styles.eventoCardHeader}>
                            <Icon size={14} style={{ color: ev.color }} />
                            <span className={styles.eventoId} style={{ color: ev.color }}>{ev.id}</span>
                          </div>
                          <p className={styles.eventoTitulo}>{ev.titulo.replace(`${ev.id} — `, '')}</p>
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
                <div className={`${styles.sectionHeader} ${styles.sectionGreen}`}>
                  <CheckCircle2 size={15} />
                  <span>Como fazer um envio</span>
                </div>
                <div className={styles.sectionContent}>
                  <div className={styles.stepsList}>
                    {STEPS_WIZARD.map((s, i) => (
                      <div key={s.num} className={styles.stepItem}>
                        <div className={styles.stepLeft}>
                          <div className={styles.stepNum}>{s.num}</div>
                          {i < STEPS_WIZARD.length - 1 && <div className={styles.stepLine} />}
                        </div>
                        <div className={styles.stepBody}>
                          <p className={styles.stepTitulo}>{s.titulo}</p>
                          <p className={styles.stepDesc}>{s.desc}</p>
                          <p className={styles.stepDica}>{s.dica}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              {/* Seção 4 — Ambientes */}
              <section className={styles.section}>
                <div className={`${styles.sectionHeader} ${styles.sectionYellow}`}>
                  <Server size={15} />
                  <span>Ambientes — Homologação e Produção</span>
                </div>
                <div className={styles.sectionContent}>
                  <div className={styles.ambGrid}>
                    <div className={styles.ambCard}>
                      <div className={styles.ambCardTitle} style={{ color: '#22c55e' }}>
                        <CheckCircle2 size={14} />
                        Homologação
                      </div>
                      <p className={styles.ambDesc}>
                        Ambiente de <strong>testes</strong>. Os dados são enviados para servidores de teste da Receita Federal
                        — nenhum efeito fiscal real. Use sempre antes de enviar dados reais.
                      </p>
                      <ul className={styles.ambList}>
                        <li>Ideal para testar preenchimentos novos</li>
                        <li>Erros não geram consequências fiscais</li>
                        <li>Resposta mais rápida que Produção</li>
                      </ul>
                    </div>
                    <div className={`${styles.ambCard} ${styles.ambCardProd}`}>
                      <div className={styles.ambCardTitle} style={{ color: '#ef4444' }}>
                        <AlertTriangle size={14} />
                        Produção
                      </div>
                      <p className={styles.ambDesc}>
                        Ambiente <strong>real</strong>. Os dados são transmitidos oficialmente à Receita Federal com efeito
                        fiscal imediato. O sistema pede confirmação extra antes de enviar.
                      </p>
                      <ul className={styles.ambList}>
                        <li>Use somente após testar em Homologação</li>
                        <li>Envio gera obrigação fiscal</li>
                        <li>Retificações são possíveis pelo Histórico</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </section>

              {/* Seção 5 — FAQ */}
              <section className={styles.section}>
                <div className={`${styles.sectionHeader} ${styles.sectionMuted}`}>
                  <Search size={15} />
                  <span>Dúvidas frequentes</span>
                </div>
                <div className={styles.sectionContent}>
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
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
